# @pkg/data-table-sqlstorage

A `remix/data-table` `DatabaseAdapter` backed by a Cloudflare Durable Object `SqlStorage`.

## Overview

[`remix/data-table`](https://github.com/remix-run/remix) models talk to a database
through a `DatabaseAdapter`. This package implements that adapter over a Durable
Object's embedded SQLite (`ctx.storage.sql`), so the same models, queries, and
migrations you write for D1 or `node:sqlite` run unchanged inside a Durable Object.

SQL is generated with SQLite semantics. Every statement runs inside the Durable
Object's implicit transaction, so `remix/data-table` transactions are modeled as
logical tokens (savepoints are not supported). It was extracted from `apps/auth-saas`
so the multi-tenant platform's tenant Durable Object and any other DO-backed app
can share one adapter (see [ADR-011](/docs/adr/ADR-011-oidc-provider-engine-package.md)).

## Usage

### Basic Example

```typescript
import { createSQLStorageDatabaseAdapter } from "@pkg/data-table-sqlstorage";
import { DurableObject } from "cloudflare:workers";
import { createDatabase } from "remix/data-table";

export class Tenant extends DurableObject {
	#db = createDatabase(createSQLStorageDatabaseAdapter(this.ctx.storage.sql));

	async listUsers() {
		return this.#db.findMany(users);
	}
}
```

## API

### `createSQLStorageDatabaseAdapter(db: SqlStorage, options?: SqlStorageAdapterOptions): DatabaseAdapter`

Creates a `remix/data-table` `DatabaseAdapter` that executes against a Durable
Object `SqlStorage` handle.

**Parameters:**

- `db`: The `SqlStorage` handle to execute SQL against, typically `ctx.storage.sql`.
- `options.capabilities`: Optional overrides for the adapter's feature flags
  (`AdapterCapabilityOverrides` from `remix/data-table`). Defaults: `returning`,
  `upsert`, and `transactionalDdl` are `true`; `savepoints` and `migrationLock` are
  `false`.

**Returns:**

- A `DatabaseAdapter` you pass to `createDatabase(...)`.

**Example:**

```typescript
let adapter = createSQLStorageDatabaseAdapter(ctx.storage.sql);
let db = createDatabase(adapter);
```

## Pattern: Running migrations against a Durable Object

Use the adapter's `executeScript` to run raw multi-statement SQL (it splits and
executes each statement), which is how engine migrations run at DO boot:

```typescript
let adapter = createSQLStorageDatabaseAdapter(ctx.storage.sql);
await adapter.executeScript("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY);");
```

## Pattern: Hosting `@pkg/oidc-provider` in a tenant Durable Object

The adapter is what lets the host-agnostic provider run inside a DO — the host
injects it and the provider only ever sees the `DatabaseAdapter` interface:

```typescript
import { createSQLStorageDatabaseAdapter } from "@pkg/data-table-sqlstorage";
import { createOidcProvider } from "@pkg/oidc-provider";

let provider = createOidcProvider({
	database: createSQLStorageDatabaseAdapter(ctx.storage.sql),
	internalSecret: env.INTERNAL_SECRET,
});
```

## Related Packages

- [`@pkg/data-table-d1`](/packages/data-table-d1) - The same adapter for Cloudflare D1 (self-hosted / non-DO apps)
- [`@pkg/oidc-provider`](/packages/oidc-provider) - Host-agnostic OIDC provider that consumes this adapter

## Tips

1. **Pass `ctx.storage.sql`, not `ctx.storage`** - The adapter needs the SQL handle, which requires a SQLite-backed Durable Object class in your Wrangler migration.
2. **Prefer `RETURNING` over insert ids** - `returning` is enabled by default; SqlStorage has no reliable last-insert-id, so reads after writes should use `RETURNING`.
3. **Savepoints are unsupported** - Everything runs in the DO's implicit transaction; don't rely on nested savepoints.
4. **Build the adapter once per instance** - Create it in the Durable Object constructor (or once per isolate) rather than per request.
