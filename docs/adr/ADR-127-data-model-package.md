# ADR-127: Data Model Package

## Status

**Proposed** - 2026-10-09

## Background

Apps in this repo declare tables with `remix/data-table` and query them directly from route
handlers, jobs and MCP tools. The rules that belong to a table end up spread across every caller:
normalizing an email before insert, the "active" filter every listing repeats, the welcome job
enqueued after a signup. Rails and Laravel collect those rules on a model. This repo has no
equivalent, so each app either repeats them or invents its own repository module.

This ADR adds `@sdxc/data-model`: models built on a `remix/data-table` table, bound per request to
the right `Database`, with named scopes, custom methods and async callbacks that reach the app's
services. It is designed as an official `remix/data-model` would be: it keeps data-table's plain
rows and immutable queries, and composes through context keys and middleware.

## Context

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
- `@sdxc/search` returns a data-table `Query` from `definition.query(db, parsed)`, which callers
  narrow with `.where()` and hand to pagination.
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

`@sdxc/data-table-d1` has no interactive transactions; `@sdxc/data-table-sqlstorage` does. Any
callback timing that depends on commit has to define what happens on D1.

## Decision

### A model is a definition bound to a database and a context

```typescript
import { createModel } from "@sdxc/data-model";
import { Jobs } from "@sdxc/jobs";

import { users } from "./schema.js";

export const Users = createModel(users, {
	scopes: {
		active: (query) => query.where({ deleted_at: null }),
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),
	},
	callbacks: {
		async beforeCreate(values) {
			return { ...values, email: values.email.toLowerCase() };
		},
		async afterCommit(event, ctx) {
			if (event.operation !== "create") return;
			await ctx.get(Jobs).enqueue(jobs.sendWelcome, { userId: event.row.id });
		},
	},
	methods: (model) => ({
		findByEmail: (email: string) => model.query().where({ email: email.toLowerCase() }).first(),
	}),
});

let users = Users.bind(db, context);
await users.active().inTeam(teamId).orderBy("name", "asc").all();
```

- `createModel(table, options)` returns an unbound definition. `definition.bind(db, context?)`
  returns the bound model every method runs on. The database is supplied once, at binding, and
  the bound model is a configured runtime object rather than a set of functions that re-take
  `db` on every call.
- Rows are the plain typed objects data-table returns. There are no record instances, no
  `user.save()` and no identity map; writes go through the bound model.
- `methods` receives the bound model, so custom methods compose scopes, queries and other
  methods with full inference, and appear on the bound model next to the built-ins.

### Scopes return a real data-table `Query`

`users.query()` and every scope return a data-table `Query` wrapped so that the model's scopes are
callable on it, and every `Query` method it returns is wrapped again. Scopes therefore chain with
each other and with data-table's own methods in any order:

```typescript
let query = users.active().inTeam(teamId).where({ role: "admin" }).with({ posts: userPosts });

let page = await Pagination.byOffset(query, { page: 1, perPage: 25 });
```

The wrapped value is still a `Query` (`instanceof` holds), so pagination, search refinement and
eager loading accept it unchanged.

### Bound model surface

| Member               | Returns                                    | Callbacks |
| -------------------- | ------------------------------------------ | --------- |
| `query()`, scopes    | Scoped `Query`                             | No        |
| `find(id)`           | `Row \| null`                              | No        |
| `findBy(where)`      | `Row \| null`                              | No        |
| `create(values)`     | `Result<Row, ValidationError>`             | Yes       |
| `update(id, values)` | `Result<Row, ValidationError \| NotFound>` | Yes       |
| `delete(id)`         | `Result<Row, NotFound>`                    | Yes       |
| `transaction(fn)`    | Whatever `fn` returns                      | Defers    |
| Custom `methods`     | Whatever each declares                     | —         |

Reads answer `null` for a missing row. Writes answer a `Result` from `@sdxc/result`, because a
validation failure or a missing row is an expected outcome the caller branches on.

### Callbacks

Callbacks are async and receive a `ModelContext`:

```typescript
interface ModelContext {
	/** The database this model is bound to, or the transaction it runs in. */
	readonly db: Database;
	/** The invocation's log. */
	readonly log: Log;
	/** Reads a value the host context published, by the same key the app's middleware uses. */
	get<Key extends object>(key: Key): ContextValue<Key>;
}
```

`get` reads through to the host context, so a callback reaches the job enqueuer, the mail
transport or the billing provider by the same keys the app's middleware already publishes
(`ctx.get(Jobs)`, `ctx.get(Mail)`). A script or test binds with its own entries instead of a
request.

| Callback                                    | Runs                                    | Can                   |
| ------------------------------------------- | --------------------------------------- | --------------------- |
| `validate(values, ctx)`                     | Before every create and update          | Fail with issues      |
| `beforeCreate`, `beforeUpdate`              | After `validate`, before the statement  | Rewrite values, fail  |
| `beforeDelete`                              | Before the statement                    | Fail                  |
| `afterCreate`, `afterUpdate`, `afterDelete` | After the statement succeeds            | Read and write the db |
| `afterCommit(event)`                        | After the enclosing transaction commits | Dispatch side effects |

- The model `validate` callback is async and runs in addition to the table's synchronous one,
  so a uniqueness check or a lookup against another table lives on the model.
- `after*` callbacks run inside the transaction when there is one; a failure there rolls the
  write back.
- `afterCommit` is where jobs and mail belong. Inside `users.transaction(...)` (or
  `models.transaction(...)`), events queue and flush once the transaction resolves, and are
  dropped when it rolls back, so a rolled-back signup never sends a welcome email. Outside a
  transaction, and always on D1, `afterCommit` runs right after the write's `after*` callback.
- Callbacks run for writes made through the model. A bulk write built from a query
  (`users.active().update({...})`) is data-table's own operation and runs no model callbacks; it
  is the explicit escape hatch for set-based writes.

### A registry and per-host middleware

```typescript
import { createModels } from "@sdxc/data-model";

export const models = createModels({ users: Users, posts: Posts });
```

```typescript
import { models as modelsMiddleware } from "@sdxc/data-model/router";

router.use(modelsMiddleware(models, { database: Database }));

/** In a route handler, or an MCP tool mounted on the router. */
let user = await ctx.models.users.findByEmail(email);
```

```typescript
import { models as modelsMiddleware } from "@sdxc/data-model/jobs";

createDispatcher(jobs, {
	middleware: [database(), modelsMiddleware(models, { database: Database })],
});
```

- The middleware reads the database another middleware already published under the given key,
  so the tenant's database is the one every model binds to and the package stays unaware of
  tenancy.
- It publishes the bound registry under the `Models` key and installs it as `ctx.models`.
  Members are bound lazily on first access, so an invocation that touches no model binds none.
- `ctx.models.transaction(async (models) => { ... })` binds every model to the transaction and
  shares one `afterCommit` queue across them.
- The registry keys are lowercase plural (`users`, `posts`): they name bound instances, and match
  the table names. `ctx.models` is the property, because `ctx.data` reads as form or loader data.
- `@sdxc/data-model/router` covers MCP; there is no `@sdxc/data-model/mcp` entry point.

### Package boundaries

- The package ships no tables, schemas or migrations; the app declares tables and passes them in.
- It depends on `remix` (data-table and router types), `@sdxc/result` and `@sdxc/logger`;
  `@sdxc/jobs` is a peer of the `./jobs` entry point only.
- Everything it returns for querying is a data-table `Query`, so `@sdxc/pagination` and
  `@sdxc/search` need no changes and take no dependency on it.

## Consequences

### Positive

- **One home for table rules** - normalization, validation, default filters and side effects
  live on the model instead of in every route, job and tool that writes the table.
- **Side effects after commit** - `afterCommit` gives job and mail dispatch the timing that
  avoids sending work for a rolled-back write.
- **No new query vocabulary** - scopes return data-table queries, so pagination, search, eager
  loading and raw SQL keep working, and existing knowledge of data-table carries over.
- **Correct database by construction** - binding through middleware means a handler cannot pick
  up another tenant's database.

### Negative

- **Wrapped queries** - scope chaining depends on every data-table `Query` method returning a
  new `Query`. A data-table release that changes this breaks chaining until the wrapper adapts.
- **Two write paths** - model writes run callbacks and query-built bulk writes do not. The
  distinction has to be learned, as with Rails' `update_all`.
- **D1 weakens `afterCommit`** - without interactive transactions, it runs per write, so a
  multi-step D1 mutation can dispatch a job for a step a later failure leaves orphaned.
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
   callback's ordering, `afterCommit` flush and drop on `@sdxc/data-table-sqlstorage`, and the
   per-write fallback on D1.
2. Back database tests with `@sdxc/cloudflare-mocks/sqlite`.

### Phase 2: Core

1. `createModel`, `bind`, scope wrapping, CRUD with callbacks, `ModelContext`.
2. `createModels`, lazy registry binding, `transaction`.

### Phase 3: Hosts

1. `./router` middleware, with an MCP tool reading `ctx.models` in its tests.
2. `./jobs` middleware.

### Phase 4: Package chores

1. README, LICENSE, root README row, `apps/sdxc` group and guide, npm bootstrap.
2. Adopt it in one app to validate the API before wider use.

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

### 4. Functions that take `db` on every call

`Users.find(db, id)`, `Users.create(db, values)`.

**Rejected because**: callbacks also need the host context, so every call would take two leading
arguments, and the middleware would still have to bind them to offer `ctx.models`.

## References

- [remix/data-table](../vendor/@remix-run/data-table/README.md)
- [ADR-057: Request context instead of a service container](./ADR-057-request-context-instead-of-a-service-container.md)
- [Rails Active Record callbacks](https://guides.rubyonrails.org/active_record_callbacks.html)
- [Laravel Eloquent query scopes](https://laravel.com/docs/eloquent#query-scopes)

## Current Progress

- [ ] Phase 1: Spec
- [ ] Phase 2: Core
- [ ] Phase 3: Hosts
- [ ] Phase 4: Package chores

## Notes

- Bulk writes skip model callbacks by design; a test pins that behavior so it reads as a contract.
- The name `Models` for the context key and `ctx.models` for the property are the defaults; the
  middleware accepts a different property name for an app that already uses `models`.
