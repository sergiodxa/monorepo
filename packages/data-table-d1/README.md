# @pkg/data-table-d1

A `remix/data-table` `DatabaseAdapter` backed by Cloudflare D1.

## Overview

[`remix/data-table`](https://github.com/remix-run/remix) models talk to a database
through a `DatabaseAdapter`. This package implements that adapter over a Cloudflare
D1 binding, so `remix/data-table` models, queries, and migrations run against D1 in
a Worker.

SQL is generated with SQLite semantics to match D1. `RETURNING` and upserts are
enabled by default. It was extracted from `apps/auth-saas` so self-hosted workers
and other D1-backed apps can share one adapter (see
[ADR-011](/docs/adr/ADR-011-oidc-provider-engine-package.md)).

> [!WARNING]
> **Transactions are not atomic on D1.** D1 has no interactive transactions (no
> SQL `BEGIN`/`COMMIT`/`ROLLBACK`), and its only atomic primitive, `db.batch()`,
> requires every statement up front and defers all results — which is incompatible
> with the `remix/data-table` adapter contract that each statement return its rows
> and `RETURNING` output synchronously inside the `transaction()` callback. As a
> result, `db.transaction(...)` on this adapter runs each statement immediately and
> **each one commits on its own**; if a later statement throws, the earlier writes
> are already persisted and are **not** rolled back. Savepoints are unsupported.
>
> Do not rely on `transaction()` for atomicity here. Express multi-row writes that
> must be all-or-nothing as a **single** SQL statement instead — for example
> `createMany()` (a single multi-row `INSERT`), one `UPDATE`/`DELETE`, or
> `INSERT ... ON CONFLICT` (upsert). If you need real cross-statement atomicity,
> run inside a Durable Object with
> [`@pkg/data-table-sqlstorage`](/packages/data-table-sqlstorage), whose SQLite
> backend does support atomic transactions.

## Usage

### Basic Example

```typescript
import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { createDatabase } from "remix/data-table";

export default {
	async fetch(request, env) {
		let db = createDatabase(createD1DatabaseAdapter(env.DB));
		let users = await db.findMany(usersTable);
		return Response.json(users);
	},
} satisfies ExportedHandler<Env>;
```

## API

### `createD1DatabaseAdapter(db: D1Database, options?: D1AdapterOptions): DatabaseAdapter`

Creates a `remix/data-table` `DatabaseAdapter` that executes against a Cloudflare
D1 binding.

**Parameters:**

- `db`: The D1 binding to execute SQL against (e.g. `env.DB`).
- `options.capabilities`: Optional overrides for the adapter's feature flags
  (`AdapterCapabilityOverrides` from `remix/data-table`). Defaults: `returning`,
  `upsert`, and `transactionalDdl` are `true`; `savepoints` and `migrationLock` are
  `false`.

**Returns:**

- A `DatabaseAdapter` you pass to `createDatabase(...)`.

**Example:**

```typescript
let adapter = createD1DatabaseAdapter(env.DB);
let db = createDatabase(adapter);
```

## Pattern: Caching the database per isolate

`createDatabase` is cheap, but the binding is stable for the isolate, so build the
adapter once and reuse it across requests:

```typescript
import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { createDatabase } from "remix/data-table";

let db: ReturnType<typeof createDatabase> | null = null;

export default {
	async fetch(request, env) {
		db ??= createDatabase(createD1DatabaseAdapter(env.DB));
		return Response.json(await db.findMany(usersTable));
	},
} satisfies ExportedHandler<Env>;
```

## Pattern: Self-hosting `@pkg/oidc-provider` on D1

The adapter is what lets the host-agnostic provider run on a plain Worker; the host
injects it and the provider only ever sees the `DatabaseAdapter` interface:

```typescript
import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { createOidcProvider } from "@pkg/oidc-provider";

let provider = createOidcProvider({
	database: createD1DatabaseAdapter(env.DB),
	internalSecret: await env.INTERNAL_SECRET.get(),
});
```

## Related Packages

- [`@pkg/data-table-sqlstorage`](/packages/data-table-sqlstorage) - The same adapter for a Durable Object `SqlStorage`
- [`@pkg/oidc-provider`](/packages/oidc-provider) - Host-agnostic OIDC provider that consumes this adapter

## Tips

1. **Prefer `RETURNING` over insert ids** - `returning` is enabled by default; rely on it rather than D1's `last_row_id` where possible.
2. **Transactions are not atomic; savepoints are unsupported** - D1 has no `BEGIN`/`COMMIT`/`ROLLBACK`, so `transaction()` does not roll back on failure (see the warning above). Make all-or-nothing writes a single SQL statement, and don't rely on nested savepoints.
3. **Apply migrations with `wrangler d1 migrations apply`** - Use D1's own migration tooling (or the adapter's `executeScript` at boot) rather than expecting the adapter to journal schema changes.
4. **Reuse the adapter** - Build it once per isolate instead of per request.
