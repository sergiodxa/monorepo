---
name: sdxc-data-table-sqlstorage
description: "@sdxc/data-table-sqlstorage implements the `remix/data-table` `DatabaseDriver` over a Cloudflare Durable Object's `SqlStorage` handle via `createSQLStorageDatabaseAdapter(ctx.storage.sql, options?)`, with real transactions, savepoints and JSON/boolean round-tripping. Use when a Durable Object should serve its own rows through typed models, when a migration script has to run at object boot with `executeScript`, or when a write needs cross-statement atomicity."
---

# @sdxc/data-table-sqlstorage

`remix/data-table` models reach a database through a driver; this one runs their queries against the `SqlStorage` handle a SQLite-backed Durable Object exposes as `ctx.storage.sql`, so a model's rows live inside the object that serves them. `createSQLStorageDatabaseAdapter(db, options?)` returns the `DatabaseDriver` that `new Database(...)` takes, reporting a dialect of `"sqlite"` and bridging the two types SQLite has no native form for: `c.json()` values are serialized in and parsed out, and `c.boolean()` columns read back as `true`/`false` rather than integers, with `null` kept as its own third state. Cloudflare Durable Objects only.

Full API, options and examples: [packages/data-table-sqlstorage/README.md](packages/data-table-sqlstorage/README.md)

## When to reach for it

- A Durable Object holds per-tenant or per-entity rows and should query them through typed models instead of raw SQL text.
- A write has to be all-or-nothing across several statements, which a per-statement-commit database cannot give.
- A schema has to be applied the first time an object runs, from its constructor or its first call.
- A storage-agnostic library takes a `DatabaseDriver` and should run inside a Durable Object, keeping each object's data in the object itself.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/data-table-sqlstorage": "workspace:*" } }
```

```ts
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { DurableObject } from "cloudflare:workers";
import { Database } from "remix/data-table";

export class Tenant extends DurableObject {
	#db = new Database(createSQLStorageDatabaseAdapter(this.ctx.storage.sql));

	async listUsers() {
		return this.#db.findMany(users, { orderBy: ["id"] });
	}
}
```

## Suggestions

- The SQL handle belongs to the object and outlives every request, so build the driver once per instance in a field rather than per call.
- SQL storage runs synchronously and accepts `BEGIN`, `COMMIT` and `ROLLBACK`, so `transaction()` is a real transaction: a throw anywhere inside discards every write the scope made, and a nested `transaction()` opens a savepoint so the inner scope can fail while the outer one carries on.
- `executeScript(sql)` splits a multi-statement script on `;` and runs each statement in turn, which is what SQL storage's one-statement-per-call `exec` needs — this is the migration entry point. `transactionalDdl` is on, so a migration wrapping its statements in a `transaction()` commits schema and data as one unit.
- `wipe()` always rejects: the Durable Object owns its database's lifecycle, so a clean slate comes from migrating down or deleting the object's storage.
- A raw `exec()` carries no read/write signal, so the leading keyword decides: `SELECT`, `WITH` and `PRAGMA` come back with `rows`, anything else reports `affectedRows`. Prefer a `RETURNING` clause for reads after a write; `insertId` falls back to `last_insert_rowid()` and is only reported for a single-column primary key.
- A TypeScript project needs `@cloudflare/workers-types` for the `SqlStorage` type, which comes from the Durable Objects runtime rather than from this package.

## Related

- `@sdxc/data-table-d1` — the same driver interface over a Cloudflare D1 binding; swapping one for the other leaves models, queries and migrations unchanged; skill `sdxc-data-table-d1`
