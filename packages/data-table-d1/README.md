# @sdxc/data-table-d1

A `remix/data-table` `DatabaseDriver` backed by Cloudflare D1.

The driver compiles every `remix/data-table` operation to SQLite-dialect SQL, runs it on a
[Cloudflare D1](https://developers.cloudflare.com/d1/) binding and normalizes what D1 returns,
so tables, queries and raw statements work inside a Worker.

## Installation

```sh
npm add @sdxc/data-table-d1
```

`Database`, `table` and `column` come from `remix/data-table` in
[`remix`](https://www.npmjs.com/package/remix), installed alongside.

## Usage

### Open a database on a D1 binding

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

### Read and write typed columns

```typescript
let settings = table({
	name: "settings",
	columns: { id: c.integer().primaryKey(), config: c.json(), enabled: c.boolean() },
});

await db.create(settings, { id: 1, config: { theme: "dark" }, enabled: true });

let row = await db.findOne(settings, { where: { id: 1 } });
row.config; // { theme: "dark" }
row.enabled; // true
```

`c.json()` columns are stored as JSON text and `c.boolean()` columns as `1`/`0`; both read back
as their JavaScript values, `null` included, from a `select` and from a `RETURNING` row alike.

### Run raw SQL

```typescript
let read = await db.exec("SELECT email FROM users WHERE id = ?", [2]);
read.rows; // [{ email: "two@example.com" }]

let removed = await db.exec("DELETE FROM users WHERE id = ? RETURNING id, email", [2]);
removed.rows; // the deleted rows
removed.affectedRows; // 1
```

A statement starting with `SELECT`, `WITH` or `PRAGMA`, or carrying a `RETURNING` clause, answers
`rows`; every other write answers `affectedRows` alone.

### Observe what each statement costs

```typescript
let db = new Database(
	createD1DatabaseAdapter(env.DB, {
		onStatement({ kind, table, rowsRead, rowsWritten, durationMs }) {
			metrics.record({ kind, table, rowsRead, rowsWritten, durationMs });
		},
	}),
);
```

The numbers come from the `meta` D1 returns with every response, so observing them adds no
statement and no billable operation.

## API

### `createD1DatabaseAdapter(db: D1Database, options?): DatabaseDriver`

The driver to hand to `new Database(...)`, executing against `db`, such as `env.DB`.

- `options.capabilities`: a `Partial<DatabaseCapabilities>` from `remix/data-table` overriding
  the driver's feature flags. `returning`, `upsert` and `transactionalDdl` default to `true`;
  `savepoints` and `migrationLock` to `false`.
- `options.onStatement`: a `D1StatementObserver` called once after every executed statement.

D1 commits each statement the moment it runs, so `db.transaction(...)` is a scope: a write that
succeeded before a later one threw stays in the database, and a `RETURNING` row is available
inside the callback. An all-or-nothing write is one statement. `executeScript(sql)` runs a
multi-statement script on the binding. Savepoints and `wipe()` throw, and `close()` leaves the
binding to the Worker runtime.

### Types

#### `D1StatementObserver`

`(observation: D1StatementObservation) => void`. It runs once per statement on the request path,
so keep it cheap; anything it throws is swallowed and the statement's result is returned as usual.

#### `D1StatementObservation`

One statement's cost as D1 reported it: `kind` (the operation, such as `select`, `insert` or
`raw`), `table` (`undefined` for a raw statement), `rowsRead`, `rowsWritten` and `durationMs`.
A count D1 leaves out reads as `0`. A statement that throws reports nothing, and neither do the
driver's own schema probes.

## Pattern: Making A Multi-Row Write Atomic

One statement is the unit D1 commits, so a write that must land completely goes out as one
statement: `createMany()` compiles to a single multi-row `INSERT`, and an upsert to one
`INSERT … ON CONFLICT`.

```typescript
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { column as c, Database, table } from "remix/data-table";

let members = table({
	name: "members",
	columns: { id: c.integer().primaryKey(), team: c.varchar(64), role: c.varchar(32) },
});

let db = new Database(createD1DatabaseAdapter(env.DB));

await db.createMany(members, [
	{ id: 1, team: "core", role: "owner" },
	{ id: 2, team: "core", role: "member" },
]);

await db
	.query(members)
	.upsert({ id: 2, team: "core", role: "admin" }, { update: { role: "admin" } });
```

For atomicity across several statements, a Durable Object's SQLite storage provides it through
[`@sdxc/data-table-sqlstorage`](https://www.npmjs.com/package/@sdxc/data-table-sqlstorage).

## Pattern: Claiming Work From A Queue

An `UPDATE … RETURNING` moves the rows and reports exactly which ones this caller claimed, in
one statement, so two Workers polling at once never claim the same job.

```typescript
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { Database } from "remix/data-table";

let db = new Database(createD1DatabaseAdapter(env.DB));
let now = Date.now();

let claimed = await db.exec(
	"UPDATE jobs SET run_at = run_at + ? WHERE run_at <= ? RETURNING id, payload",
	[60_000, now],
);

for (let job of claimed.rows) await runJob(job);
```

Raw SQL carries the `run_at + ?` expression, which the typed builder's bound values cannot.

## Pattern: Rows Read And Written Per Request

Cloudflare reports usage per database. Building the driver per request with an accumulating
observer turns `onStatement` into a cost breakdown per endpoint.

```typescript
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { Database } from "remix/data-table";

export default {
	async fetch(request, env) {
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

		let response = await handle(request, db);
		logger.info("d1 usage", { path: new URL(request.url).pathname, ...usage });
		return response;
	},
} satisfies ExportedHandler<Env>;
```

## Pattern: Reusing The Driver Across Requests

The binding is stable for an isolate's lifetime, so a driver built on the first request serves
every later one on that isolate.

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

A library that takes a `DatabaseDriver` runs wherever the host supplies one. The host builds the
driver; the library sees only the interface.

```typescript
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";

let driver = createD1DatabaseAdapter(env.DB);

await driver.executeScript(`
	CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
	CREATE INDEX IF NOT EXISTS events_name ON events (name);
`);

let engine = createEngine({ database: driver });
```

Moving the library to another host means swapping that one driver for another SQLite-backed one.
Versioned schema changes belong to
[`wrangler d1 migrations apply`](https://developers.cloudflare.com/d1/reference/migrations/).

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
