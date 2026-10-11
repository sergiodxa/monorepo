# @sdxc/data-model

Models over remix/data-table tables with scopes, async callbacks and typed meta fields.

A model is a `remix/data-table` table plus named scopes, custom methods, async callbacks and
typed fields over a key/value meta table. It is defined once and bound per request, job or test
to the right database, so every member runs there without taking the database as an argument.
Rows stay the plain objects data-table returns, and every scope returns a real data-table
`Query`, so pagination, search and eager loading take them unchanged.

## Installation

```bash
npm add @sdxc/data-model
```

Tables come from `remix/data-table` in [`remix`](https://www.npmjs.com/package/remix). Writes
answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) and fail
with the `ValidationError` from [`@sdxc/validate`](https://www.npmjs.com/package/@sdxc/validate);
all three install alongside this package. The `./jobs` entry point needs
[`@sdxc/jobs`](https://www.npmjs.com/package/@sdxc/jobs), and `./testing` needs
[`@sdxc/sample`](https://www.npmjs.com/package/@sdxc/sample).

## Usage

### Define A Model

```typescript
import { createModel } from "@sdxc/data-model";
import { fail } from "remix/data-table";

import { users } from "./schema.js";

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
			return { ...values, id: values.id ?? crypto.randomUUID(), email: values.email.toLowerCase() };
		},
	},
});
```

### Bind It And Use It

```typescript
import { isFailure } from "@sdxc/result";

let users = Users.bind({ db });

let created = await users.create({ email: "Pat@Example.com", name: "Pat" });
if (isFailure(created)) return created.error.issues; // ValidationError issues

await users.find(created.data.id); // the row, or null
await users.inTeam(teamId).orderBy("name", "asc").all(); // deleted users left out
await users.unscoped().where({ id }).first(); // including deleted ones
```

Reads answer `null` for a missing row. `create`, `update`, `upsert` and `delete` answer a
`Result`; a unique or foreign-key violation comes back as a `ConstraintViolation`, a
`ValidationError` at the column the constraint covers whose `kind` names the constraint:

```typescript
import { ConstraintViolation } from "@sdxc/data-model";

let created = await users.create({ email, name });
if (isFailure(created) && created.error instanceof ConstraintViolation) {
	if (created.error.kind === "unique") return "That email is taken";
}
```

### Publish Models Per Request

```typescript
import { createModels } from "@sdxc/data-model";
import { models } from "@sdxc/data-model/router";

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

The function runs once, on the first model access, so it reads whatever earlier middleware
published. An entry written as an import loads on its first call in each invocation.

### Dispatch Side Effects After Commit

Callbacks receive a `ModelContext`, and methods read it as `this.context`. It carries `db`,
`models` (the rest of the registry, bound to the same database and unit of work) and `get(key)`,
which reads what the host context published; anything else a model reads, the app adds to the
interface the way middleware adds properties to a router's context, and supplies wherever it
binds:

```typescript
import type { BoundModels } from "@sdxc/data-model";
import type { JobEnqueuer } from "@sdxc/jobs";

import type { Teams } from "./models/teams.js";
import type { Users } from "./models/users.js";

/** The registry's entries, one per line, which `ctx.models` resolves one at a time. */
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
```

Type `models` from an interface listing the entries rather than from `typeof registry`: an
interface resolves each entry when it is read, so a method calling a sibling leaves the rest of
the registry's type alone. Two models whose unannotated methods call each other still form a
cycle; annotate the return type of one of them.

```typescript
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
			if (event.operation !== "create") return;
			await ctx.jobs.enqueue(jobs.sendWelcome, { userId: event.row.id });
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

### Type Several Registries

An app binding one registry per database types each registry's context on its own models.
`withContext` answers a `createModel` whose callbacks and `this.context` read that context:

```typescript
import type { BoundModels, ModelContext } from "@sdxc/data-model";

import { withContext } from "@sdxc/data-model";

interface FeedModels {
	feeds: typeof Feeds;
	items: typeof Items;
}

interface FeedContext extends ModelContext {
	models: BoundModels<FeedModels>;
}

export const { createModel } = withContext<FeedContext>();
```

Declare the context as an interface: an intersection type is resolved eagerly and makes the
models circular again. The registry's `bind` and middleware then require every member that
context declares.

## API

### `createModel(table, options?)`

Defines a model. Options:

- `scopes`: named refinements `(query, ...args) => query`, callable on the bound model and on
  every query from it. A scope may call `where`, `having`, `orderBy`, `groupBy`, `limit`,
  `offset` and `distinct`; `with()` and `select()` change the row type, so they belong in
  `methods`.
- `defaultScope`: a scope every read applies, including the row an update or delete targets.
  `unscoped()` reads without it.
- `methods`: custom methods, with `this` bound to the model, so a method composes its scopes,
  its queries, the other methods and `this.context`. Each answers a promise or a model query; a
  method answering a plain value, or a method or scope named like a member (see
  `ReservedName`), turns the definition into an `InvalidModel` naming it. A method's signature
  names its rows as `TableRow<typeof table>`, since `ModelRow<typeof Model>` inside the model's
  own definition refers to the definition being inferred.
- `callbacks`: `validate`, `beforeCreate`, `beforeUpdate`, `beforeDelete`, `afterCreate`,
  `afterUpdate`, `afterDelete` and `afterCommit`, all async and all receiving the
  `ModelContext`. `validate` and the `before*` callbacks fail with `fail(...)` from
  `remix/data-table`; `before*` may return rewritten values.
- `constraints`: columns pinned to fixed values. Every query filters on them, every create
  writes them, and an update or delete of a row outside them answers `NotFound`.
- `inheritance`: the discriminator column `extend()` pins sub-models on.
- `optional`: columns `create` may leave out because a callback or the database fills them,
  such as a `.default()` column, since data-table's column types record no default. Nullable
  columns and columns named `created_at` or `updated_at` are optional already.
- `metaTable` and `meta`: a key/value companion table and the typed fields read from it.

### `withContext<Context>()`

Answers `{ createModel }` typed with `Context` in place of `ModelContext`, for models whose
callbacks and methods read a context of their own, such as one registry among several.

### `definition.bind(context, host?, options?)`

Binds a model for a script, a seed or a test. `context` holds `db` and any member the app adds
to `ModelContext`; `host` is what `ctx.get` reads through to, such as a
`RequestContext`; `options.transactions` is `"database"` for an adapter with real transactions
and `"none"`, the default, for D1 and Durable Object SQLite.

### `definition.extend(value, options)`

A sub-model pinned to one value of the base's `inheritance` column, with every scope, method
and callback of the base. Its callbacks run after the base's; a scope or method named like one
of the base's is a type error.

### Bound Model

| Member                 | Answers                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `query()`, scopes      | A data-table `Query` with the model's scopes chainable     |
| `db`                   | The database it is bound to, for a method's raw statement  |
| `context`              | The model context: `models`, `get` and the app's members   |
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
| `load()`               | The bound model once a lazily loaded module has loaded     |

A single key is the column's value, also for a table declaring `primaryKey: ["id"]`; a
composite key is an object. A key of any other shape, such as a list, answers `null` from
`find` and `NotFound` from `update` and `delete`. Every `update` sets the table's `updatedAt` column, so
`update(key, {})` marks a row as changed, running the update callbacks.

`upsert(values, { conflict, update })` is one `INSERT … ON CONFLICT` statement, so it runs no
model callbacks and supplies its own `id`. `conflict` defaults to the primary key; `update`
defaults to the values without the conflict and key columns and `createdAt`, and `update: {}`
keeps a conflicting row as it is. It answers the row as it stands. A model with constraints
reads the conflict target first, so a conflicting row outside them is refused and left as it
is.

A bulk write built from a query, `users.inTeam(teamId).update({ ... }, { touch: false })`, is
data-table's own statement and runs no model callbacks; `touch: false` leaves `updatedAt` as it
is, and `returning` answers the updated rows. On a lazily loaded entry, `db` and `context`
answer before its module loads.

### `createModels(entries)`

A registry of models keyed by the name each is bound under. An entry is a model or a function
importing a module that default-exports one. `registry.bind(context, host?, options?)` binds
every entry; `models.transaction(fn)` opens a unit of work across them.

### `field`

Meta field codecs: `text`, `integer`, `number`, `boolean`, `timestamp`, `url` (`http` and
`https` only, so a stored value is safe to link to), `enum(values)`, `json(schema)` and
`list(field)`. Every field reads as `T | undefined` unless it declares
`.default(value)`; `.required()` makes `create` refuse a write without it.

### `models(registry, context, options?)` from `./router` and `./jobs`

Middleware publishing the registry bound to each request or job run as `ctx.models` (or
`options.property`), and under the `Models` context key.

### `NotFound`

The failure an update or delete answers when no row of the model has the key.

### `ConstraintViolation`

The `ValidationError` a write answers when the database refuses it for a constraint, with
`kind` (`"unique"`, `"foreign-key"`, `"not-null"` or `"check"`) and the `column` it covers.

### `defineFactory`, `createFactories` from `./testing`

Factories whose attributes draw from `@sdxc/sample` and write through the bound model.

### `overrideModel(model, build)` from `./testing`

Replaces members of a model in every binding until the returned function runs, including the
registries middleware binds per request. `build` receives the original members, so a
replacement wraps them: `overrideModel(Users, (users) => ({ create: vi.fn(users.create) }))`.

### `publishModels(ctx, registry, context, options?)` from `./testing`

Binds a registry with `ctx` as its host and publishes it as `ctx.models` and under `Models`,
for a test calling a job or route handler with a context it built.

### Types

`BoundModel<M>`, `ModelQuery<M>`, `ModelRow<M>`, `CreateValues<M>` and `UpdateValues<M>` name
a model's bound type, query, row and write inputs from `typeof Model`. `AnyModel<Shape>`
constrains a helper to models whose rows have `Shape`. `ModelContext` is what callbacks
receive; augment it to type members the app supplies at binding. `BoundModels<Entries>` names
a bound registry from an interface of its entries, for typing `models` on the context;
`BoundRegistry<typeof models>` names one from the registry, for code outside the models.
`ReservedName` lists the member names a scope or method cannot take: `where`, `having`,
`orderBy`, `groupBy`, `limit`, `offset`, `distinct`, `with`, `select`, `join`, `leftJoin`,
`rightJoin`, `withMeta`, `whereMeta`, `all`, `first`, `find`, `count`, `exists`, `insert`,
`insertMany`, `update`, `delete`, `upsert`, `query`, `from`, `findBy`, `create`, `transaction`,
`load`, `unscoped`, `db`, `context`, `then`, `catch` and `finally`.

## Patterns

### Pattern: Several Post Types In One Table

```typescript
import { createModel, field } from "@sdxc/data-model";

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

let article = await articles.create({ author_id, meta: { slug: "hello", tags: ["remix"] } });
article.data.type; // "article"
article.data.meta.locale; // "en"
```

An update's `meta` touches only the keys it names, and `null` removes one; an update naming only
meta keys still touches the table's `updatedAt` column. Writes insert the new meta rows before
deleting the older ones, so a failure between the two still reads the latest value.
`whereMeta` joins the meta table into the read, so a broad key such as a locale stays one
statement; each further `whereMeta` on the same query reads its matching owners first, so
chain the broad key first and selective ones after it.

### Pattern: Helpers Over Any Model

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

### Pattern: Paging A Scope

```typescript
import { Pagination } from "@sdxc/pagination";

let page = await Pagination.byOffset(ctx.models.articles.live().orderBy("published_at", "desc"), {
	page: 1,
	perPage: 20,
});
```

`Pagination.byKeyset` owns the ordering, so hand it a scope that only filters.

### Pattern: Factories In A Test

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
