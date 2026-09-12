# @sdxc/data-table-d1

A `remix/data-table` `DatabaseDriver` backed by Cloudflare D1.

`remix/data-table` models reach a database through a `DatabaseDriver`. This package
implements that interface over a [Cloudflare D1](https://developers.cloudflare.com/d1/)
binding, compiling each operation to SQLite-dialect SQL and normalizing the response
shapes D1 returns, so models, queries and raw statements run inside a Worker.

## Installation

```bash
npm add @sdxc/data-table-d1
```

The driver is built for [`remix`](https://www.npmjs.com/package/remix), which supplies the
`Database`, `table` and `column` values every example here uses, and it installs alongside
this package.

## Usage

### Query A Table

```typescript
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

`c.json()` columns are stringified on the way in and parsed on the way back, and
`c.boolean()` columns read back as `true`, `false` or `null` rather than SQLite's `1` and
`0` — on a `select` and on a `RETURNING` row alike.

### Run A Raw Statement

```typescript
let db = new Database(createD1DatabaseAdapter(env.DB));

let read = await db.exec("SELECT email FROM users WHERE id = ?", [2]);
read.rows; // [{ email: "two@example.com" }]

let write = await db.exec("DELETE FROM users WHERE id = ? RETURNING id, email", [2]);
write.rows; // the deleted rows
write.affectedRows; // 1
```

The SQL text decides how the statement is read back: one that starts with `SELECT`, `WITH`
or `PRAGMA` yields rows, and so does any statement carrying a `RETURNING` clause. Every
other write reports `affectedRows` alone.

### Observe What Each Statement Costs

```typescript
let db = new Database(
	createD1DatabaseAdapter(env.DB, {
		onStatement({ kind, table, rowsRead, rowsWritten, durationMs }) {
			console.log(kind, table, rowsRead, rowsWritten, durationMs);
		},
	}),
);
```

The numbers come from the `meta` D1 already returns with every response, so observing them
costs no extra statement and no extra billable operation.

## API

### `createD1DatabaseAdapter(db: D1Database, options?): DatabaseDriver`

Builds the driver you hand to `new Database(...)`. `db` is the D1 binding to execute
against, such as `env.DB`.

`options`:

- `capabilities`: Overrides for the driver's feature flags, as a
  `Partial<DatabaseCapabilities>` from `remix/data-table`. By default `returning`, `upsert`
  and `transactionalDdl` are `true`, and `savepoints` and `migrationLock` are `false`.
- `onStatement`: A `D1StatementObserver` called once per executed statement.

### `D1StatementObserver`

The function `onStatement` takes: it receives one `D1StatementObservation` and returns
nothing. It runs on the hot path, once per statement, so keep it cheap; anything it throws
is swallowed rather than failing the statement it was measuring.

### `D1StatementObservation`

What one executed statement cost, as D1 itself reported it.

```typescript
interface D1StatementObservation {
	/** Operation kind the statement came from (`select`, `insert`, `raw`, …). */
	kind: DataManipulationOperation["kind"];
	/** Table the operation targets, or `undefined` for a raw statement. */
	table: string | undefined;
	/** Rows D1 read from tables and indexes, 0 when unreported. */
	rowsRead: number;
	/** Rows D1 wrote to tables and indexes, 0 when unreported. */
	rowsWritten: number;
	/** Milliseconds D1 reports for the statement, 0 when unreported. */
	durationMs: number;
}
```

A statement that throws is not reported, since D1 returns no `meta` for it, and neither are
the driver's own schema probes. A count is `0` whenever D1 omits the matching `meta` field,
rather than being estimated.

### Transactions

D1 commits each statement on its own, the moment it runs. `db.transaction(...)` therefore
gives a scope rather than atomicity: a statement that succeeded before a later one threw
stays in the database. That immediacy is also what makes `create` and `update` able to
return their `RETURNING` row inside the callback.

Express an all-or-nothing write as a single SQL statement — `createMany()`, one
`UPDATE`/`DELETE`, or an upsert — and see
[Pattern: Making A Multi-Row Write Atomic](#pattern-making-a-multi-row-write-atomic). For
cross-statement atomicity, a Durable Object's SQLite storage supports it, through
[`@sdxc/data-table-sqlstorage`](https://www.npmjs.com/package/@sdxc/data-table-sqlstorage).

### Schema And Unsupported Operations

`executeScript(sql)` runs a DDL script, which covers applying a schema at boot;
[`wrangler d1 migrations apply`](https://developers.cloudflare.com/d1/reference/migrations/)
owns versioned schema changes. Savepoints and `wipe()` throw, and `close()` is a no-op,
since the Worker runtime owns the binding's lifetime.

## Pattern: Making A Multi-Row Write Atomic

One statement is the unit D1 commits, so a write that must land completely is written as
one statement. `createMany()` compiles to a single multi-row `INSERT`:

```typescript
await db.createMany(members, [
	{ id: 1, team: "core" },
	{ id: 2, team: "core" },
]);
```

A raw write with `RETURNING` extends that to work a queue claims, because the same statement
both moves the rows and reports exactly which ones this caller won, with no read-then-write
race:

```typescript
let claimed = await db.exec("UPDATE jobs SET run_at = run_at + ? WHERE run_at <= ? RETURNING id", [
	interval,
	now,
]);
```

The typed builder cannot express this, since its changes are bound values rather than SQL
expressions. `affectedRows` reads the same with the clause as without it.

## Pattern: Attributing Rows Read And Written Per Query

Cloudflare's analytics report usage per database. `onStatement` reports it per statement, so
an app can attribute row counts to the query or unit of work that caused them:

```typescript
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { Database } from "remix/data-table";

let usage = { statements: 0, rowsRead: 0, rowsWritten: 0 };

let db = new Database(
	createD1DatabaseAdapter(env.DB, {
		onStatement({ rowsRead, rowsWritten }) {
			usage.statements += 1;
			usage.rowsRead += rowsRead;
			usage.rowsWritten += rowsWritten;
		},
	}),
);
```

Accumulating into a per-request object and logging it once at the end turns the same hook
into a cost breakdown per endpoint, which is what a cost regression needs to be found.

## Pattern: Reusing The Driver Across Requests

The binding is stable for the lifetime of an isolate, so build the driver once and let every
request on that isolate share it:

```typescript
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { Database } from "remix/data-table";

let db: Database | null = null;

export default {
	async fetch(request, env) {
		db ??= new Database(createD1DatabaseAdapter(env.DB));
		return Response.json(await db.findMany(users));
	},
} satisfies ExportedHandler<Env>;
```

## Pattern: Handing The Driver To A Host-Agnostic Library

A library that takes a `DatabaseDriver` rather than opening its own connection runs wherever
the host can supply one. The host builds the driver and injects it, and the library sees only
the interface:

```typescript
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";

let engine = createEngine({ database: createD1DatabaseAdapter(env.DB) });
```

Swapping the host means swapping that one line, so the same library code runs on D1 in a
Worker and on another SQLite-backed driver elsewhere.

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
		"@sdxc/data-table-d1": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
