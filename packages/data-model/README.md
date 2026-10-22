# @sdxc/data-model

Models over remix/data-table tables with scopes, async callbacks and typed meta fields.

A model is a `remix/data-table` table plus named scopes, custom methods, async callbacks and
typed fields over a key/value meta table. Define it once and bind it per request, job or test to
the right database; rows stay the plain objects data-table returns, and every scope is a real
data-table `Query`, so pagination, search and eager loading take them unchanged.

## Installation

```sh
npm add @sdxc/data-model
```

Tables come from `remix/data-table` in [`remix`](https://www.npmjs.com/package/remix); writes
answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) and fail
with the `ValidationError` from [`@sdxc/validate`](https://www.npmjs.com/package/@sdxc/validate).
The `./jobs` entry point needs [`@sdxc/jobs`](https://www.npmjs.com/package/@sdxc/jobs), `./cli`
needs [`@sdxc/cli`](https://www.npmjs.com/package/@sdxc/cli), and `./testing` and `./seed` need
[`@sdxc/sample`](https://www.npmjs.com/package/@sdxc/sample).

## Usage

### Define a model

```typescript
import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v7";
import { fail } from "remix/data-table";

import { users } from "./schema.js";

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

### Bind it, read and write

```typescript
import { ConstraintViolation } from "@sdxc/data-model";
import { isFailure } from "@sdxc/result";

let users = Users.bind({ db });

let created = await users.create({ email: "Pat@Example.com", name: "Pat" });
if (isFailure(created)) {
	if (created.error instanceof ConstraintViolation && created.error.kind === "unique") {
		return "That email is taken";
	}
	return created.error.issues;
}

await users.find(created.data.id); // the row, or null
await users.inTeam(teamId).orderBy("name", "asc").all(); // deleted users left out
await users.unscoped().where({ id }).first(); // including deleted ones
```

Reads answer `null` for a missing row. `create`, `update`, `upsert` and `delete` answer a
`Result`: a callback's `fail(...)` or a database constraint comes back as a `ValidationError`,
and an `update` or `delete` of a row the model cannot see comes back as `NotFound`.

### Publish models per request

```typescript
import { createModels } from "@sdxc/data-model";
import { models } from "@sdxc/data-model/router";
import { createRouter } from "remix/fetch-router";

export const registry = createModels({
	users: Users,
	articles: () => import("./models/articles.js"),
});

let router = createRouter({
	middleware: [database(), models(registry, (ctx) => ({ db: ctx.db }))],
});

router.get(routes.users.show, async (ctx) => {
	let user = await ctx.models.users.findByEmail(ctx.url.searchParams.get("email") ?? "");
	return user === null ? new Response(null, { status: 404 }) : Response.json(user);
});
```

The context function runs once per request, on the first model access, so it reads whatever
earlier middleware published. An entry written as an import loads on its first call.

`./jobs` and `./cli` export the same `models()` for a job dispatcher and an `@sdxc/cli` command
line, publishing under the same `Models` key:

```typescript
import { createCLI, failure, success } from "@sdxc/cli";
import { models } from "@sdxc/data-model/cli";
import { database } from "@sdxc/database-middleware/cli";

let cli = createCLI({
	name: "app",
	commands: contract,
	middleware: [database(db), models(registry, (ctx) => ({ db: ctx.db }))],
});

cli.map(contract.users.find, async (ctx) => {
	let user = await ctx.models.users.findByEmail(ctx.arguments.email);
	if (user === null) return failure(new Error(`No user ${ctx.arguments.email}`));
	ctx.stdout(`${user.id}\t${user.name}\n`);
	return success();
});
```

### Reach services and defer side effects

Callbacks receive a `ModelContext` and methods read it as `this.context`: `db`, `models` (the
rest of the registry, bound alongside) and `get(key)`, which reads the host context. Add
whatever else your models need to the interface, and supply it wherever you bind:

```typescript
import type { BoundModels } from "@sdxc/data-model";
import type { JobEnqueuer } from "@sdxc/jobs";

interface AppModels {
	users: typeof Users;
	teams: typeof Teams;
}

declare module "@sdxc/data-model" {
	interface ModelContext {
		jobs: JobEnqueuer;
		models: BoundModels<AppModels>;
	}
}

export const Users = createModel(users, {
	methods: {
		async signUp(email: string, name: string) {
			let user = await this.create({ email, name });
			if (isFailure(user)) return user;
			return this.context.models.teams.create({ owner_id: user.data.id, name: "Personal" });
		},
	},
	callbacks: {
		async afterCommit(event, ctx) {
			if (event.operation === "create")
				await ctx.jobs.enqueue(sendWelcome, { userId: event.row.id });
		},
	},
});

router.use(models(registry, (ctx) => ({ db: ctx.db, jobs: ctx.jobs })));

let result = await ctx.models.transaction(async (models) => {
	let user = await models.users.create({ email, name });
	if (isFailure(user)) return user;
	return models.teams.create({ owner_id: user.data.id, name: "Personal" });
});
```

Inside `transaction`, `afterCommit` events queue and flush once the callback resolves with
anything but a `Failure`; a throw or a returned `Failure` drops them. Writes roll back only where
the database has real transactions, so on D1 the user above stays written when the team fails,
and no welcome job goes out for it.

Type `models` from an interface listing the entries rather than from `typeof registry`, so a
method calling a sibling leaves the rest of the registry's type alone.

## API

### `createModel(table, options?)`

Defines a model over a data-table table. Every option is optional:

- `scopes`: named refinements `(query, ...args) => query`, callable on the bound model and on
  every query from it. A scope may call `where`, `having`, `orderBy`, `groupBy`, `limit`,
  `offset` and `distinct`; `with()` and `select()` change the row type, so they belong in
  `methods`.
- `defaultScope`: a scope every read applies, including the row an update or delete targets.
  `unscoped()` reads without it.
- `methods`: custom methods with `this` bound to the model. Each answers a promise or a model
  query; a method answering a plain value, or a method or scope named like a built-in member
  (see `ReservedName`), turns the definition into an `InvalidModel` naming it.
- `callbacks`: `validate`, `beforeCreate`, `beforeUpdate`, `beforeDelete`, `afterCreate`,
  `afterUpdate`, `afterDelete` and `afterCommit`, all async and all receiving the
  `ModelContext`. `validate` and `before*` fail with `fail(...)` from `remix/data-table`;
  `before*` may return rewritten values.
- `constraints`: columns pinned to fixed values. Every read filters on them, every create writes
  them, and an update or delete of a row outside them answers `NotFound`.
- `inheritance`: the discriminator column `extend()` pins sub-models on.
- `optional`: columns `create` may leave out because a callback or the database fills them.
  Nullable columns and `created_at`/`updated_at` are optional already.
- `generateId`: creates the primary key of a row `create` or `upsert` inserts without one,
  such as `generateUUID` from `@sdxc/uuid/v7`, and makes the key optional in `create`. A key the
  caller passes is kept; the table needs a single-column primary key.
- `metaTable` and `meta`: a key/value companion table and the typed fields read from it.

### `withContext<Context>()`

Answers `{ createModel }` typed with `Context` in place of `ModelContext`, for an app binding
one registry per database. Declare `Context` as an interface extending `ModelContext`; an
intersection type resolves eagerly and makes the models circular.

```typescript
interface FeedContext extends ModelContext {
	models: BoundModels<FeedModels>;
}

export const { createModel } = withContext<FeedContext>();
```

### `definition.bind(context, host?, options?)`

Binds a model for a script, a seed or a test. `context` holds `db` and every member the app added
to `ModelContext`; `host` is what `ctx.get` reads through to, such as a `RequestContext`;
`options.transactions` is `"database"` for an adapter with real transactions and `"none"`, the
default, for D1 and Durable Object SQLite.

### `definition.extend(value, options)`

A sub-model pinned to one value of the base's `inheritance` column, with every scope, method and
callback of the base; its own callbacks run after the base's. A scope or method named like one
of the base's is a type error.

### Bound model

| Member                 | Answers                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `query()`, scopes      | A data-table `Query` with the model's scopes chainable     |
| `unscoped()`           | The same, without the default scope                        |
| `withMeta(keys)`       | A query loading only those meta keys                       |
| `whereMeta(key, v)`    | A query keeping rows holding `v` under the key             |
| `from(query)`          | Another package's query, with constraints and scopes added |
| `find(key)`            | `Row \| null`                                              |
| `findBy(where)`        | `Row \| null`                                              |
| `create(values)`       | `Result<Row, ValidationError>`                             |
| `update(key, values)`  | `Result<Row, ValidationError \| NotFound>`                 |
| `upsert(values, opts)` | `Result<Row, ValidationError>`, in one statement           |
| `delete(key)`          | `Result<Row, ValidationError \| NotFound>`                 |
| `transaction(fn)`      | Whatever `fn` returns, with `afterCommit` deferred         |
| `db`                   | The database it is bound to, for a method's raw statement  |
| `context`              | The model context                                          |
| `load()`               | The bound model once a lazily loaded module has loaded     |

A single key is the column's value, a composite key an object; a key of any other shape, such as
a list, answers `null` from `find` and `NotFound` from `update` and `delete`. Every `update` sets
the table's `updatedAt` column, so `update(key, {})` marks a row as changed and runs the update
callbacks.

`upsert(values, { conflict, update })` is one `INSERT … ON CONFLICT` statement, so it runs no
callbacks and supplies its own `id`. `conflict` defaults to the primary key; `update` defaults to
the values without the conflict and key columns and `createdAt`, and `update: {}` keeps a
conflicting row as it is. A model with constraints reads the conflict target first, so a
conflicting row outside them is refused and left as it is.

A bulk write built from a query, `users.inTeam(teamId).update({ ... }, { touch: false })`, is
data-table's own statement and runs no callbacks; `touch: false` leaves `updatedAt` as it is and
`returning` answers the updated rows.

### `createModels(entries)`

A registry keyed by the name each model is bound under. An entry is a model or a function
importing a module that default-exports one. `registry.bind(context, host?, options?)` binds every
entry, and the bound registry's `transaction(fn)` opens a unit of work across them.

### `field`

Meta field codecs: `text`, `integer`, `number`, `boolean`, `timestamp`, `url` (`http` and
`https` only, so a stored value is safe to link to), `enum(values)`, `json(schema)` and
`list(field)`. Every field reads as `T | undefined` unless it declares `.default(value)`;
`.required()` makes `create` refuse a write without it.

### `models(registry, context, options?)` from `./router`, `./jobs` and `./cli`

Middleware publishing the registry bound to each request, job run or command run as
`ctx.models` (or `options.property`) and under the `Models` context key. `options.transactions`
is passed to the binding.

### `NotFound`

The failure an update or delete answers when no visible row has the key, with `model` and `key`.

### `ConstraintViolation`

The `ValidationError` a write answers when the database refuses it, with `kind` (`"unique"`,
`"foreign-key"`, `"not-null"` or `"check"`) and the `column` it covers.

### `./testing`

- `defineFactory(model, attributes, options?)`: a factory whose attributes are values or
  functions of `{ sample, sequence, create }`; `.trait(name, attributes)` adds a named set.
- `createFactories(models, { seed, now? })`: `build`, `create` and `createMany` for a bound
  registry, writing through the models so callbacks and constraints behave as in production.
- `overrideModel(model, build)`: replaces members in every binding until the returned function
  runs; `build` receives the original members, so a replacement can wrap them.
- `publishModels(ctx, registry, context, options?)`: binds a registry with `ctx` as its host and
  publishes it the way the middleware does, for a test calling a handler directly.

### `./seed`

- `defineSeed(registry, steps)`: a `Seeder` whose named steps receive `{ models, factories }`
  and run in order; `seeder.run({ db }, { seed? })` binds the registry and answers the names
  that ran, or a failure naming the step that threw.

### Types

`BoundModel<M>`, `ModelQuery<M>`, `ModelRow<M>`, `CreateValues<M>` and `UpdateValues<M>` name a
model's bound type, query, row and write inputs from `typeof Model`. `AnyModel<Shape>` constrains
a helper to models whose rows have `Shape`. `ModelContext` is what callbacks receive.
`BoundModels<Entries>` names a bound registry from an interface of its entries, and
`BoundRegistry<typeof registry>` from the registry itself. `ReservedName` lists the member names a
scope or method cannot take.

## Pattern: Scopes Over A Soft-Deleted Table

A default scope hides archived rows from every read, including the row an `update` or `delete`
targets; named scopes take arguments and chain in any order with data-table's own methods.

```typescript
import { createModel } from "@sdxc/data-model";
import { lte } from "remix/data-table";

import { tasks } from "./schema.js";

export const Tasks = createModel(tasks, {
	defaultScope: (query) => query.where({ archived_at: null }),
	scopes: {
		assignedTo: (query, userId: string) => query.where({ assignee_id: userId }),
		open: (query) => query.where({ completed_at: null }),
		dueBy: (query, instant: string) => query.where(lte("due_at", instant)).orderBy("due_at", "asc"),
	},
	methods: {
		agenda(userId: string, until: string) {
			return this.assignedTo(userId).open().dueBy(until);
		},
		async restore(id: string) {
			return this.unscoped().where({ id }).update({ archived_at: null });
		},
	},
});

let tasks = Tasks.bind({ db });
await tasks.agenda(userId, today).limit(10).all(); // archived tasks never appear
await tasks.open().count(); // nor here
await tasks.update(archivedId, { title: "x" }); // NotFound: the default scope hides it
await tasks.restore(archivedId); // a bulk write through unscoped() reaches it
```

A scope refines a query and answers it, so it may call `where`, `having`, `orderBy`, `groupBy`,
`limit`, `offset` and `distinct`; anything that changes the row type belongs in a method.

## Pattern: Custom Methods That Answer Queries, Results Or Raw Rows

`this` is the bound model, so a method composes its scopes, its queries, its siblings through
`this.context.models` and, for what the builder cannot express, a raw statement on `this.db`.

```typescript
import { createModel } from "@sdxc/data-model";
import { isFailure } from "@sdxc/result";
import { sql } from "remix/data-table";

import { bookmarks } from "./schema.js";

export const Bookmarks = createModel(bookmarks, {
	optional: ["id"],
	methods: {
		onHost(host: string) {
			return this.query().where({ host }).orderBy("created_at", "desc");
		},
		async save(userId: string, url: string) {
			let existing = await this.findBy({ user_id: userId, url });
			if (existing !== null) return existing;
			let created = await this.create({ user_id: userId, url, host: new URL(url).host });
			if (isFailure(created)) throw created.error;
			await this.context.models.activity.create({ user_id: userId, kind: "bookmarked" });
			return created.data;
		},
		async topHosts(limit: number) {
			return this.db.exec(sql`
				select host, count(*) as bookmarks from bookmarks
				group by host order by bookmarks desc limit ${limit}
			`);
		},
	},
});

await ctx.models.bookmarks.onHost("example.com").limit(5).all(); // a query, still chainable
await ctx.models.bookmarks.save(userId, "https://example.com/a"); // a promise of a row
```

A method answers a promise or a model query, which is what lets a lazily loaded entry call it
before its module has loaded; a method named like a built-in member is a type error.

## Pattern: Every Callback Around A Write

Callbacks run in this order: `validate`, then `before*`, then the statement, then `after*`, and
`afterCommit` once the enclosing unit of work succeeds. `validate` and every `before*` and
`after*` callback may refuse with `fail(...)`; a refusal after the statement rolls it back where
the database has real transactions.

```typescript
import { createModel } from "@sdxc/data-model";
import { isFailure } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v7";
import { fail } from "remix/data-table";

import { publishDocument } from "./jobs.js";
import { documents } from "./schema.js";
import { slugify } from "./slugify.js";

export const Documents = createModel(documents, {
	generateId: generateUUID,
	optional: ["slug", "version"],
	callbacks: {
		async validate(values) {
			if (values.title !== undefined && values.title.trim() === "") {
				return fail("Title is required", ["title"]);
			}
		},
		async beforeCreate(values) {
			return { ...values, slug: slugify(values.title), version: 1 };
		},
		async beforeUpdate(values, _ctx, before) {
			return { ...values, version: before.version + 1 };
		},
		async beforeDelete(row) {
			if (row.published_at !== null) return fail("Unpublish the document first");
		},
		async afterCreate(row, ctx) {
			let revision = await ctx.models.revisions.create({ document_id: row.id, body: row.body });
			if (isFailure(revision)) return fail("Could not record the first revision");
		},
		async afterUpdate(row, ctx, before) {
			if (row.body === before.body) return;
			await ctx.models.revisions.create({ document_id: row.id, body: row.body });
		},
		async afterDelete(row, ctx) {
			await ctx.models.revisions.query().where({ document_id: row.id }).delete();
		},
		async afterCommit(event, ctx) {
			if (event.operation === "update" && event.changed.includes("published_at")) {
				await ctx.jobs.enqueue(publishDocument, { id: event.row.id });
			}
		},
	},
});
```

`before*` callbacks see the previous one's rewrite and the row as it stands; `afterCommit`
receives the row, the row before the write and the columns and `meta.<key>` entries that
changed, so a side effect fires only for the change it cares about.

## Pattern: Pin A Model To One Slice Of A Table

`constraints` fixes columns to values: every read filters on them, every create writes them,
and an update or delete of a row outside them answers `NotFound`. Two models over one table
then never see each other's rows.

```typescript
import { createModel } from "@sdxc/data-model";
import { fail } from "remix/data-table";

import { channels } from "./schema.js";

export const EmailChannels = createModel(channels, {
	constraints: { kind: "email" },
	optional: ["id"],
	callbacks: {
		async validate(values) {
			if (values.address !== undefined && !values.address.includes("@")) {
				return fail("Expected an email address", ["address"]);
			}
		},
	},
});

export const WebhookChannels = createModel(channels, {
	constraints: { kind: "webhook" },
	optional: ["id"],
});

let emails = EmailChannels.bind({ db });
await emails.create({ team_id, address: "ops@example.com" }); // written with kind: "email"
await emails.query().where({ team_id }).count(); // email channels only
await emails.update(webhookId, { address: "x" }); // NotFound
await emails.upsert({ id: webhookId, team_id, address: "x" }); // refused, the webhook row is left as it is
```

A constrained column is never writable: `create` and `update` drop it from the values, and
`unscoped()` lifts the default scope but keeps the constraints. `inheritance` plus `extend()`
is the same mechanism with the discriminator and the base's scopes and callbacks inherited.

## Pattern: Open-Ended Attributes As Typed Meta Fields

A key/value companion table holds attributes the main table does not have columns for; the
model declares each key once as a `field`, so rows read and write them as typed values under
`meta`.

```typescript
import { createModel, field } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v4";
import { object, string } from "remix/data-schema";

import { userMeta, users } from "./schema.js";

export const Profiles = createModel(users, {
	metaTable: { table: userMeta, foreignKey: "user_id", generateId: () => generateUUID() },
	meta: {
		locale: field.enum(["en", "es"]).default("en"),
		website: field.url(),
		links: field.list(field.url()),
		newsletter: field.boolean().default(false),
		theme: field.json(object({ accent: string() })),
		bio: field.text(),
	},
});

let profiles = Profiles.bind({ db });
let profile = await profiles.create({ email, name, meta: { locale: "es", links: [a, b] } });
profile.data.meta; // { locale: "es", website: undefined, links: [a, b], newsletter: false, ... }

await profiles.update(id, { meta: { website: "https://example.com", links: null } }); // null removes a key
await profiles.withMeta(["locale"]).where({ id }).first(); // loads one key, typed as such
await profiles.whereMeta("links", a).all(); // any item of a list field matches
await profiles.whereMeta("newsletter", true).count(); // one statement, joined on the meta table
```

Every field reads as `T | undefined` unless it declares `.default(value)`; `.required()` makes
`create` refuse a write without it, and `update` refuse `null` for it. A stored value the codec
rejects reads as missing, then as the default. `generateId` supplies the meta rows' primary key
when the table's database does not.

## Pattern: Sub-Models On A Discriminator

One table holds every post type; `inheritance` names the discriminator and each `extend()` pins
one value, inheriting the base's scopes and callbacks and adding its own meta fields.

```typescript
import { createModel, field } from "@sdxc/data-model";

import { postMeta, posts } from "./schema.js";

export const Posts = createModel(posts, {
	inheritance: "type",
	metaTable: { table: postMeta, foreignKey: "post_id" },
	scopes: { live: (query) => query.where({ deleted_at: null }) },
});

export const Articles = Posts.extend("article", {
	meta: {
		slug: field.text().required(),
		locale: field.enum(["en", "es"]).default("en"),
		tags: field.list(field.text()),
	},
	methods: {
		findBySlug(slug: string) {
			return this.live().whereMeta("slug", slug).first();
		},
	},
});

let articles = Articles.bind({ db });
let article = await articles.create({ author_id, meta: { slug: "hello", tags: ["remix"] } });
article.data.type; // "article"
article.data.meta.locale; // "en"
```

An update's `meta` touches only the keys it names, and `null` removes one. `whereMeta` joins the
meta table into the read; each further `whereMeta` on the same query resolves its owners first,
so chain the broad key first and selective ones after it.

## Pattern: Helpers Over Any Model

```typescript
import type { AnyModel, BoundModel, ModelRow } from "@sdxc/data-model";

async function forPost<M extends AnyModel<{ post_id: string }>>(
	model: BoundModel<M>,
	postId: string,
): Promise<ModelRow<M>[]> {
	return model.query().where({ post_id: postId }).all();
}

await forPost(ctx.models.comments, id); // comments rows
```

A model whose rows lack `post_id: string` fails to type-check as the argument.

## Pattern: Paging A Scope

```typescript
import { Pagination } from "@sdxc/pagination";

let page = await Pagination.byOffset(ctx.models.articles.live().orderBy("published_at", "desc"), {
	page: 1,
	perPage: 20,
});
```

`Pagination.byKeyset` owns the ordering, so hand it a scope that only filters.

## Pattern: Factories In A Test

```typescript
import { createModels } from "@sdxc/data-model";
import { createFactories, defineFactory } from "@sdxc/data-model/testing";

const UserFactory = defineFactory(Users, {
	name: ({ sample }) => sample.person.fullName(),
	email: ({ sequence }) => `user${sequence}@example.com`,
}).trait("admin", { role: "admin" });

let models = createModels({ users: Users }).bind({ db });
let factories = createFactories(models, { seed: 42 });

let admin = await factories.create(UserFactory, "admin");
await factories.createMany(UserFactory, 3);
```

Each factory draws from its own stream derived from the seed, so adding a factory leaves every
other factory's values unchanged.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/data-model": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
