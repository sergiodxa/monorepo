# @sdxc/data-table-sqlstorage

A `remix/data-table` database driver backed by a Cloudflare Durable Object's SQL storage.

The driver runs `remix/data-table` queries against the `SqlStorage` handle a Durable Object
owns, so a model's rows live inside the object that serves them, with JSON and boolean columns
round-tripped on the way through.

## Installation

```sh
npm add @sdxc/data-table-sqlstorage
```

The driver plugs into `remix/data-table` from [`remix`](https://www.npmjs.com/package/remix).
TypeScript projects also install `@cloudflare/workers-types` for the `SqlStorage` type.

## Usage

### Build a database inside a Durable Object

```typescript
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { DurableObject } from "cloudflare:workers";
import { Database } from "remix/data-table";

import { users } from "./schema.js";

export class Tenant extends DurableObject {
	#db = new Database(createSQLStorageDatabaseAdapter(this.ctx.storage.sql));

	async listUsers() {
		return this.#db.findMany(users, { orderBy: ["id"] });
	}
}
```

The handle belongs to the object and outlives every request, so build the database once per
instance.

### Read and write JSON and boolean columns

```typescript
import { column as c, table } from "remix/data-table";

let users = table({
	name: "users",
	columns: {
		id: c.integer().primaryKey(),
		email: c.varchar(255),
		settings: c.json(),
		active: c.boolean(),
	},
});

await db.create(users, {
	id: 1,
	email: "user@example.com",
	settings: { theme: "dark" },
	active: true,
});

let user = await db.find(users, 1);
user?.settings; // { theme: "dark" }
user?.active; // true
```

A `c.json()` value is stored as JSON text and parsed back into an object; a `c.boolean()` column
reads back as `true` or `false` instead of SQLite's `1` and `0`. `null` stays `null` in both.

### Run raw SQL

```typescript
import { sql } from "remix/data-table";

let result = await db.exec(sql`SELECT email FROM users WHERE id = ${1}`);
result.rows; // [{ email: "user@example.com" }]

let deleted = await db.exec(sql`DELETE FROM users WHERE id = ${1}`);
deleted.affectedRows; // 1
```

A statement starting with `SELECT`, `WITH` or `PRAGMA` answers rows; any other statement
answers the number of rows it wrote.

### Write atomically within one turn

Durable Object SQL storage has no transaction statements, so `db.transaction()` rejects.
Instead, every write an object makes within one turn of its event loop commits as one unit:

```typescript
async register(email: string) {
	await this.#db.create(users, { id: 1, email });
	await this.#db.create(profiles, { user_id: 1, email });
}
```

Awaiting network I/O (a `fetch`, an RPC call to another object) ends the turn, so the writes
before it and after it commit separately.

## API

### `createSQLStorageDatabaseAdapter(db: SqlStorage, options?): DatabaseDriver`

Builds the driver `new Database(...)` takes, executing against a Durable Object's
[`SqlStorage`](https://developers.cloudflare.com/durable-objects/api/sql-storage/) handle
(`ctx.storage.sql`). The driver reports the `"sqlite"` dialect.

- `options.capabilities.returning`: compile `RETURNING` clauses. Default `true`.
- `options.capabilities.upsert`: compile `INSERT … ON CONFLICT`. Default `true`.
- `options.capabilities.migrationLock`: let the migration runner take its lock. Default `false`.

`savepoints` and `transactionalDdl` are always `false`. On the returned driver:

- `executeScript(sql)` splits a multi-statement script and runs it one statement at a time. A
  semicolon inside a string literal, a quoted identifier, a comment or a `CREATE TRIGGER` body
  stays in its statement, and a script with an unclosed one throws, naming it and its line,
  before any statement runs.
- `beginTransaction()` and every commit, rollback and savepoint method reject, pointing to
  `ctx.storage.transactionSync()`.
- `wipe()` rejects; reset an object's data by migrating down or deleting its storage.
- `insertId` is reported for tables with a single-column primary key, from the `RETURNING` row
  or else from `last_insert_rowid()`.

## Pattern: Apply A Schema When The Object Boots

An object's database starts empty, so the object applies its schema before the first query.
`executeScript` takes the whole script, comments and triggers included.

```typescript
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { DurableObject } from "cloudflare:workers";
import { Database } from "remix/data-table";

let SCHEMA = `
	-- Keyset pages read (created_at, id); keep both in the index.
	CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, label TEXT, created_at TEXT);
	CREATE INDEX IF NOT EXISTS events_created ON events (created_at, id);
	CREATE TABLE IF NOT EXISTS totals (id INTEGER PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0);
	CREATE TRIGGER IF NOT EXISTS count_events AFTER INSERT ON events BEGIN
		UPDATE totals SET n = CASE WHEN n < 1000 THEN n + 1 ELSE n END WHERE id = 1;
	END;
	INSERT OR IGNORE INTO totals (id, n) VALUES (1, 0)
`;

export class Tenant extends DurableObject {
	#adapter = createSQLStorageDatabaseAdapter(this.ctx.storage.sql);
	#db = new Database(this.#adapter);

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(() => this.#adapter.executeScript(SCHEMA));
	}
}
```

With `transactionalDdl` off, the `remix/data-table` migration runner applies each migration
without a transaction and refuses one that declares it needs transactional DDL.

## Pattern: Keep A Multi-Step Write Atomic

Gather everything a write needs before the first write, so no await on network I/O falls
between two of them. Use `transactionSync` when the same unit must also cover key-value storage.

```typescript
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { DurableObject } from "cloudflare:workers";
import { Database } from "remix/data-table";

import { orders, stock } from "./schema.js";

export class Shop extends DurableObject {
	#db = new Database(createSQLStorageDatabaseAdapter(this.ctx.storage.sql));

	async order(sku: string, quantity: number) {
		let price = await fetch(`https://prices.example.com/${sku}`).then((r) => r.json());

		await this.#db.create(orders, { sku, quantity, total: price.amount * quantity });
		await this.#db.update(stock, sku, { reserved: quantity });
	}

	markShipped(orderId: string) {
		this.ctx.storage.transactionSync(() => {
			this.ctx.storage.sql.exec("UPDATE orders SET shipped = 1 WHERE id = ?", orderId);
			this.ctx.storage.kv.put(`shipped:${orderId}`, Date.now());
		});
	}
}
```

[`transactionSync`](https://developers.cloudflare.com/durable-objects/api/state/#transactionsync)
takes a synchronous callback, so async work runs before or after it.

## Pattern: Host A Storage-Agnostic Library In A Durable Object

A library that takes a `DatabaseDriver` runs wherever a driver can be built, so each object keeps
its own data.

```typescript
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { DurableObject } from "cloudflare:workers";
import { Database } from "remix/data-table";

import { createEngine } from "./engine.js";

export class Tenant extends DurableObject {
	#engine = createEngine({
		database: new Database(createSQLStorageDatabaseAdapter(this.ctx.storage.sql)),
	});
}
```

The same library runs on Cloudflare D1 with the driver from
[`@sdxc/data-table-d1`](https://www.npmjs.com/package/@sdxc/data-table-d1); its models, queries
and migrations stay the same.

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
		"@sdxc/data-table-sqlstorage": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
