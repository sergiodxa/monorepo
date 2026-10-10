---
title: Model your tables
description: Wrap remix/data-table tables in models with scopes, callbacks and typed meta fields, bind them per request as ctx.models, and dispatch jobs only after a write commits.
section:
    title: Data & background work
    order: 6
order: 3
lastUpdated: 2026-10-09
---

Once an app has more than a few tables, the code around them settles into a pattern: a module
per table with `findBy…` and `listBy…` functions that all take the database first, plus some
place where a write enqueues a job or sends a mail. [`@sdxc/data-model`](/api/data-model)
is that layer, written once. A model is a `remix/data-table` table plus named scopes, custom
methods and async callbacks. It is bound to a database once per request, job or test, and every
member runs there.

This guide defines a model, publishes the app's models as `ctx.models`, dispatches side effects
only after a write lands, keeps several record types in one table, stores open-ended attributes
in a key/value table, and builds test data with factories. Your tables stay as you declared
them; the database setup is the one from
[Query D1 and Durable Object SQL](/docs/data-and-background-work/databases).

```bash
npm add @sdxc/data-model @sdxc/result @sdxc/validate remix
npm add -D @sdxc/sample
```

## Define a model

`createModel` takes a table and returns a definition. Scopes are named refinements of a query;
a default scope is one every read applies; methods run with `this` bound to the model, so they
compose its scopes and each other; callbacks run around every write made through the model:

```typescript {% title="app/models/users.ts" %}
import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v7";
import { fail } from "remix/data-table";

import { users } from "~/database/schema";

export const Users = createModel(users, {
	optional: ["id"],
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
			return {
				...values,
				id: values.id ?? generateUUID(),
				email: values.email.toLowerCase(),
			};
		},
	},
});
```

`optional` lists the columns `create` may leave out because a callback or the database fills
them; every other non-null column is required by the type of `create`. A scope receives a query
it may refine with `where`, `orderBy`, `limit` and the other methods that keep the row type, and
answers it. `with()` and `select()` change the row, so they belong in a method.

The default scope keeps soft-deleted users out of every read without each call site
remembering a filter: queries, scopes and `find` leave them out, and an update or delete of one
answers `NotFound`. `unscoped()` reads past it, for the code that restores a user. A method
answers a promise or a model query, so a model loaded on demand can answer it before its module
loads; one answering a plain value turns the definition into a type error naming it.

Bind the definition to a database and use it:

```typescript
import { isFailure } from "@sdxc/result";

let users = Users.bind({ db });

let created = await users.create({ email: "Pat@Example.com", name: "Pat" });
if (isFailure(created)) return created.error.issues;

await users.find(created.data.id); // the row, or null
await users.inTeam(teamId).orderBy("name", "asc").all(); // deleted users left out
await users.unscoped().where({ id }).first(); // including a deleted one
```

Reads answer `null` for a missing row. Writes answer a `Result`: a `ValidationError` from
[`@sdxc/validate`](/api/validate) when a callback, the table's own hooks or a database
constraint refuses the write, and `NotFound` when an update or delete names a key the model has
no row for. A unique index violation comes back as an issue at the indexed column, so a form
renders the duplicate email the same way it renders a failed schema.

Every scope returns a real data-table query, so [`@sdxc/pagination`](/api/pagination) pages it
unchanged:

```typescript
import { Pagination } from "@sdxc/pagination";

let page = await Pagination.byOffset(users.inTeam(teamId).orderBy("name", "asc"), {
	page: 1,
	perPage: 25,
});
```

`Pagination.byKeyset` owns the ordering, so give it a scope that only filters; it refuses a
query that already orders.

## Publish the models on `ctx.models`

A registry lists the models under the names handlers read them by. An entry can be an import,
which loads the module on its first call in each request, so a request evaluates only the
models it touches:

```typescript {% title="app/models/index.ts" %}
import { createModels } from "@sdxc/data-model";

import { Users } from "./users";

export const models = createModels({
	users: Users,
	articles: () => import("./articles"),
});
```

The router middleware binds the registry per request. Its function builds the model context
from the request context, once, on the first model access, so it reads whatever earlier
middleware published, such as the database on `ctx.db`:

```typescript {% title="app/router.ts" %}
import { models as modelsMiddleware } from "@sdxc/data-model/router";
import { createRouter } from "remix/router";

import database from "~/http/middleware/database";
import { openDatabase } from "~/lib/database";
import { models } from "~/models";

export const router = createRouter({
	middleware: [
		database(openDatabase),
		modelsMiddleware(models, (ctx) => ({ db: ctx.db })),
	],
});

router.get(routes.users.show, async (ctx) => {
	let user = await ctx.models.users.findByEmail(ctx.params.email);
	if (user === null) return new Response(null, { status: 404 });
	return Response.json(user);
});
```

An MCP tool mounted on the router runs on the same request context, so it reads
`ctx.get(Models)` the same way. A job dispatcher takes the counterpart from
`@sdxc/data-model/jobs`, given the database its own middleware published:

```typescript {% title="app/jobs/dispatcher.ts" %}
import { models as modelsMiddleware } from "@sdxc/data-model/jobs";
import { createJobDispatcher } from "@sdxc/jobs";

import { Database, database } from "~/jobs/middleware/database";
import { models } from "~/models";

export const dispatcher = createJobDispatcher({
	middleware: [
		database(),
		modelsMiddleware(models, (ctx) => ({ db: ctx.require(Database) })),
	],
});
```

A job's middleware sees the bare job context, so it reads the database by its key rather than
through `ctx.database`, which only the job's handler sees.

## Dispatch side effects after commit

Callbacks receive a model context, which you extend the way middleware extends a router's
context. It starts with `db`, the database the model is bound to, and `get(key)`, which reads
what the host context published. Anything a callback depends on, you declare on the interface,
and every binding then has to supply it:

```typescript {% title="config/model-context.d.ts" %}
import type { BoundRegistry } from "@sdxc/data-model";
import type { JobEnqueuer } from "@sdxc/jobs";

import type { models } from "~/models";

declare module "@sdxc/data-model" {
	interface ModelContext {
		jobs: JobEnqueuer;
		models: BoundRegistry<typeof models>;
	}
}
```

`models` is always there at runtime: the rest of the registry, bound to the same request. The
declaration types it, so a callback calling another model is checked like any other call. A
callback then reads `ctx.jobs` directly:

```typescript {% title="app/models/users.ts" %}
import { createModel } from "@sdxc/data-model";

import jobs from "~/jobs";

export const Users = createModel(users, {
	callbacks: {
		async afterCommit(event, ctx) {
			if (event.operation !== "create") return;
			await ctx.jobs.enqueue(jobs.sendWelcome, { userId: event.row.id });
		},
	},
});
```

Each binding supplies it, the router's from `ctx.jobs` and the dispatcher's from itself, so a
binding that leaves it out fails to type-check:

```typescript
modelsMiddleware(models, (ctx) => ({ db: ctx.db, jobs: ctx.jobs }));
modelsMiddleware(models, (ctx) => ({ db: ctx.require(Database), jobs: dispatcher }));
```

Keep the language out of the model context. A callback runs for every caller of the model,
scripts and jobs included, so an email worded for the visitor is the controller's to enqueue,
with the request's locale, after the write it follows.

`afterCommit` runs right after a write made on its own. Inside `ctx.models.transaction(...)` it
waits for the whole callback, and runs only when the callback resolves with something other than
a `Failure`:

```typescript
import { isFailure } from "@sdxc/result";

let result = await ctx.models.transaction(async (models) => {
	let user = await models.users.create({ email, name });
	if (isFailure(user)) return user;

	return models.teams.create({ owner_id: user.data.id, name: "Personal" });
});
```

If the team fails, the returned `Failure` drops the queued welcome job. What it cannot do on D1
is take the user back: D1 commits every statement as it runs, so the user row stays and the
caller decides on the compensating delete. Bind with `{ transactions: "database" }` on an
adapter with real transactions, such as SQLite in tests, and the user rolls back too.

`afterCreate`, `afterUpdate` and `afterDelete` run before the write is reported, and can fail it.
On D1 their database work has already committed, so keep them to work the model can repeat, and
put anything with consequences outside the database in `afterCommit`.

An update or delete built from a query, `ctx.models.users.inTeam(teamId).update({ ... })`, is one
statement over every matching row and runs no model callbacks. It is the escape hatch for
set-based writes; iterate and call `update(key, values)` per row when each row needs its
callbacks.

## Keep several record types in one table

A model can pin columns to fixed values with `constraints`, and a base model that names a
discriminator column can be extended once per value. Every query of a sub-model filters on its
value, every create writes it, and a key belonging to another type answers `NotFound`:

```typescript {% title="app/models/posts.ts" %}
import { createModel } from "@sdxc/data-model";
import { fail } from "remix/data-table";

export const Posts = createModel(posts, {
	inheritance: "type",
	scopes: { live: (query) => query.where({ deleted_at: null }) },
	callbacks: {
		async beforeDelete(row) {
			if (row.federated_at !== null)
				return fail("Federated posts are retracted");
		},
	},
});

export const Articles = Posts.extend("article", {});
export const Likes = Posts.extend("like", {});
```

A sub-model has every scope, method and callback of its base, and its own callbacks run after
the base's. Its rows type `type` as `"article"`, and its `create` input leaves `type` out. The
base reads every row with `type` as the full union, and writing through the base runs only the
base's callbacks.

## Store open-ended attributes in a meta table

Attributes that differ per record type, or that change too often to deserve a migration, often
live in a key/value table beside the main one. A model names that table once and declares typed
fields over it; rows then carry a decoded `meta` object:

```typescript {% title="app/models/articles.ts" %}
import { field } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v7";

import { postMeta } from "~/database/schema";

export const Posts = createModel(posts, {
	inheritance: "type",
	metaTable: { table: postMeta, foreignKey: "post_id", generateId: generateUUID },
});

export const Articles = Posts.extend("article", {
	meta: {
		slug: field.text().required(),
		title: field.text(),
		locale: field.enum(["en", "es"]).default("en"),
		tags: field.list(field.text()),
	},
	methods: {
		findBySlug(slug: string) {
			return this.live().whereMeta("slug", slug).first();
		},
	},
});

export default Articles;
```

Writes take a `meta` object, and an update touches only the keys it names, with `null` removing
one:

```typescript
let article = await ctx.models.articles.create({
	author_id: ctx.user.id,
	meta: { slug: "hello", title: "Hello", tags: ["remix"] },
});

await ctx.models.articles.update(id, { meta: { title: "Hello, world", tags: null } });
```

Every field reads as possibly missing unless it declares a default, since any key can be
absent for any row; `required()` makes `create` refuse a write without it, with the issue at
`["meta", "slug"]`. A value the field's codec rejects reads as missing. `withMeta(["title"])`
loads only the keys a list shows, and `whereMeta(key, value)` keeps the rows holding a value.
The first `whereMeta` on a query joins the meta table into the read, so filtering every article
by locale stays one statement however many match. Each further `whereMeta` looks its matches up
first, so chain the broad key first and the selective ones after it. A value a listing sorts by
belongs in a column, where keyset paging can seek on it.

An update that names only meta keys still touches `updated_at`, when the table declares
`timestamps`, so a post whose title changed reads as updated in a feed or a sitemap.

A write inserts the new meta rows before deleting the old ones, and reads take each key's
latest row, so a failure between the two statements on D1 still reads the new value.

## Write helpers over any model

`BoundModel<typeof Users>` names a bound model's type, and `ModelRow`, `CreateValues` and
`UpdateValues` name its row and write inputs. `AnyModel` is the constraint for a helper written
once for every model, and its optional shape narrows it to models whose rows have those columns:

```typescript {% title="app/models/helpers.ts" %}
import type { AnyModel, BoundModel, ModelRow } from "@sdxc/data-model";

export async function findOr404<M extends AnyModel>(
	model: BoundModel<M>,
	id: string,
): Promise<ModelRow<M>> {
	let row = await model.find(id);
	if (row === null) throw new Response(null, { status: 404 });
	return row;
}

export async function forPost<M extends AnyModel<{ post_id: string }>>(
	model: BoundModel<M>,
	postId: string,
): Promise<ModelRow<M>[]> {
	return model.query().where({ post_id: postId }).all();
}
```

`findOr404(ctx.models.articles, id)` answers an article row with its decoded meta, and
`forPost(ctx.models.users, id)` fails to type-check, because a user row has no `post_id`.

## Build test data with factories

`@sdxc/data-model/testing` defines factories whose attributes draw from
[`@sdxc/sample`](/api/sample) and write through the model, so callbacks, constraints and meta
run in a fixture exactly as in production:

```typescript {% title="app/test/factories.ts" %}
import { defineFactory } from "@sdxc/data-model/testing";

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
import { createFactories } from "@sdxc/data-model/testing";

test("keeps drafts out of the published list", async () => {
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

An attribute's function runs only when the call does not override it, so the articles above
create no extra users. Each factory draws from a stream derived from the seed by its name, so
adding a factory leaves every other factory's values where they were, and a failing run
reproduces from its seed. A write that fails throws, with the `ValidationError` as its cause.

## Where to go next

- [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases) — open the
  database the models bind to.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — define the jobs an
  `afterCommit` callback enqueues.
- [Full-text search over SQLite](/docs/data-and-background-work/full-text-search) — wrap a search
  query with `from()` so a model's scopes apply to it.
- [`@sdxc/data-model`](/api/data-model) — every option, member and type.
