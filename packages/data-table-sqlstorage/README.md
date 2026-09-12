# @sdxc/data-table-sqlstorage

A `remix/data-table` database driver backed by a Cloudflare Durable Object's SQL storage.

`remix/data-table` models reach a database through a driver. This one runs their queries
against the `SqlStorage` handle a Durable Object owns, so a model's rows live inside the
object that serves them, with JSON and boolean columns round-tripped on the way through.

## Installation

```bash
npm add @sdxc/data-table-sqlstorage
```

The driver plugs into the `data-table` models of
[`remix`](https://www.npmjs.com/package/remix), which installs alongside this package. The
`SqlStorage` handle it executes against comes from the Durable Objects runtime, so a
TypeScript project also wants `@cloudflare/workers-types` for that type.

## Usage

### Build A Driver From A Durable Object's SQL Handle

```typescript
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

The handle belongs to the object and outlives every request, so the driver is built once
per instance rather than per call.

### Read And Write Through Models

Models are declared the way every `remix/data-table` model is, and the driver compiles them
to SQLite text:

```typescript
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { column as c, Database, table } from "remix/data-table";

let users = table({
	name: "users",
	columns: {
		id: c.integer().primaryKey(),
		email: c.varchar(255),
		settings: c.json(),
		active: c.boolean(),
	},
});

let db = new Database(createSQLStorageDatabaseAdapter(sql));

let created = await db.create(users, {
	id: 1,
	email: "user@example.com",
	settings: { theme: "dark" },
	active: true,
});
```

SQLite stores neither JSON nor booleans natively, so the driver bridges both: a `c.json()`
value is serialized on the way in and parsed back into an object on the way out, and a
`c.boolean()` column reads back as `true` or `false` instead of the integers SQLite holds.
A nullable column keeps `null` as its own third state.

### Run A Transaction

```typescript
await db.transaction(async (tx) => {
	await tx.create(users, { id: 1, email: "first@example.com" });
	await tx.create(users, { id: 2, email: "second@example.com" });
});
```

SQL storage runs synchronously and accepts `BEGIN`, `COMMIT` and `ROLLBACK`, so the scope is
a real transaction: both rows land together, and a throw anywhere inside discards every
write the scope made. A `transaction()` nested inside another opens a savepoint, which lets
the inner scope fail while the outer one carries on.

### Run Raw SQL

```typescript
let result = await db.exec("SELECT email FROM users WHERE id = ?", [2]);
result.rows; // [{ email: "second@example.com" }]

let deleted = await db.exec("DELETE FROM users WHERE id = ?", [1]);
deleted.affectedRows; // 1
```

A raw statement carries no read/write signal of its own, so the leading keyword decides:
`SELECT`, `WITH` and `PRAGMA` come back with rows, and anything else reports how many rows
it wrote.

## API

### `createSQLStorageDatabaseAdapter(db: SqlStorage, options?): DatabaseDriver`

Builds the `DatabaseDriver` that `new Database(...)` takes. `db` is the
[`SqlStorage`](https://developers.cloudflare.com/durable-objects/api/sql-storage/) handle to
execute against, which a Durable Object exposes as `ctx.storage.sql` once its class is
SQLite-backed. The driver reports a dialect of `"sqlite"`.

`options.capabilities` overrides the feature flags the driver advertises, as a
`Partial<DatabaseCapabilities>` from `remix/data-table`. `returning`, `savepoints`, `upsert`
and `transactionalDdl` are enabled by default, and `migrationLock` is off.

The returned driver carries the full `DatabaseDriver` surface. Two members behave in a way
worth knowing:

- `executeScript(sql)` runs a multi-statement script by splitting it on `;` and executing
  each statement in turn, which is what SQL storage's one-statement-per-call `exec` needs.
- `wipe()` always rejects. The Durable Object owns its database's lifecycle, so a clean
  slate comes from migrating down or deleting the object's storage.

Reads after a write are best served by a `RETURNING` clause, which `returning` enables:
`insertId` falls back to `last_insert_rowid()`, and it is reported only for a table with a
single-column primary key.

## Pattern: Running Migrations When A Durable Object Boots

An object's database is created the first time the object runs, so the schema is applied
from the constructor or from the first call that needs it. `executeScript` takes the whole
script:

```typescript
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { DurableObject } from "cloudflare:workers";

export class Tenant extends DurableObject {
	#adapter = createSQLStorageDatabaseAdapter(this.ctx.storage.sql);

	async migrate() {
		await this.#adapter.executeScript(`
			CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL);
			CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users (email);
		`);
	}
}
```

`transactionalDdl` is on, so a migration that wraps its statements in a `transaction()` gets
the schema change and the data change committed as one unit.

## Pattern: Hosting A Storage-Agnostic Library Inside A Durable Object

A library that takes a `DatabaseDriver` rather than opening its own connection runs wherever
a driver can be built. Constructing one here is what lets such a library live inside a
Durable Object, keeping each object's data in the object itself:

```typescript
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { DurableObject } from "cloudflare:workers";

export class Tenant extends DurableObject {
	#engine = createEngine({
		database: createSQLStorageDatabaseAdapter(this.ctx.storage.sql),
	});
}
```

The same library moves to Cloudflare D1 by swapping in the driver from
[`@sdxc/data-table-d1`](https://www.npmjs.com/package/@sdxc/data-table-d1); the models,
queries and migrations above it are unchanged.

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
