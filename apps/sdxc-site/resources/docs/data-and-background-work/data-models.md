---
title: Model your tables
description: Wrap remix/data-table tables in models with scopes, callbacks and typed meta fields, bind them per request as ctx.models, and dispatch jobs only after a write commits.
section:
    title: Data & background work
    order: 7
order: 3
lastUpdated: 2026-10-25
outcomes:
    - "How to wrap `remix/data-table` tables in models with `@sdxc/data-model` and publish them as `ctx.models`"
    - "How to dispatch jobs only after a write commits"
    - "How to build test data with factories and seed a new database"
---

Once an app has more than a few tables, every table grows a module of `findBy…` functions that
take the database first, plus some place where a write enqueues a job.
[`@sdxc/data-model`](/api/data-model) is that layer, written once: a model is a
`remix/data-table` table plus scopes, methods and callbacks, bound to a database once per
request, job or test.

This guide defines a model, publishes the app's models as `ctx.models`, dispatches jobs after a
write lands, stores open-ended attributes in a meta table, and builds test and seed data. The
database setup is the one from [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases).

```bash
npm add @sdxc/data-model @sdxc/database-middleware @sdxc/jobs @sdxc/result @sdxc/sample \
	@sdxc/uuid remix
```

## Define a model

`createModel` takes a table and returns a definition. Scopes are named refinements of a query, a
default scope applies to every read, methods run with `this` bound to the model, and callbacks run
around every write made through it:

```typescript {% title="app/models/users.ts" %}
import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v7";
import { fail } from "remix/data-table";

import { users } from "~/database/schema";

export const Users = createModel(users, {
	generateId: generateUUID,
	defaultScope: (query) => query.where({ deleted_at: null }),
	scopes: {
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),
	},
	methods: {
		findByEmail(email: string) {
			return this.query().where({ email: email.toLowerCase() }).first();
		},
	},
	callbacks: {
		async validate(values) {
			if (values.name === "") return fail("Name is required", ["name"]);
		},
		async beforeCreate(values) {
			return { ...values, email: values.email.toLowerCase() };
		},
	},
});
```

`generateId` fills the primary key of every row inserted without one. The default scope keeps
soft-deleted users out of every read, and `unscoped()` reads past it for the code that restores
one. A method answers a promise or a model query, so a model loaded on demand can answer it
before its module loads.

Bind the definition to a database and use it:

```typescript
import { isFailure } from "@sdxc/result";

let users = Users.bind({ db });

let created = await users.create({ email: "Pat@Example.com", name: "Pat" });
if (isFailure(created)) return created.error.issues;

await users.find(created.data.id); // the row, or null
await users.inTeam(teamId).orderBy("name", "asc").all(); // deleted users left out
```

Reads answer `null` for a missing row. Writes answer a `Result`: a `ValidationError` from
[`@sdxc/validate`](/api/validate) when a callback or a database constraint refuses the write,
with a duplicate's issue at the indexed column, and `NotFound` when an update or delete names a
missing key.

## Publish the models on `ctx.models`

A registry lists the models under the names handlers read them by. An import entry loads its
module on first use, so a request evaluates only the models it touches:

```typescript {% title="app/models/index.ts" %}
import { createModels } from "@sdxc/data-model";

import { Users } from "./users";

export const models = createModels({
	users: Users,
	articles: () => import("./articles"),
});
```

The router middleware binds the registry per request, reading the database earlier middleware
published on `ctx.db`:

```typescript {% title="app/initializers/router.ts" %}
import { models as modelsMiddleware } from "@sdxc/data-model/router";
import { database } from "@sdxc/database-middleware";
import { createRouter } from "remix/router";

import { openDatabase } from "~/app/initializers/database";
import { models } from "~/app/models";
import routes from "~/routes/web";

export function createWebRouter() {
	let router = createRouter({
		middleware: [
			database(openDatabase()),
			modelsMiddleware(models, (ctx) => ({ db: ctx.db })),
		],
	});

	router.get(routes.users.show, async (ctx) => {
		let user = await ctx.models.users.findByEmail(ctx.params.email);
		if (user === null) return new Response(null, { status: 404 });
		return Response.json(user);
	});
	return router;
}
```

A job dispatcher takes the counterpart from `@sdxc/data-model/jobs`. Its middleware sees the
bare job context, so it reads the database by the `Database` key:

```typescript {% title="app/initializers/dispatcher.ts" %}
import { models as modelsMiddleware } from "@sdxc/data-model/jobs";
import { Database, database } from "@sdxc/database-middleware/jobs";
import { createJobDispatcher } from "@sdxc/jobs";

import { openDatabase } from "~/app/initializers/database";
import { models } from "~/app/models";

export const dispatcher = createJobDispatcher({
	middleware: [
		database(openDatabase),
		modelsMiddleware(models, (ctx) => ({ db: ctx.require(Database) })),
	],
});
```

## Dispatch side effects after commit

Callbacks receive a model context that starts with `db` and `get(key)`. Declare anything else a
model depends on, and every binding then has to supply it:

```typescript {% title="config/model-context.d.ts" %}
import type { JobEnqueuer } from "@sdxc/jobs";

declare module "@sdxc/data-model" {
	interface ModelContext {
		jobs: JobEnqueuer;
	}
}
```

An `afterCommit` callback enqueues the job once the write has landed:

```typescript {% title="app/models/users.ts" %}
import { createModel } from "@sdxc/data-model";

import jobs from "~/app/jobs";
import { users } from "~/database/schema";

export const Users = createModel(users, {
	callbacks: {
		async afterCommit(event, ctx) {
			if (event.operation !== "create") return;
			await ctx.jobs.enqueue(jobs.sendWelcome, { userId: event.row.id });
		},
	},
});
```

The router binding passes `ctx.jobs` and the dispatcher's passes itself, so a binding that leaves
it out fails to type-check:

```typescript
modelsMiddleware(models, (ctx) => ({ db: ctx.db, jobs: ctx.jobs }));
modelsMiddleware(models, (ctx) => ({ db: ctx.require(Database), jobs: dispatcher }));
```

Inside `ctx.models.transaction(...)`, `afterCommit` waits for the whole callback and runs only
when it resolves with something other than a `Failure`, so a failed team drops the queued welcome
job:

```typescript
import { isFailure } from "@sdxc/result";

let result = await ctx.models.transaction(async (models) => {
	let user = await models.users.create({ email, name });
	if (isFailure(user)) return user;

	return models.teams.create({ owner_id: user.data.id, name: "Personal" });
});
```

> [!WARNING]
> D1 commits every statement as it runs, so on D1 the transaction above keeps the user row and the
> caller decides on the compensating delete. The same holds for `afterCreate`, `afterUpdate` and
> `afterDelete`: their database work has committed when one fails, so put anything with
> consequences outside the database in `afterCommit`.

> [!NOTE]
> An update or delete built from a query, `ctx.models.users.inTeam(teamId).update({ ... })`, is one
> statement and runs no model callbacks. Call `update(key, values)` per row when each row needs them.

## Store open-ended attributes in a meta table

Attributes that differ per record type, or change too often to deserve a migration, can live in
a key/value table beside the main one. A model names that table once and declares typed fields
over it; `extend` adds a sub-model per value of the `type` column:

```typescript {% title="app/models/articles.ts" %}
import { createModel, field } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v7";

import { postMeta, posts } from "~/database/schema";

export const Posts = createModel(posts, {
	inheritance: "type",
	metaTable: { table: postMeta, foreignKey: "post_id", generateId: generateUUID },
});

export const Articles = Posts.extend("article", {
	meta: {
		slug: field.text().required(),
		title: field.text(),
		tags: field.list(field.text()),
	},
	methods: {
		findBySlug(slug: string) {
			return this.query().whereMeta("slug", slug).first();
		},
	},
});

export default Articles;
```

Rows carry a decoded `meta` object. Writes take one, and an update touches only the keys it
names, with `null` removing one:

```typescript
await ctx.models.articles.create({
	author_id: ctx.user.id,
	meta: { slug: "hello", title: "Hello", tags: ["remix"] },
});

await ctx.models.articles.update(id, { meta: { title: "Hello, world", tags: null } });
```

A field reads as possibly missing unless it declares a default, and `required()` makes `create`
refuse a write without it. Keep a value a listing sorts by in a column, where keyset paging can
seek on it.

## Build test data with factories

`@sdxc/data-model/testing` defines factories whose attributes draw from
[`@sdxc/sample`](/api/sample) and write through the model, so callbacks, constraints and meta
run in a fixture exactly as in production:

```typescript {% title="database/factories/index.ts" %}
import { defineFactory } from "@sdxc/data-model/testing";

import { Articles } from "~/app/models/articles";
import { Users } from "~/app/models/users";

export const UserFactory = defineFactory(Users, {
	name: ({ sample }) => sample.person.fullName(),
	email: ({ sequence }) => `user${sequence}@example.com`,
}).trait("admin", { role: "admin" });

export const ArticleFactory = defineFactory(Articles, {
	author_id: async ({ create }) => (await create(UserFactory)).id,
	meta: ({ sample }) => ({
		slug: sample.lorem.slug(),
		title: sample.lorem.sentence(),
	}),
}).trait("draft", { published_at: null });
```

```typescript {% title="app/models/articles.test.ts" %}
import { createModels } from "@sdxc/data-model";
import { createFactories } from "@sdxc/data-model/testing";
import { expect, test } from "vitest";

import { Articles } from "~/app/models/articles";
import { Users } from "~/app/models/users";
import { createTestDatabase } from "~/app/test/database";
import { ArticleFactory, UserFactory } from "~/database/factories";

test("keeps drafts out of the published list", async () => {
	let db = await createTestDatabase();
	let models = createModels({ users: Users, articles: Articles }).bind({ db });
	let factories = createFactories(models, { seed: 42 });

	let author = await factories.create(UserFactory, "admin");
	await factories.createMany(ArticleFactory, 3, { author_id: author.id });
	await factories.create(ArticleFactory, "draft", { author_id: author.id });

	expect(await models.articles.query().where({ published_at: null }).count()).toBe(
		1,
	);
});
```

An attribute's function runs only for a value the call leaves out, so the articles above create
no extra users. Each factory draws from a stream derived from the seed, so a failing run
reproduces from its seed.

## Seed a new database

`@sdxc/data-model/seed` declares the rows a new database starts with as named steps, each
writing through `models` or `factories`:

```typescript {% title="database/seed.ts" %}
import { defineSeed } from "@sdxc/data-model/seed";

import { models } from "~/app/models";
import { ArticleFactory } from "~/database/factories";

export default defineSeed(models, {
	admin: ({ models }) =>
		models.users.create({ email: "admin@example.com", name: "Admin" }),
	articles: ({ factories }) => factories.createMany(ArticleFactory, 10),
});
```

`run({ db })` runs the steps in order and answers the names that ran, or a failure naming the step
that threw. An app from `sdxc create` runs it with `sdxc run db seed`, and
`sdxc run db fresh --seed` rebuilds the local database and seeds it.

## Where to go next

- [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases) — open the
  database the models bind to.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — define the jobs an
  `afterCommit` callback enqueues.
- [`@sdxc/data-model`](/api/data-model) — every option, member and type.
