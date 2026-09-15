---
name: sdxc-data-table-d1
description: "@sdxc/data-table-d1 implements the `remix/data-table` `DatabaseDriver` over a Cloudflare D1 binding via `createD1DatabaseAdapter(env.DB, options?)`, compiling models to SQLite SQL and normalizing D1's response shapes. Use when wiring `new Database(...)` to a D1 binding inside a Worker, running raw SQL with `RETURNING`, attributing rows read and written per statement with `onStatement`, or reasoning about why `db.transaction()` on D1 is a scope rather than atomic."
---

# @sdxc/data-table-d1

`remix/data-table` models reach a database through a `DatabaseDriver`. This package implements that interface over a [Cloudflare D1](https://developers.cloudflare.com/d1/) binding: `createD1DatabaseAdapter(db, options?)` returns the driver you hand to `new Database(...)`. It compiles each operation to SQLite-dialect SQL, normalizes what D1 returns (`c.json()` columns parsed back, `c.boolean()` columns read as `true`/`false` rather than `1`/`0`, on selects and `RETURNING` rows alike), and exposes D1's own per-statement `meta` through an `onStatement` observer. Cloudflare Workers only — the binding comes from the Worker runtime.

Full API, options and examples: [packages/data-table-d1/README.md](packages/data-table-d1/README.md)

## When to reach for it

- A Worker holds a D1 binding and the data access should be typed models rather than hand-written SQL strings.
- A library takes a `DatabaseDriver` instead of opening its own connection, and the host has to supply one.
- Row counts have to be attributed per query or per endpoint, rather than per database the way Cloudflare's analytics reports them.
- A multi-row write has to land completely, and the code currently assumes `transaction()` gives that.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/data-table-d1": "workspace:*" } }
```

```ts
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { column as c, Database, table } from "remix/data-table";

let users = table({
	name: "users",
	columns: { id: c.integer().primaryKey(), email: c.varchar(255) },
});

export default {
	async fetch(request, env) {
		let db = new Database(createD1DatabaseAdapter(env.DB));
		return Response.json(await db.findMany(users));
	},
} satisfies ExportedHandler<Env>;
```

## Suggestions

- D1 commits each statement on its own, the moment it runs, so `db.transaction(...)` gives a scope and not atomicity: a statement that succeeded before a later one threw stays in the database. Express an all-or-nothing write as one statement — `createMany()`, a single `UPDATE`/`DELETE`, or an upsert. Cross-statement atomicity needs a Durable Object's SQL storage instead.
- The binding is stable for the lifetime of an isolate, so build the driver once at module scope and let every request on that isolate share it.
- `onStatement` runs on the hot path once per statement and reads numbers D1 already returned, so it costs no extra billable operation; keep the callback cheap, and note that anything it throws is swallowed. A statement that threw is not reported at all, since D1 returns no `meta` for it.
- The SQL text decides how a raw `exec()` is read back: `SELECT`, `WITH`, `PRAGMA` or any statement carrying `RETURNING` yields `rows`; every other write reports `affectedRows` alone.
- Savepoints and `wipe()` throw and `close()` is a no-op. `executeScript(sql)` covers applying a schema at boot; versioned schema changes belong to `wrangler d1 migrations apply`.

## Related

- `@sdxc/data-table-sqlstorage` — the same driver interface over a Durable Object's SQL storage, where transactions are real; skill `sdxc-data-table-sqlstorage`
