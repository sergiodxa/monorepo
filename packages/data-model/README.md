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
	scopes: {
		active: (query) => query.where({ deleted_at: null }),
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),
	},
	methods: (model) => ({
		findByEmail: (email: string) => model.active().where({ email: email.toLowerCase() }).first(),
	}),
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
await users.active().inTeam(teamId).orderBy("name", "asc").all();
```

Reads answer `null` for a missing row. `create`, `update`, `upsert` and `delete` answer a
`Result`; a unique or foreign-key violation comes back as a `ValidationError` at the column the
constraint covers, the same failure a `validate` callback produces.

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

```typescript
import { Jobs } from "@sdxc/jobs/router";

export const Users = createModel(users, {
	callbacks: {
		async afterCommit(event, ctx) {
			if (event.operation !== "create") return;
			await ctx.require(Jobs).enqueue(jobs.sendWelcome, { userId: event.row.id });
		},
	},
});

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

## API

### `createModel(table, options?)`

Defines a model. Options:

- `scopes`: named refinements `(query, ...args) => query`, callable on the bound model and on
  every query from it. A scope may call `where`, `having`, `orderBy`, `groupBy`, `limit`,
  `offset` and `distinct`; `with()` and `select()` change the row type, so they belong in
  `methods`.
- `methods`: `(model) => ({ ... })`, custom methods built from the bound model. Each returns a
  promise or a model query.
- `callbacks`: `validate`, `beforeCreate`, `beforeUpdate`, `beforeDelete`, `afterCreate`,
  `afterUpdate`, `afterDelete` and `afterCommit`, all async and all receiving the
  `ModelContext`. `validate` and the `before*` callbacks fail with `fail(...)` from
  `remix/data-table`; `before*` may return rewritten values.
- `constraints`: columns pinned to fixed values. Every query filters on them, every create
  writes them, and an update or delete of a row outside them answers `NotFound`.
- `inheritance`: the discriminator column `extend()` pins sub-models on.
- `optional`: columns `create` may leave out because a callback or the database fills them.
- `metaTable` and `meta`: a key/value companion table and the typed fields read from it.

### `definition.bind(context, host?, options?)`

Binds a model for a script, a seed or a test. `context` holds `db` and any member the app adds
to `ModelContext`; `host` is what `ctx.get` and `ctx.require` read through to, such as a
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
| `withMeta(keys)`       | A query loading only those meta keys                       |
| `whereMeta(key, v)`    | A query keeping rows holding `v` under the key             |
| `from(query)`          | Another package's query, with constraints and scopes added |
| `find(key)`            | `Row \| null`                                              |
| `findBy(where)`        | `Row \| null`                                              |
| `create(values)`       | `Result<Row, ValidationError>`                             |
| `update(key, values)`  | `Result<Row, ValidationError \| NotFound>`                 |
| `upsert(values, opts)` | `Result<Row, ValidationError>`                             |
| `delete(key)`          | `Result<Row, ValidationError \| NotFound>`                 |
| `transaction(fn)`      | Whatever `fn` returns, with `afterCommit` deferred         |
| `load()`               | The bound model once a lazily loaded module has loaded     |

A bulk write built from a query, `users.active().update({ ... })`, is data-table's own
statement and runs no model callbacks.

### `createModels(entries)`

A registry of models keyed by the name each is bound under. An entry is a model or a function
importing a module that default-exports one. `registry.bind(context, host?, options?)` binds
every entry; `models.transaction(fn)` opens a unit of work across them.

### `field`

Meta field codecs: `text`, `integer`, `number`, `boolean`, `timestamp`, `url`, `enum(values)`,
`json(schema)` and `list(field)`. Every field reads as `T | undefined` unless it declares
`.default(value)`; `.required()` makes `create` refuse a write without it.

### `models(registry, context, options?)` from `./router` and `./jobs`

Middleware publishing the registry bound to each request or job run as `ctx.models` (or
`options.property`), and under the `Models` context key.

### `NotFound`

The failure an update or delete answers when no row of the model has the key.

### `defineFactory`, `createFactories` from `./testing`

Factories whose attributes draw from `@sdxc/sample` and write through the bound model.

### Types

`BoundModel<M>`, `ModelQuery<M>`, `ModelRow<M>`, `CreateValues<M>` and `UpdateValues<M>` name
a model's bound type, query, row and write inputs from `typeof Model`. `AnyModel<Shape>`
constrains a helper to models whose rows have `Shape`. `ModelContext` is what callbacks
receive; augment it to type members the app supplies at binding.

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
	methods: (model) => ({
		findBySlug: (slug: string) => model.live().whereMeta("slug", slug).first(),
	}),
});

let article = await articles.create({ author_id, meta: { slug: "hello", tags: ["remix"] } });
article.data.type; // "article"
article.data.meta.locale; // "en"
```

An update's `meta` touches only the keys it names, and `null` removes one. Writes insert the
new meta rows before deleting the older ones, so a failure between the two still reads the
latest value. `whereMeta` reads the matching owners from the meta table first and then filters
by their keys, which suits selective keys such as a slug.

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
