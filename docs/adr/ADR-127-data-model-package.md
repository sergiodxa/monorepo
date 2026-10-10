# ADR-127: Data Model Package

## Status

**Accepted** - 2026-10-09

## Background

Most apps in this repo already wrap their `remix/data-table` tables in a model or repository
layer: uptime and r3-auth in `app/data/`, auth-saas in `app/models/`, blog in
`app/repositories/`. Each app wrote its own, so the same pattern exists five times under three
directory names, with no shared base and different answers to the same questions: where a job is
enqueued after a write, what a list method returns for pagination, and whether a failure is a
`Result` or a throw.

This ADR adds `@sdxc/data-model` so that layer is written once: models built on a
`remix/data-table` table, bound per request to the right `Database`, with named scopes, custom
methods and async callbacks that reach the app's services. It is designed as an official `remix/data-model` would be: it keeps data-table's plain
rows and immutable queries, and composes through context keys and middleware.

## Context

### The model layers apps already have

| App       | Location            | Example                                              |
| --------- | ------------------- | ---------------------------------------------------- |
| uptime    | `app/data/`         | `apps/uptime/app/data/monitor.ts` (about 35 modules) |
| auth-saas | `app/models/`       | `apps/auth-saas/app/models/tenant.ts`                |
| blog      | `app/repositories/` | `apps/blog/app/repositories/post.ts`                 |
| r3-auth   | `app/data/`         | `apps/r3-auth/app/data/client.ts`                    |
| demo      | `app/data/`         | `apps/demo/app/data/posting.ts`                      |

The dominant shape is a class of static methods taking the database first:
`Monitor.create(ctx.db, teamId, ...)`, `Tenant.findBySlug(db, slug)`. auth-saas models also hold
their table as `static table`. Instance classes appear only where a package interface has to be
implemented, such as `FollowerRepository implements FollowerStore`, which takes the database in
its constructor. Nothing publishes models on the context; handlers import the class and pass
`ctx.db` on every call.

Where the layers disagree:

| Question                       | Answers found                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Who enqueues after a write     | The model (`Monitor.ping` enqueues `checkHttp`, `apps/uptime/app/data/monitor.ts`); the caller (`ArticlePost.create` then `ctx.jobs.enqueue`, `apps/blog/app/http/controllers/cms/articles.tsx`) |
| What a list returns for paging | Rows; a separate `*Query` variant for `Pagination.byKeyset` (about 13 uptime modules); a paged result built inside the model (`Tenant.listProvisioned`, `PostSearch.page`)                       |
| How a failure is reported      | `null` and the occasional throw in most modules; `Result` in `FollowerRepository`, blog's `user.ts` and `PostSearch`                                                                             |
| Naming                         | `findById` / `findBy<Field>` / `listBy<X>` / `listBy<X>Query`; `update` / `updateById`; `delete` / `deleteById` / `destroy`                                                                      |

The same entity is sometimes modelled twice, as `customer` is in uptime and auth-saas.

### What data-table already provides

| Capability                                   | Where                                |
| -------------------------------------------- | ------------------------------------ |
| Typed tables, relations, eager loading       | `table()`, `hasMany()`, `.with()`    |
| Immutable, reusable `Query` objects          | `query(table)`, `db.query(table)`    |
| CRUD helpers                                 | `db.find`, `db.create`, `db.update`… |
| Table hooks: `beforeWrite`, `validate`, etc. | `table({ … })`                       |
| Transactions                                 | `db.transaction()`                   |

The table hooks are **synchronous** and receive only `{ operation, tableName, value }`. They
cannot enqueue a job, send mail or read anything the request published, so they cannot hold the
side effects a model is wanted for.

### What the consumers expect

- `@sdxc/pagination` pages any value with the query methods it uses (`Pagination.byOffset`,
  `Pagination.byKeyset`); it types its input structurally, not as a concrete class.
- `@sdxc/search` returns a `SearchQuery` from `definition.query(db, parsed)`: its own object
  with `where`, `orderBy`, `limit`, `offset`, `count` and `all`, whose rows are decoded
  `SearchRow`s. It satisfies pagination's structural interfaces and is not a data-table `Query`.
- `@sdxc/validate` already defines the `ValidationError` forms render: Standard Schema issues,
  each with a `message` and a `path`.
- Per-request services are published on the context (ADR-057): a `Database` key carries the
  tenant's database, `Jobs` carries the enqueuer (`ctx.jobs.enqueue(...)`), apps declare their own
  `Mail` and similar keys.

### The three hosts

| Host           | Context          | Publishes through                   |
| -------------- | ---------------- | ----------------------------------- |
| `remix/router` | `RequestContext` | `ctx.set(key, value, { property })` |
| `@sdxc/jobs`   | `JobContext`     | `ctx.set(key, value, { property })` |
| `@sdxc/mcp`    | `RequestContext` | The request's own context, extended |

MCP tools and resources run on the request's own `RequestContext`, so whatever router middleware
publishes is already visible to them. Jobs share the `get`/`set` shape but type middleware effects
through `JobMiddleware`, so they need their own entry point.

### Database constraints

Neither Cloudflare adapter gives `db.transaction()` the meaning the word promises:

| Adapter                        | `db.transaction(fn)`                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `@sdxc/data-table-d1`          | A logical scope. Every statement commits as it runs; rollback discards nothing already written        |
| `@sdxc/data-table-sqlstorage`  | Rejects. The platform coalesces every write of one event-loop turn into one commit and has no `BEGIN` |
| `remix/data-table-sqlite`      | A real transaction, which is what tests run on                                                        |
| Nested scopes, on any of these | Need savepoints, which both Cloudflare adapters report `false`, so data-table throws                  |

data-table also commits whenever the callback resolves: a returned value, a `Failure` included,
commits; only a throw rolls back. Any callback timing that depends on commit therefore has to be
defined without a database transaction behind it, and must work where opening one throws.

### Query mechanics

`Query` keeps its state in private class fields, and every builder method clones with
`new Query(table)`. A subclass loses its prototype on the first `where()`, and a proxy that
forwards itself as `this` throws on private-field access. The wrapper that adds scopes to a query
has exactly one viable shape: a proxy whose property trap returns functions that apply the method
to the underlying query and wrap any `Query` that comes back. `instanceof` holds through it, and
`db.exec(wrapped)` works because the snapshot symbol forwards like any member.

`Query`'s five type parameters (source, column types, row, loaded relations, phase) change
through `select()` and `with()`, so a scope typed `(query) => query.where(...)` cannot re-derive
them. Scopes are restricted to the methods that keep all five fixed.

## Decision

### A model is a definition bound to a database and a context

```typescript
import { createModel } from "@sdxc/data-model";

import { users } from "./schema.js";

export const Users = createModel(users, {
	defaultScope: (query) => query.where({ deleted_at: null }),
	scopes: {
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),
	},
	callbacks: {
		async beforeCreate(values) {
			return { ...values, email: values.email.toLowerCase() };
		},
		async afterCommit(event, ctx) {
			if (event.operation !== "create") return;
			await ctx.jobs.enqueue(jobs.sendWelcome, { userId: event.row.id });
		},
	},
	methods: {
		findByEmail(email: string) {
			return this.query().where({ email: email.toLowerCase() }).first();
		},
	},
});

let users = Users.bind({ db, jobs }, context);
await users.inTeam(teamId).orderBy("name", "asc").all();
```

- `createModel(table, options)` returns an unbound definition. `definition.bind(context, host?)`
  returns the bound model every method runs on. The database is supplied once, at binding, and
  the bound model is a configured runtime object rather than a set of functions that re-take
  `db` on every call.
- Rows are the plain typed objects data-table returns. There are no record instances, no
  `user.save()` and no identity map; writes go through the bound model.
- `methods` is an object whose methods run with `this` bound to the model, so a method composes
  scopes, queries and the model's other methods with full inference, and appears on the bound
  model next to the built-ins. A factory `(model) => ({ ... })` could not type a method calling
  another, because the factory's parameter would depend on its own return type; an object typed
  through `ThisType` can.

### A default scope hides rows from every read

```typescript
export const Users = createModel(users, {
	defaultScope: (query) => query.where({ deleted_at: null }),
});

await users.find(id); // null for a soft-deleted user
await users.update(id, { name }); // NotFound for one
await users.unscoped().where({ id }).first(); // reads it, for the code that restores it
```

- The default scope applies to `query()`, every scope, `find`, `findBy`, `from()` and the row an
  update or delete targets, so soft-deleted rows stay out of every path without each call site
  remembering a scope. `unscoped()` answers a query with the model's constraints and without
  the default scope.
- A sub-model's default scope applies after the base's; both hold.

### Scopes return a real data-table `Query`

`users.query()` and every scope return a data-table `Query` wrapped so that the model's scopes are
callable on it, and every `Query` method it returns is wrapped again. Scopes therefore chain with
each other and with data-table's own methods in any order:

```typescript
let query = users.inTeam(teamId).where({ role: "admin" }).with({ posts: userPosts });

let page = await Pagination.byOffset(query, { page: 1, perPage: 25 });
```

For a model loaded up front, the wrapped value is still a `Query` (`instanceof` holds), so
pagination, search refinement and eager loading accept it unchanged. Its static type is the
model query interface rather than data-table's class: `Query` keeps private fields, so no other
type is assignable to it, and `db.exec(query)` on a wrapped query works at runtime but needs a
cast to `AnyQuery`. A lazily loaded model hands
out a deferred query instead, described under [Loading models on demand](#loading-models-on-demand).

- A scope preserves the query it receives: it may call `where`, `having`, `orderBy`, `groupBy`,
  `limit`, `offset` and `distinct`, and its result is typed as the same query type as its input.
  `with()` and `select()` change the row or loaded type, so they belong in `methods`, where the
  return type is inferred per method; a scope calling either is a type error.
- An ordering scope is still a scope, and `Pagination.byKeyset` appends its own sort after
  whatever the query carries, so `articles.newest()` handed to keyset paging would seek on the
  wrong key. `@sdxc/pagination` gains a check: `byKeyset` reads the query's snapshot and fails
  with a `Failure` when the query already orders, instead of paging wrongly.
- `BoundModel`, `ModelQuery` and the scope types are interfaces over a few plain parameters
  (row, scopes, methods, meta), never conditional types over `typeof Model`, so a helper generic
  over a model still resolves members and the type-aware lint pass stays within budget across an
  app with dozens of models.

### Bound model surface

| Member                | Returns                                    | Callbacks |
| --------------------- | ------------------------------------------ | --------- |
| `query()`, scopes     | Scoped `Query`                             | No        |
| `db`                  | The binding's database, or its transaction | No        |
| `from(query)`         | The given query, scoped                    | No        |
| `withMeta(keys)`      | `query().withMeta(keys)`                   | No        |
| `whereMeta(key, v)`   | `query().whereMeta(key, v)`                | No        |
| `find(key)`           | `Row \| null`                              | No        |
| `findBy(where)`       | `Row \| null`                              | No        |
| `create(values)`      | `Result<Row, ValidationError>`             | Yes       |
| `update(key, values)` | `Result<Row, ValidationError \| NotFound>` | Yes       |
| `upsert(values)`      | `Result<Row, ValidationError>`             | Yes       |
| `delete(key)`         | `Result<Row, ValidationError \| NotFound>` | Yes       |
| `transaction(fn)`     | Whatever `fn` returns                      | Defers    |
| `load()`              | The bound model, once its module loaded    | No        |
| Custom `methods`      | A promise or a model query                 | —         |

Reads answer `null` for a missing row. Writes answer a `Result` from `@sdxc/result`, because a
validation failure or a missing row is an expected outcome the caller branches on. `delete`
fails with a `ValidationError` too, when a `beforeDelete` callback refuses or another table's
foreign key still references the row. `key` is the
table's primary key input, a value for a single-column key and an object for a composite one.

`ValidationError` is the class `@sdxc/validate` exports, so a model failure and a form-schema
failure carry the same Standard Schema issues and render through the same code. A unique,
foreign-key, not-null or check violation is mapped into it as well, so the caller branches on
one failure type whether the model's `validate` or the index caught it. data-table wraps every
driver failure as `DataTableDatabaseError` with the driver's error as `cause`, so the mapping
reads the cause chain: SQLite and D1 name the columns (`UNIQUE constraint failed: users.email`
to `["email"]`), Postgres names the constraint (`idx_users_email` to `["email"]`).

`upsert` is the D1-safe form of a create-or-update: one statement, as `db.upsert` runs it.
Its callbacks are the create ones when the row did not exist and the update ones when it did.
Like every write it reads first: the conflicting row is looked up by the conflict target's
values (the primary key unless `conflictTarget` names others), which decides the callbacks
before the statement and names the operation `afterCommit` receives. A conflicting row the
model's constraints exclude is refused rather than updated across types.

Every write reads the row first. `db.delete` answers a boolean and `db.update` takes a key, so
the row a `delete` returns, `event.before`, `event.changed` and the constraint joined to the
`WHERE` all come from a `SELECT` before the statement, and the after-row from `RETURNING`, which
both Cloudflare adapters support. On D1 that read is not atomic with the write, so `changed` is
best-effort under concurrent updates of the same row.

`from(query)` wraps a query some other package built over the same table so the model's scopes
chain onto it. It is typed over pagination's structural `OffsetQuery` and `KeysetQuery`
interfaces, which is what a `SearchQuery` is, and only scopes that use `where`, `orderBy`,
`limit` and `offset` are callable on the result: a scope calling `having`, `groupBy` or
`distinct` is absent from its type. Rows keep the type the given query produces, so a search's
decoded rows come back as `SearchRow`s.

### Naming a model's types

The bound model's type is inferred from `createModel`, and the package exports the types that
name it, so a function can take one model without restating its members:

```typescript
import type { BoundModel, CreateValues, ModelRow } from "@sdxc/data-model";

export const Users = createModel(users, { ... });

export type UserModel = BoundModel<typeof Users>;
export type User = ModelRow<typeof Users>;

export async function registerUser(model: UserModel, values: CreateValues<typeof Users>) {
	let existing = await model.findByEmail(values.email);
	if (existing !== null) return failure(new EmailTaken(values.email));
	return model.create(values);
}

await registerUser(ctx.models.users, { email, name });
```

| Type                     | Names                                                                |
| ------------------------ | -------------------------------------------------------------------- |
| `BoundModel<typeof M>`   | The bound model: built-ins, scopes and custom methods                |
| `ModelQuery<typeof M>`   | A query from that model, with its scopes chainable                   |
| `ModelRow<typeof M>`     | A row as reads return it, constraints narrowed and `meta` decoded    |
| `CreateValues<typeof M>` | What `create()` takes: constrained columns omitted, `meta` included  |
| `UpdateValues<typeof M>` | What `update()` takes, every member optional                         |
| `AnyModel<Shape>`        | Any model definition whose rows have `Shape`; any model when omitted |

- A lazily loaded entry has exactly the bound model's type, so `ctx.models.users` satisfies
  `UserModel` whether the registry imports it up front or on demand, and a test passes
  `Users.bind({ db }, context)` to the same function.
- `CreateValues` requires every column the row type does, except the ones it can see are
  supplied elsewhere: a constrained column is omitted, a nullable column and the `created_at`
  and `updated_at` columns are optional. data-table types a table's `timestamps` names as plain
  strings, so the default names are the ones the type can see; a table with other timestamp
  names lists them in `optional`. Column types carry nullability but not defaults, so a column
  a `beforeCreate` fills (`slug` from `title`) or the database defaults is named in the model's
  `optional` list to be optional in the input; data-table itself types every write as a partial.
- The types are plain generics over the definition, so a model module exports its aliases next
  to the model, and callers import the aliases without importing the model's runtime code.

#### Helpers over any model

`AnyModel` is the constraint for a helper written once for every model. Its optional `Shape`
narrows that to models whose rows have those columns, with those types:

```typescript
async function findOr404<M extends AnyModel>(model: BoundModel<M>, id: string) {
	let row = await model.find(id);
	if (row === null) throw new Response(null, { status: 404 });
	return row; // ModelRow<M>
}

async function forPost<M extends AnyModel<{ post_id: string }>>(
	model: BoundModel<M>,
	postId: string,
) {
	return model.query().where({ post_id: postId }).all();
}

await forPost(ctx.models.comments, id); // comments has post_id: string
await forPost(ctx.models.users, id); // type error: users rows have no post_id
```

- `Shape` is checked against `ModelRow<M>`, the row as reads return it, so it names columns as
  the table spells them (`post_id`), and a `meta` member constrains decoded meta fields the same
  way (`AnyModel<{ meta: { slug?: string } }>`).
- A column must be assignable to the shape's type: a nullable `post_id` does not satisfy
  `post_id: string`, and a constrained `type: "article"` satisfies `type: string`.
- Inside the helper, the model is usable through `Shape`: `where()` accepts its columns and
  reads return at least its members, while the call site keeps the full `ModelRow<M>`. Type
  tests pin this, since it depends on TypeScript resolving members of a generic model.

### Callbacks

Callbacks are async and receive a `ModelContext`, which is extended the way a router's context
is. The package declares the database and `get`; everything else is the app's to attach:

```typescript
interface ModelContext {
	/** The database this model is bound to, or the transaction it runs in. */
	readonly db: Database;
	/** Reads a value the host context published, or `undefined` when nothing did. */
	get<Key extends object>(key: Key): ContextValue<Key> | undefined;
}
```

`get` reads through to the host context with `RequestContext.get`'s contract, answering
`undefined` for a key nothing published. A service a callback depends on is not read by key: the
app adds it to the interface, as router middleware adds `ctx.jobs` to `RequestContext`, and
every binding supplies it, so a binding that forgets one fails to type-check rather than a
callback finding `undefined` at runtime:

```typescript
/** config/model-context.d.ts */
declare module "@sdxc/data-model" {
	interface ModelContext {
		/** Enqueues jobs from the app's map, the request's or the job's own enqueuer. */
		jobs: JobEnqueuer;
		/** The invocation's log. */
		log: Log;
		/** Every model, bound to the same database and unit of work as this one. */
		models: BoundRegistry<typeof models>;
	}
}
```

`models` is how a callback reaches another model: inside a unit of work it is the set bound to
that scope, and outside a host it is the registry `bind` was called on, so a single model bound
on its own has a registry of one. The package always supplies it at runtime, and the app types
it with `BoundRegistry<typeof models>`; TypeScript resolves the registry's type lazily, so a
model whose callback reads the registry that contains it type-checks.

A model context carries services, never the invocation's language or translator. A callback
runs for every caller of the model, scripts and jobs included, so wording a message for a
reader is the controller's or the job's work: the controller enqueues the confirmation with the
request's locale, and the job renders it.

```typescript
export const Users = createModel(users, {
	callbacks: {
		async afterCreate(row, ctx) {
			ctx.log.set({ user: { id: row.id } });
		},
	},
});

router.use(modelsMiddleware(models, (ctx) => ({ db: ctx.db, jobs: ctx.jobs, log: ctx.log })));
let bound = Users.bind({ db, jobs, log }, context);
```

The middleware's function and `bind`'s first argument are typed as every `ModelContext` member
besides `get` and `models`, which the package supplies. Once the app augments the interface, a
middleware or a binding that leaves out `log` fails to type-check rather than handing a callback
an `undefined`; an app that augments nothing returns `{ db }` alone.

| Step                                            | Runs                                      | Can                   |
| ----------------------------------------------- | ----------------------------------------- | --------------------- |
| `validate(values, ctx)`                         | First, on every create, update and upsert | Fail with issues      |
| `beforeCreate`, `beforeUpdate`                  | After `validate`, before the statement    | Rewrite values, fail  |
| `beforeDelete`                                  | Before the statement                      | Fail                  |
| Table `beforeWrite`, `validate`, `beforeDelete` | Inside data-table, as the statement runs  | Fail, synchronously   |
| The statement                                   | With `RETURNING`, then table `afterWrite` | —                     |
| `afterCreate`, `afterUpdate`, `afterDelete`     | After the statement succeeds              | Read and write the db |
| `afterCommit(event)`                            | After the enclosing unit of work resolves | Dispatch side effects |

- `validate` receives the values with `meta`; on an update the primary key is merged in, so a
  uniqueness check can exclude the row itself. `beforeUpdate` and `afterUpdate` receive the
  row before the write as a third argument.
- The model `validate` callback is async and runs in addition to the table's synchronous one,
  so a uniqueness check or a lookup against another table lives on the model. The table's own
  hooks keep running inside data-table; a failure they raise as `DataTableValidationError` is
  caught and returned as the same `ValidationError` the model's callbacks produce.
- A uniqueness check in `validate` is advisory on D1, where nothing serialises the lookup and the
  insert. The unique index is the guarantee, and its `DataTableConstraintError` comes back as a
  `ValidationError` too, so the caller handles the race the same way it handles the check.
- `after*` callbacks run before the write is reported to the caller. Where the database has a
  real transaction, a failure there rolls the write back; on D1 and sqlstorage the row stays
  written and the write answers the failure, so an `after*` callback keeps to work the model
  can repeat, and anything with consequences outside the database goes in `afterCommit`.
- `afterCommit` is where jobs and mail belong, and its timing is defined by the unit of work
  rather than by a database transaction. Inside `models.transaction(fn)`, events queue and
  flush once `fn` resolves with a success, and are dropped when `fn` throws or resolves with a
  `Failure`, so a signup whose second step fails never sends a welcome email, on every adapter.
  Outside a unit of work, `afterCommit` runs right after the write's `after*` callback.
- Callbacks run for writes made through the model. A bulk write built from a query
  (`users.inTeam(teamId).update({...})`) is data-table's own operation and runs no model callbacks; it
  is the explicit escape hatch for set-based writes.

### Units of work

`models.transaction(fn)` and a bound model's `transaction(fn)` open a unit of work: `fn`
receives every model bound to the scope, `afterCommit` events defer to its end, and a database
transaction is opened only where the adapter has one.

- A returned `Failure` aborts: the scope throws a private sentinel to make data-table roll back
  where it can, catches it, drops the queued events and returns the failure to the caller. Only
  a successful return commits and flushes. This is the rule the signup example relies on, since
  data-table itself commits on any resolved callback.
- Opening a database transaction is an adapter decision, taken once at binding: data-table
  exposes no capability flag for it, so the models middleware and `bind` take
  `transactions: "database" | "none"`, defaulting to `"none"`, which is correct for both
  Cloudflare adapters; the sqlite adapter tests run on sets `"database"`. On `"none"` the scope
  wraps nothing and sqlstorage, whose `db.transaction()` rejects, is never asked for one.
- A scope opened inside another joins it: both Cloudflare adapters report `savepoints: false`,
  so a nested `db.transaction()` would throw, and the inner `fn` shares the outer queue and
  settles with it.
- The name stays `transaction` because it is what data-table and Rails call the scope; what it
  guarantees is the deferral, and atomicity only where the database provides it.

### Constraints: several models over one table

`constraints` pins columns to fixed values, so several models can share a table, as blog's
article, tutorial, like and glossary posts share `posts` today:

```typescript
export const Articles = createModel(posts, { constraints: { type: "article" } });
export const Tutorials = createModel(posts, { constraints: { type: "tutorial" } });
```

| Operation                    | Effect of `constraints: { type: "article" }`                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `query()`, scopes, `from()`  | Every query starts with `.where({ type: "article" })`, so paging and search see only articles        |
| `find(id)`, `findBy(where)`  | A row of another type answers `null`                                                                 |
| `create(values)`             | Writes `type: "article"`; the input type omits `type`                                                |
| `update(key)`, `delete(key)` | The constraint joins the `WHERE`, so another type's key answers `NotFound`; `type` cannot be changed |
| Row type                     | `type` narrows to `"article"`                                                                        |

A constrained write runs as `query().where({ id, type: "article" }).update(values, { returning })`
rather than `db.update(table, key, values)`, because the key-based helper has no place for the
constraint; the returned row is the after-row the callbacks and the `Result` carry.

A constraint is a value written on create and fixed afterwards, which fits a discriminator.
A filter whose column the model itself changes, such as `deleted_at` for soft deletes, stays a
scope.

### Sub-models: inheritance on a discriminator column

A base model that names a discriminator column can be extended once per value, the way Rails
single-table inheritance uses `type`:

```typescript
export const Posts = createModel(posts, {
	inheritance: "type",
	scopes: {
		live: (query) => query.where({ deleted_at: null }),
		published: (query) => query.where(lte("published_at", new Date().toISOString())),
	},
	callbacks: {
		async beforeDelete(row, ctx) {
			if (row.federated_at !== null) return fail("Federated posts are retracted, not deleted");
		},
	},
});

export const Articles = Posts.extend("article", {
	methods: {
		findBySlug(slug: string) {
			return this.live().published().whereMeta("slug", slug).first();
		},
	},
	callbacks: {
		async afterCommit(event, ctx) {
			if (event.operation === "create") {
				await ctx.jobs.enqueue(jobs.webmentions.send, { postId: event.row.id });
			}
		},
	},
});

export const Likes = Posts.extend("like", {});
```

- `extend(value, options)` is `createModel(table, options)` with the base's options merged in
  and `constraints: { [inheritance]: value }` added. `value` is typed as the discriminator
  column's own values, so a typo or a value the enum lacks fails to type-check.
- A sub-model has every scope and method of its base. Declaring one with a name the base
  already uses is a type error, so a name means the same query on every model sharing it.
- Callbacks stack: the base's run first, then the sub-model's, for each event. A base
  `beforeDelete` refusing to delete a federated post therefore covers every post type. Timestamp
  stamping stays with the table's own `timestamps` declaration, which data-table applies to
  every write, model or not.
- The base model reads and writes every row of the table, with the discriminator typed as the
  column's full union and only its own callbacks running. Writing through the sub-model is what
  runs the sub-model's callbacks: a base can hold lazily loaded sub-models that are not imported
  yet, so it never dispatches to them. `posts.update(key)` on an article therefore runs no
  article callback, and code that wants them writes through `articles`.
- Sub-models register like any model (`articles: Articles`, or a loader), independently of the
  base; registering the base is needed only where something uses it directly.

### Meta tables: typed fields over a key/value companion

Many schemas keep a row's open-ended attributes in a companion key/value table: blog's
`posts` + `post_meta`, WordPress's `wp_posts` + `wp_postmeta`, `wp_users` + `wp_usermeta`. A model
names the companion table once and declares typed fields over it; rows then carry a decoded
`meta` object, and writes take one.

```typescript
import { field } from "@sdxc/data-model";

export const Posts = createModel(posts, {
	inheritance: "type",
	metaTable: {
		table: postMeta,
		foreignKey: "post_id",
		/** Which row wins when a key holds several; defaults to `["updated_at", "id"]`. */
		latest: ["updated_at", "id"],
	},
});

export const Articles = Posts.extend("article", {
	meta: {
		slug: field.text().required(),
		title: field.text().required(),
		locale: field.enum(["en", "es"]).default("en"),
		excerpt: field.text(),
		canonical_url: field.url(),
		reading_minutes: field.integer(),
		tags: field.list(field.text()),
		cover: field.json(s.object({ src: s.string(), alt: s.string() })),
	},
});
```

`metaTable` names the storage: the table, the column pointing at the owner, and optionally the
`key` and `value` column names, which default to `key` and `value`, and `generateId` for a meta
table whose database assigns no primary key. `meta` declares the fields.
A sub-model inherits its base's `metaTable` and declares the fields its type uses, so articles
and likes keep different metadata in the same table, as they do in blog today.

#### Fields

The value column holds text, so each field is a codec between that text and a typed value,
validated with `remix/data-schema`:

| Field                         | Stored as        | Read as         |
| ----------------------------- | ---------------- | --------------- |
| `field.text()`                | The text         | `string`        |
| `field.integer()`, `number()` | Decimal text     | `number`        |
| `field.boolean()`             | `"1"` / `"0"`    | `boolean`       |
| `field.timestamp()`           | ISO 8601         | `string`        |
| `field.url()`                 | The URL          | `string`        |
| `field.enum(values)`          | The value        | The union       |
| `field.json(schema)`          | JSON             | The schema type |
| `field.list(field)`           | One row per item | An array        |

- A key/value table can lack any key for any row, so every field reads as `T | undefined`
  unless it declares `.default(value)`. `.required()` applies to writes: `create` fails without
  it. A stored value its codec rejects reads as missing.
- `field.list()` is the multi-valued meta WordPress has, one row per item under the same key,
  read back in insertion order. Every other field holds one value; when a key holds several
  rows anyway, the latest by `latest` wins, which is how blog resolves duplicates today.
- Keys the model does not declare are left alone, in reads and writes, so other code, or a
  different post type, can keep its own keys in the same table.

#### Reading

```typescript
let article = await ctx.models.articles.findBySlug(slug);
article?.meta.title; // string | undefined
article?.meta.locale; // "en" | "es"

let page = await Pagination.byOffset(ctx.models.articles.published().withMeta(["title", "slug"]), {
	page: 1,
	perPage: 20,
});
```

- Meta lives under `row.meta`, so a field named like a column (`status`, `title`) never shadows
  it.
- The model query eager-loads the declared keys with one extra query per result set
  (`WHERE post_id IN (...) AND key IN (...)`) and decodes them when the query runs, so a page
  costs the same two queries whether it comes from `all()` or from `Pagination`.
- `withMeta(keys)` narrows the keys loaded, and the row type with them; `withMeta([])` loads
  none. A query with a `select()` projection loads none either.

#### Querying by meta

Meta values are not columns, so they filter through `whereMeta`. data-table's predicates carry
no raw SQL, so a filter cannot compile to an `EXISTS`. The first filter on a read joins the
companion table instead: when the query runs, it is rebuilt from its snapshot with the meta
table joined on the owner's key, the filter's key and its values, every column of the owner
qualified so the shared `id` and timestamps stay unambiguous, the owner's columns selected
explicitly and the rows grouped by the owner's key, so a row matching several meta rows comes
back once and `count()` counts owners:

```typescript
let article = await ctx.models.articles.whereMeta("slug", slug).first();
let spanish = ctx.models.articles.whereMeta("locale", "es").whereMeta("tags", ["remix", "data"]);
```

- It matches any row under the key, for a list field any item; a list of values matches any of
  them. Several filters intersect. Writes prune a key's older rows right after inserting the new
  one, so a superseded value is matchable only in the window between those two statements, and
  reads still resolve each key to its latest row, so a row matched through a stale value comes
  back with the current one.
- The join binds only the filter's values, so a broad key such as a locale matching thousands
  of rows stays one statement within D1's 100 parameters. Each further filter on the same query
  reads its matching owners from the companion table first and filters by their keys, which
  binds one parameter per owner, so chain the broad key first and selective ones after it.
  `find(key)` and bulk writes take that second path for every filter: the key `find` adds and a
  bulk statement cannot carry a join.
- The lookup is served by an index on `(key, value)`, which blog already has.
- Ordering by a meta value is out of scope: a value that lists sort or page by belongs in a
  column, where keyset pagination can seek on it.

#### Writing

```typescript
let article = await ctx.models.articles.create({
	author_id: ctx.user.id,
	meta: { slug: "hello", title: "Hello", tags: ["remix", "data"] },
});

await ctx.models.articles.update(id, { meta: { title: "Hello, world", excerpt: null } });
```

- `meta` in a write is a partial: an update touches only the keys it names, and `null` removes a
  key. An update naming only meta keys still touches the table's declared `updatedAt` column at
  the database's clock, which is what a column update touches too, so a post whose title
  changed reads as updated. Field validation failures come back in the same `ValidationError`, with paths such as
  `["meta", "title"]`.
- A write inserts the new rows for every named key in one multi-row statement, split only when
  a long list would pass D1's parameter limit, then deletes the older rows of those keys in a
  second. Because reads resolve each key to its latest row, a
  failure between the two leaves reads correct, and the next write of that key removes the
  leftovers. On D1, where the two statements commit separately, this ordering is what keeps a
  post's meta consistent; inside a transaction both run atomically.
- `create` writes the owner row, then its meta. When the meta statement fails on D1, the model
  deletes the owner row it just created, and the companion table's `ON DELETE CASCADE` takes
  any meta rows with it.
- Callbacks see meta like any other value: `beforeCreate` receives `values.meta`, and
  `event.changed` names changed keys as `meta.title`.

### A registry and per-host middleware

```typescript
import { createModels } from "@sdxc/data-model";

export const models = createModels({ users: Users, posts: Posts });
```

```typescript
import { models as modelsMiddleware } from "@sdxc/data-model/router";

router.use(modelsMiddleware(models, (ctx) => ({ db: ctx.db })));

/** In a route handler, or an MCP tool mounted on the router. */
let user = await ctx.models.users.findByEmail(email);
```

```typescript
import { models as modelsMiddleware } from "@sdxc/data-model/jobs";

createJobDispatcher({
	middleware: [database(), modelsMiddleware(models, (ctx) => ({ db: ctx.database }))],
});
```

- The middleware takes a function from the host context, a `RequestContext` or a `JobContext`,
  to the model context. It can read anything earlier middleware published there, so the
  tenant's database is the one every model binds to, the app picks what callbacks see as
  properties, and the package stays unaware of tenancy and of how the app names its services.
- The function runs on the first model access in an invocation, once, so whatever it reads must
  already be on the context by then; an invocation that touches no model never runs it.
- It publishes the bound registry under the `Models` key and installs it as `ctx.models`.
  Members are bound lazily on first access, so an invocation that touches no model binds none.
- `models.bind(context, host?)` binds the whole registry outside a host, the way a model's own
  `bind` does, for scripts, seeds and tests.
- `ctx.models.transaction(async (models) => { ... })` opens a unit of work: every model in
  `models` is bound to its scope and shares one `afterCommit` queue, as described under
  [Units of work](#units-of-work).
- The registry keys are lowercase plural (`users`, `posts`, `articles`): they name bound
  instances. `ctx.models` is the property, because `ctx.data` reads as form or loader data; the
  middleware is generic over the property name, since the router types `ctx.<property>` from the
  middleware's declared effect and throws at runtime on a name the context already has.
- `@sdxc/data-model/router` covers MCP; there is no `@sdxc/data-model/mcp` entry point.

### Loading models on demand

A registry entry is either a model or a function that imports the module holding one, so an
invocation evaluates only the model modules it uses:

```typescript
export const models = createModels({
	users: Users,
	articles: () => import("~/app/models/articles.js"),
	invoices: () => import("~/app/models/invoices.js"),
});
```

```typescript
let article = await ctx.models.articles.findBySlug(slug);
let page = await Pagination.byOffset(ctx.models.articles.published().newest(), {
	page: 1,
	perPage: 20,
});
```

A lazy entry reads as a proxy with exactly the bound model's type, so call sites are the same
whether an entry is lazy or not, and an entry can move between the two without touching them.

- A lazy entry's module default-exports its model, the shape `dispatcher.map(job, () => import(...))`
  already uses for jobs.
- An async member, such as `findBySlug()` or `create()`, starts the import as it is called, binds
  the model, and calls the member with the same arguments. What it returns is a real `Promise`,
  so `instanceof Promise` holds and the call runs whether or not the caller awaits it; it settles
  with the member's own result, or rejects when the import fails.
- A member that returns a query, such as `query()`, a scope or `from()`, returns a deferred query
  synchronously. It records each chained call and replays the chain on the loaded model when a
  terminal method (`all()`, `first()`, `count()`, a write) runs, so it chains and pages exactly
  like the eager one.
- Every member a model exposes therefore returns either a promise or a model query. The type of
  `methods` enforces it: a custom method returning a plain value fails to type-check, because a
  proxy could not produce that value before the module loads.
- The import runs once per invocation, on the first member called, and the bound model is kept
  for the rest of it.
- Inside `ctx.models.transaction(async (models) => { ... })` the proxy binds the loaded model to
  the transaction.
- Model modules import tables, never other models, so loading one never pulls in another; a
  callback that needs a second model reads `ctx.models`, bound to the same scope.
- On Workers the bundle still contains every model. What the loader defers is module
  evaluation, which keeps a model's top-level work, such as building a search definition, off
  invocations that never use it.

A deferred query is a data-table `Query` only once replayed. Pagination and search take it,
since they call query methods and never test its class, but code that needs a real `Query` in
hand, such as `db.exec(query)` or an `instanceof` check, reads it from the loaded model with
`await ctx.models.articles.load()`.

### Test factories

`@sdxc/data-model/testing` defines factories over models, drawing values from `@sdxc/sample` so
a run is reproducible from its seed, and writing through the model so callbacks, constraints and
meta behave as they do in production:

```typescript
import { defineFactory } from "@sdxc/data-model/testing";

export const UserFactory = defineFactory(Users, {
	name: ({ sample }) => sample.person.fullName(),
	email: ({ sequence }) => `user${sequence}@example.com`,
	role: "member",
}).trait("admin", { role: "admin" });

export const ArticleFactory = defineFactory(Articles, {
	author_id: async ({ create }) => (await create(UserFactory)).id,
	published_at: ({ sample }) => sample.date.past().toISOString(),
	meta: ({ sample }) => ({ title: sample.lorem.sentence(), slug: sample.lorem.slug() }),
}).trait("draft", { published_at: null });
```

```typescript
import { systemSeed } from "@sdxc/random";

const SEED = Number(process.env.SAMPLE_SEED) || systemSeed();

describe(`articles (SAMPLE_SEED=${SEED})`, () => {
	let models = createModels({ users: Users, articles: Articles }).bind({
		db: createSqliteDatabase(),
	});
	let factories = createFactories(models, { seed: SEED });

	test("lists only published articles", async () => {
		let author = await factories.create(UserFactory, "admin");
		await factories.createMany(ArticleFactory, 3, { author_id: author.id });
		await factories.create(ArticleFactory, "draft", { author_id: author.id });

		expect(await models.articles.published().count()).toBe(3);
	});
});
```

- A factory is a map of attributes, each a value or a function of `{ sample, sequence, create }`
  that runs only when the call does not override that attribute; an article created with an
  `author_id` therefore creates no user.
- The attribute map is typed by `CreateValues` of its model, so a factory for `Articles` cannot
  set `type`, and its `meta` checks against the declared fields.
- `createFactories(models, { seed })` gives each factory a generator derived by the factory's
  name, so adding a factory, or calls to one, leaves every other factory's values unchanged;
  `sequence` counts per factory from one, for values that must be unique.
- `build(factory, ...)` returns the values without writing; `create` and `createMany` write
  through the bound model in the registry, so the factory exercises the same code the app does.
  A factory writes with the host the registry was bound with, so a test that sets `Mail` on
  that host observes the welcome mail a created user sends.
- `create` throws when the model's write fails, with the `ValidationError` as `cause`: a fixture
  that cannot be built fails the test where it was built, which is the outcome a test wants.
- Traits are named partial overrides applied in order before the call's own overrides.

### Package boundaries

- The package ships no tables, schemas or migrations; the app declares tables and passes them in.
- It depends on `remix` (data-table and router types), `@sdxc/result` and `@sdxc/validate`,
  whose `ValidationError` every write answers; `@sdxc/jobs` is a peer of the `./jobs` entry
  point only, and `@sdxc/sample` of the `./testing` entry point only. Logging is whatever the
  app attaches in the middleware.
- Everything it returns for querying is a data-table `Query`, or the structural query `from()`
  was given, so `@sdxc/search` needs no change and neither package takes a dependency on it.
  `@sdxc/pagination` gains one guard, `byKeyset` refusing a query that already orders, which
  stands on its own.

## Usage Examples

The examples follow one blog-like app with `users`, `articles` and `comments` tables. The tables
are ordinary `remix/data-table` declarations; only the model files are new.

### Defining models

```typescript
import { createModel } from "@sdxc/data-model";
import { Jobs } from "@sdxc/jobs/router";
import { fail, lte } from "remix/data-table";

import jobs from "~/app/jobs";
import { Mail } from "~/app/middleware/mail";
import { articleComments, articles, users } from "~/app/schema";

export const Articles = createModel(articles, {
	scopes: {
		published: (query) => query.where(lte("published_at", Date.now())),
		drafts: (query) => query.where({ published_at: null }),
		by: (query, authorId: string) => query.where({ author_id: authorId }),
		newest: (query) => query.orderBy("published_at", "desc"),
	},

	methods: {
		findBySlug(slug: string) {
			return this.published().where({ slug }).first();
		},
		withComments(id: string) {
			return this.query()
				.where({ id })
				.with({ comments: articleComments.orderBy("created_at", "asc") })
				.first();
		},
	},

	callbacks: {
		async validate(values, ctx) {
			if (values.slug === undefined) return;
			let taken = await ctx.db.findOne(articles, { where: { slug: values.slug } });
			if (taken !== null && taken.id !== values.id) return fail("Slug already taken", ["slug"]);
		},

		async beforeCreate(values) {
			return { ...values, slug: values.slug ?? slugify(values.title) };
		},

		async afterCommit(event, ctx) {
			if (event.operation === "update" && event.changed.includes("published_at")) {
				await ctx.jobs.enqueue(jobs.notifySubscribers, { articleId: event.row.id });
			}
		},
	},
});

export const Users = createModel(users, {
	defaultScope: (query) => query.where({ deleted_at: null }),

	methods: {
		findByEmail(email: string) {
			return this.query().where({ email: email.toLowerCase() }).first();
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, email: values.email.toLowerCase() };
		},

		async afterCommit(event, ctx) {
			if (event.operation !== "create") return;
			await ctx.mail.send({ to: event.row.email, template: "welcome" });
		},
	},
});
```

`event` names the operation, the row after the write, the row before it for updates and deletes,
and `changed`, the columns an update actually altered.

### Registering and wiring

```typescript
import { createModels } from "@sdxc/data-model";

export const models = createModels({
	articles: Articles,
	comments: Comments,
	users: Users,
});
```

```typescript
import { models as modelsMiddleware } from "@sdxc/data-model/router";

export const router = createRouter({
	middleware: [
		log(logger),
		database(),
		jobsMiddleware(queue),
		mail(),
		modelsMiddleware(models, (ctx) => ({
			db: ctx.db,
			jobs: ctx.jobs,
			mail: ctx.mail,
			log: ctx.log,
		})),
	],
});
```

`modelsMiddleware` runs after the middleware that publish the database and the services the
callbacks read, so its function finds every value the app's `ModelContext` declares.

### Listing with pagination

```typescript
router.map(routes.articles.index, async (ctx) => {
	let params = PAGING.parse(ctx.url.searchParams);
	if (isFailure(params)) return redirect(ctx.url.pathname);

	let page = await Pagination.byOffset(ctx.models.articles.published().newest(), {
		page: params.data.page,
		perPage: params.data.perPage,
	});
	if (isFailure(page)) throw page.error;

	return ctx.render(<ArticleList articles={page.data.items} pagination={page.data.pagination} />);
});
```

Keyset paging takes the scoped query the same way, minus the ordering scope, because `byKeyset`
owns the sort:

```typescript
let page = await Pagination.byKeyset(ctx.models.articles.published().by(authorId), {
	orderBy: [
		["published_at", "desc"],
		["id", "desc"],
	],
	cursor: params.data.cursor,
	limit: 50,
});
```

### Searching within a scope

```typescript
router.map(routes.search, async (ctx) => {
	let parsed = parseQuery(ctx.url.searchParams.get("q") ?? "", { fields: ARTICLE_SEARCH.fields });
	if (isFailure(parsed)) return new Response(parsed.error.message, { status: 400 });
	if (parsed.data === null) return ctx.render(<EmptySearch />);

	let query = ctx.models.articles.from(ARTICLE_SEARCH.query(ctx.db, parsed.data)).published();

	let page = await Pagination.byOffset(query, { page: 1, perPage: 20 });
	if (isFailure(page)) throw page.error;

	return ctx.render(<SearchResults page={page.data} parsed={parsed.data} />);
});
```

`from()` takes the `SearchQuery` as the structural query it is. `published` is callable on it
because it only adds a `where`; a scope that eager-loads or groups is absent from the wrapped
search's type, and `page.data.items` are the search's decoded rows.

### Creating from a form

```typescript
router.map(routes.articles.create, async (ctx) => {
	let input = s.parseSafe(ARTICLE_FORM, Object.fromEntries(ctx.formData));
	if (!input.success) return ctx.render(<ArticleForm issues={input.issues} />, { status: 422 });

	let article = await ctx.models.articles.create({ ...input.value, author_id: ctx.user.id });
	if (isFailure(article)) {
		return ctx.render(<ArticleForm issues={article.error.issues} />, { status: 422 });
	}

	return redirect(routes.articles.show.href({ id: article.data.id }));
});
```

The form schema checks the shape of what was submitted; the model's `validate` callback checks
what only the database can answer, such as the slug being taken. Both failures render the same
form.

### Updating and deleting

```typescript
let updated = await ctx.models.articles.update(id, { published_at: Date.now() });
if (isFailure(updated)) {
	if (updated.error instanceof NotFound) return new Response(null, { status: 404 });
	return ctx.render(<ArticleForm issues={updated.error.issues} />, { status: 422 });
}
```

Publishing an article changes `published_at`, so `Articles`' `afterCommit` enqueues
`notifySubscribers` once the update has landed.

### A transaction across models

```typescript
router.map(routes.signup, async (ctx) => {
	let result = await ctx.models.transaction(async (models) => {
		let user = await models.users.create({ email, name });
		if (isFailure(user)) return user;

		let article = await models.articles.create({
			title: "Hello, world",
			author_id: user.data.id,
		});
		if (isFailure(article)) return article;

		return user;
	});

	if (isFailure(result)) return ctx.render(<SignupForm issues={result.error.issues} />);
	return redirect(routes.dashboard.href());
});
```

The welcome mail from `Users`' `afterCommit` is queued during the unit of work and sent once
the callback resolves with a success. Had the article failed, the returned `Failure` would abort
the scope and drop the mail, on every adapter; on the sqlite adapter the user row would roll
back too, while on D1 it stays written, which is the compensating delete the caller decides on.

### In a job

```typescript
export const dispatcher = createJobDispatcher({
	logger,
	queue: cloudflare.queue(() => env.QUEUE),
	middleware: [
		database(),
		mail(),
		modelsJobMiddleware(models, (ctx) => ({
			db: ctx.require(Database),
			jobs: ctx.require(Jobs),
			mail: ctx.require(Mail),
			log: ctx.log,
		})),
	],
});
```

```typescript
export default async function notifySubscribers(ctx: JobContext<{ articleId: string }>) {
	let article = await ctx.models.articles.find(ctx.input.articleId);
	if (article === null) ctx.exit("Article no longer exists");

	let subscribers = await ctx.models.users.query().where({ subscribed: true }).all();
	await ctx.require(Mail).sendMany(subscribers.map((user) => digestFor(user, article)));
}
```

### In an MCP tool

```typescript
mcp.tools.map(toolset.findArticles, async (ctx) => {
	let articles = await ctx.models.articles
		.published()
		.by(ctx.input.authorId)
		.newest()
		.limit(10)
		.all();
	if (articles.length === 0) throw new ToolError("That author has no published articles.");
	return articles.map(({ title, slug }) => ({ title, slug }));
});
```

The MCP handler is mounted on the router, so its tools run on a request context the models
middleware has already populated.

### In a script or test

Outside a host, bind with the model context built by hand and, when callbacks read services, any
host with `get(key)`. A test uses a real `RequestContext` and sets only what the callbacks under
test read:

```typescript
let context = new RequestContext(new Request("https://example.com"));
let sent: MailMessage[] = [];
context.set(Mail, { send: async (message) => void sent.push(message) });

let users = Users.bind({ db: createSqliteDatabase(), log: new Log({ kind: "test" }) }, context);
let user = await users.create({ email: "Pat@Example.com", name: "Pat" });

expect(user).toEqual(success(expect.objectContaining({ email: "pat@example.com" })));
expect(sent).toEqual([expect.objectContaining({ to: "pat@example.com", template: "welcome" })]);
```

### Post types as sub-models

```typescript
export const models = createModels({
	posts: Posts,
	articles: () => import("~/app/models/articles.js"),
	likes: () => import("~/app/models/likes.js"),
});

/** Article archive: only articles, already live and published. */
let page = await Pagination.byKeyset(ctx.models.articles.live().published(), {
	orderBy: [
		["published_at", "desc"],
		["id", "desc"],
	],
	limit: 20,
});

/** A like is created with `type: "like"`, and none of the article callbacks run. */
await ctx.models.likes.create({ author_id: ctx.user.id, published_at: now });

/** The home feed reads every type through the base, narrowing on the discriminator. */
let feed = await ctx.models.posts.live().published().limit(50).all();
for (let post of feed) if (post.type === "article") renderArticle(post);
```

### Bulk writes, without callbacks

```typescript
await ctx.models.articles.drafts().where(lt("created_at", cutoff)).delete();
```

A delete built from a query runs as one statement and fires no model callbacks, which is what a
cleanup over thousands of rows wants. When each row needs its callbacks, iterate and call
`articles.delete(id)` per row.

## Consequences

### Positive

- **One model layer instead of five** - apps stop hand-writing the static-class pattern, and the
  questions they answer differently today (side-effect placement, paging, failures, naming) get
  one answer.
- **Paging without `*Query` twins** - every scope already returns a pageable query, so a model
  no longer needs a rows method and a query method for the same list.
- **Side effects after commit** - `afterCommit` gives job and mail dispatch the timing that
  avoids sending work for a rolled-back write.
- **No new query vocabulary** - scopes return data-table queries, so pagination, search, eager
  loading and raw SQL keep working, and existing knowledge of data-table carries over.
- **Correct database by construction** - binding through middleware means a handler cannot pick
  up another tenant's database.

### Negative

- **Wrapped queries** - scope chaining is a proxy over `Query`, which keeps private state and
  clones with `new Query`. A data-table release that changes either breaks chaining until the
  wrapper adapts, and scopes are limited to the methods that keep the query's type fixed.
- **Every write reads first** - the row a write returns, `event.before`, `event.changed` and a
  constraint's `WHERE` cost one `SELECT` before the statement, and on D1 that read is not atomic
  with the write.
- **`from()` narrows scopes** - a search query is structural, so only scopes built from `where`,
  `orderBy`, `limit` and `offset` chain onto it, and its rows are the search's, not the model's.
- **Base writes skip sub-model callbacks** - `posts.update(key)` on an article runs the base's
  callbacks only; code that wants the article's writes through `articles`.
- **Deferred queries** - a query from a lazily loaded model is a recording until it runs, so the
  rare caller that needs a real `Query` in hand awaits `load()` first, and custom methods are
  limited to returning promises or model queries.
- **Meta writes take two statements** - insert-then-prune keeps reads correct on D1, but a
  failed prune leaves superseded rows until the key is written again, and a list field read
  between the two statements can briefly show old and new items together.
- **Two write paths** - model writes run callbacks and query-built bulk writes do not. The
  distinction has to be learned, as with Rails' `update_all`.
- **Atomicity is the adapter's** - a unit of work defers side effects on every adapter but
  rolls writes back only where the database has a transaction, which neither Cloudflare adapter
  does. A multi-step D1 or sqlstorage mutation that fails midway keeps its earlier writes, and
  the caller compensates; what the scope guarantees is that no job or mail goes out for them.
- **Another layer** - a reader following a write now looks at the table hooks and the model
  callbacks.

### Neutral

- **Plain rows** - there is no Active Record instance; code that wants `user.save()` calls
  `users.update(user.id, values)`.
- **Opt-in** - apps keep using data-table directly wherever a model adds nothing.

## Implementation Plan

### Phase 1: Spec

**Priority:** High

1. Write the acceptance tests first: binding, scopes chaining into `Pagination.byOffset`, each
   callback's ordering with the table's own hooks, `afterCommit` flush on success and drop on a
   throw and on a returned `Failure`, a nested scope joining its parent, and a constraint error
   answering a `ValidationError`.
2. Run them on the sqlite adapter with real `BEGIN`/`COMMIT` for the rollback assertions, and
   again on `@sdxc/data-table-d1` over `@sdxc/cloudflare-mocks` and on sqlstorage in the Workers
   pool for the degraded contract: events still drop, earlier writes stay, nothing asks
   sqlstorage for a transaction.
3. Pin the scope typing with type tests: a scope calling `with()` or `select()` fails to
   type-check, a helper generic over `AnyModel` resolves `find` and `query`, and `CreateValues`
   requires a non-null column and accepts a nullable one omitted.

### Phase 2: Core

1. `createModel`, `bind`, scope wrapping, CRUD with callbacks, `ModelContext`.
2. `createModels`, lazy registry binding, `transaction`.
3. `constraints` and `extend` sub-models, ported against blog's `posts` types.
4. `byKeyset` in `@sdxc/pagination` fails on a query that already orders, read from the query's
   snapshot, so an ordering scope cannot silently break seeking.
5. `metaTable`, `field.*`, `withMeta` and `whereMeta`, ported against blog's `post_meta`,
   including a D1 test that fails the prune statement and asserts reads stay correct.

### Phase 3: Hosts

1. `./router` middleware, with an MCP tool reading `ctx.models` in its tests.
2. `./jobs` middleware.

### Phase 4: Testing

1. `./testing`: `defineFactory`, traits, `createFactories` over `@sdxc/sample`.
2. Replace the hand-built rows in the tests of the first ported app.

### Phase 5: Package chores

1. README, LICENSE, root README row, `apps/sdxc` group and guide, npm bootstrap.
2. Port one existing model layer to validate the API, starting with a module where the model
   already dispatches side effects (uptime's `Monitor`) and one that pairs rows with a `*Query`
   variant, then migrate the remaining apps' `data/`, `models/` and `repositories/` modules.

## Alternatives Considered

### 1. Class-based models

`class Users extends Model(users) { ... }`, with scopes and callbacks as methods and the registry
constructing an instance per request.

**Rejected because**: static members and per-request instances split the API between "unbound"
and "bound" in a way the type system shows poorly, and subclassing a factory return value is a
pattern nothing else in the Remix surface uses. The definition-plus-`bind` shape gets the same
extensibility through `methods` with inference.

### 2. Active Record instances

Rows as instances with `save()`, `destroy()` and dirty tracking.

**Rejected because**: data-table returns plain rows from every read, eager loads included, and
pagination and search hand back those rows. Instances would need wrapping on every read path and
would diverge from what the rest of the stack returns.

### 3. Callbacks as data-table table hooks

Put model behavior into `table({ beforeWrite, afterWrite })`.

**Rejected because**: those hooks are synchronous and context-free, so they cannot enqueue jobs,
send mail or read the request's services.

### 4. Keep the static-class pattern apps use today

`Users.find(db, id)`, `Users.create(db, values)`, as uptime, auth-saas and blog do now.

**Rejected because**: callbacks also need the host context, so every call would take two leading
arguments, and the middleware would still have to bind them to offer `ctx.models`. `bind({ db },
host)` keeps the "database first" order those apps use while supplying it once.

### 5. Model middleware around every query

A chain that runs before any query a model makes, able to query other models or do anything
else first.

**Rejected because**: scopes return real data-table queries that `@sdxc/pagination`, `@sdxc/search`
and eager loading execute themselves, so a middleware would run for `users.find(id)` and not for
a paged listing unless the model wrapped every execution path. Each need it would serve already
has a home:

| Need                                       | Where it lives                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| Work before a write, querying other models | `validate` and `before*` callbacks, which receive `ctx.db` and `ctx.models` |
| A filter every read applies (soft deletes) | The `defaultScope` option, with `unscoped()` to read past it                |
| Per-tenant isolation                       | The tenant's database, bound by the models middleware                       |
| Authorization                              | The route, job or tool boundary that receives the traffic                   |
| Logging or timing every query              | The database adapter, or the host's own middleware                          |
| Caching a read                             | A custom method that consults the cache first                               |

A middleware that queries other models would also trigger theirs, which needs ordering rules
and recursion guards on top.

## References

- [remix/data-table](../vendor/@remix-run/data-table/README.md)
- [ADR-057: Request context instead of a service container](./ADR-057-request-context-instead-of-a-service-container.md)
- [Rails Active Record callbacks](https://guides.rubyonrails.org/active_record_callbacks.html)
- [Laravel Eloquent query scopes](https://laravel.com/docs/eloquent#query-scopes)

## Current Progress

- [x] Phase 1: Spec: acceptance and type tests on SQLite, and the unit-of-work contract on
      SQLite, Durable Object SQLite and a real D1 binding in the Workers pool
- [x] Phase 2: Core, including the `byKeyset` guard in `@sdxc/pagination`
- [x] Phase 3: Hosts
- [x] Phase 4: Testing: `./testing`, and demo's tests seed postings through a factory
- [ ] Phase 5: Package chores: README, LICENSE, the root README row and the `apps/sdxc` group
      and guide are done, and demo and blog are ported; the npm bootstrap and the remaining
      apps' `data/`, `models/` and `repositories/` modules remain

## Notes

- Meta tables replace blog's per-type `MetaCodec` and its `articleMetaValue` duplicate
  resolution; the port of blog's posts is the acceptance case for both.
- Bulk writes skip model callbacks by design; a test pins that behavior so it reads as a contract.
- `ModelContext` had a `require(key)` and a fixed `models: AnyBoundModels` in the first version.
  Both were removed: services became augmented properties supplied at binding, like the
  router's own, and `models` is typed by the app through `BoundRegistry`.
- The name `Models` for the context key and `ctx.models` for the property are the defaults; the
  middleware accepts a different property name for an app that already uses `models`.
- The AGENTS.md rule stating `db.transaction()` is atomic on `@sdxc/data-table-sqlstorage`
  predated the adapter refusing transactions and was corrected alongside this ADR.
- The unit-of-work tests for Durable Object SQLite run the real adapter over
  `@sdxc/cloudflare-mocks`' `SqlStorage`, since the packages Workers pool declares no Durable
  Object; D1 runs against the pool's real binding.
- An atomic multi-statement meta write on D1 would need the driver to expose D1's `batch()`,
  which runs its statements in one transaction; data-table's driver interface has no such
  operation today, so insert-then-prune stays the D1 strategy until it does.
