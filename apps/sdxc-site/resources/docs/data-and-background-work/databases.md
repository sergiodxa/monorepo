---
title: Query D1 and Durable Object SQL
description: Run remix/data-table models on D1 or a Durable Object's SQLite, publish the database on ctx.db, and test against real SQL.
section:
    title: Data & background work
    order: 7
order: 2
lastUpdated: 2026-10-25
outcomes:
    - "How to open a `remix/data-table` database over D1 and publish it as `ctx.db`"
    - "How to write what D1 can commit and move models into a Durable Object"
    - "How to test against real SQL with `@sdxc/cloudflare-mocks`"
---

[`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) gives
you tables, typed queries and write helpers, and leaves the connection to a driver. Cloudflare
has two SQLite databases a Worker can reach: D1, a database bound to the Worker, and the SQL
storage inside a SQLite-backed Durable Object. There is a driver for each:
[`@sdxc/data-table-d1`](/api/data-table-d1) and
[`@sdxc/data-table-sqlstorage`](/api/data-table-sqlstorage).

This guide opens a database over D1, publishes it on the request context, covers the writes D1
can commit safely, moves the same models into a Durable Object, and tests all of it against real
SQLite with [`@sdxc/cloudflare-mocks`](/api/cloudflare-mocks). Your tables and queries stay as
`remix/data-table` defines them; both drivers bridge the types SQLite lacks, so a `c.boolean()`
column reads back as `true` or `false` and a `c.json()` value round-trips as JSON.

```bash
npm add @sdxc/data-table-d1 @sdxc/data-table-sqlstorage @sdxc/database-middleware remix
npm add -D @sdxc/cloudflare-mocks
```

## Open the database over D1

`createD1DatabaseAdapter` takes the D1 binding and returns the driver `new Database(...)` expects:

```typescript {% title="app/initializers/database.ts" %}
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

export function openDatabase(): Database {
	return new Database(createD1DatabaseAdapter(env.DB));
}
```

## Publish it on `ctx.db`

Handlers should read the database off the context rather than open it themselves. That keeps the
binding out of your controllers, and it gives a test one place to hand in its own database.
[`@sdxc/database-middleware`](/api/database-middleware) publishes it:

```typescript {% title="app/initializers/router.ts" %}
import { database } from "@sdxc/database-middleware";
import { createRouter } from "remix/router";

import { openDatabase } from "~/app/initializers/database";

export function createWebRouter(db = openDatabase()) {
	return createRouter({
		middleware: [database(db)],
	});
}
```

`database(db)` installs the instance as `ctx.db`, typed on every request context, and a query
written against `Database` runs unchanged on either driver. The `@sdxc/database-middleware/jobs`
and `@sdxc/database-middleware/cli` entry points publish the same `ctx.db` to a job dispatcher and
a command line.

## Write what D1 can commit

D1 commits every statement on its own, the moment it runs.

> [!WARNING]
> `db.transaction(...)` on D1 gives you a scope and no atomicity: if the third statement throws,
> the first two are already in the database. Write every change that must land completely as a
> single statement.

The D1 driver compiles `createMany()` to one multi-row `INSERT`, `updateMany()` and
`deleteMany()` to one `UPDATE` or `DELETE`, and a query-builder upsert to one
`INSERT … ON CONFLICT … DO UPDATE`, so each is atomic on its own. Reach for an upsert instead of
a read followed by a write, which two concurrent requests can both win. When the change is a SQL
expression the builder cannot bind, such as moving a timestamp forward, write it raw with a
`RETURNING` clause:

```typescript {% title="app/models/reminders.ts" %}
import type { Database } from "remix/data-table";

export async function claimDueReminders(db: Database, intervalMs: number) {
	let claimed = await db.exec(
		"UPDATE reminders SET run_at = run_at + ? WHERE run_at <= ? RETURNING id",
		[intervalMs, Date.now()],
	);
	return claimed.rows;
}
```

The same statement moves the rows and reports exactly which ones this caller won, with no gap
between the read and the write for another request to land in.

## Move the models into a Durable Object

A SQLite-backed Durable Object exposes its database as `ctx.storage.sql`. Build the driver once
per instance, since the handle outlives every request the object serves:

```typescript {% title="app/models/tenant.ts" %}
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { DurableObject } from "cloudflare:workers";
import { Database } from "remix/data-table";

import { postings } from "~/database/schema";

export class Tenant extends DurableObject {
	#db = new Database(createSQLStorageDatabaseAdapter(this.ctx.storage.sql));

	async listPostings() {
		return await this.#db.findMany(postings);
	}
}
```

`postings` is one of your own tables, and `bootstrap/worker.ts` re-exports the class so the
runtime can find it. Your tables and queries do not change, because they only ever saw a
`Database`. What changes is how atomicity works. SQL storage rejects `BEGIN` and
`COMMIT`, so `db.transaction()` rejects here. Instead, every write an object makes within one
turn of its event loop commits together.

> [!WARNING]
> Two `create` calls in a row are atomic; the same two calls with a `fetch` between them are not,
> because awaiting I/O ends the turn. Gather what a write needs before the first write.

Apply the schema from the object itself, since its database exists only once the object runs.
The adapter's `executeScript` takes a whole migration file and runs it one statement at a time.

## Test against real SQL

`createD1Database()` from `@sdxc/cloudflare-mocks` is a D1 binding over an in-memory SQLite
database. It executes real SQL and autocommits each statement the way D1 does, so a malformed
query or an unbound value fails in the test instead of after a deploy. Apply the migration you
ship, which the mock's `exec` runs as one `;`-separated script, and hand the database to the
router the middleware publishes it from, such as `createWebRouter(await createTestDatabase())`:

```typescript {% title="app/test/database.ts" %}
import { readFileSync } from "node:fs";

import { createD1Database } from "@sdxc/cloudflare-mocks";
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { Database } from "remix/data-table";

const MIGRATION = readFileSync(
	new URL("../../database/migrations/0001-init.sql", import.meta.url),
	"utf8",
);

export async function createTestDatabase(): Promise<Database> {
	let binding = createD1Database();
	await binding.exec(MIGRATION);
	return new Database(createD1DatabaseAdapter(binding));
}
```

The test then runs the model function against that database. Calling it twice proves the
claim is exclusive, since the second call finds nothing due:

```typescript {% title="app/models/reminders.test.ts" %}
import { expect, test } from "vitest";

import { claimDueReminders } from "~/app/models/reminders";
import { createTestDatabase } from "~/app/test/database";

test("claims each due reminder once", async () => {
	let db = await createTestDatabase();
	await db.exec("INSERT INTO reminders (id, run_at) VALUES (?, ?)", [
		"reminder-1",
		Date.now() - 1_000,
	]);

	expect(await claimDueReminders(db, 60_000)).toEqual([{ id: "reminder-1" }]);
	expect(await claimDueReminders(db, 60_000)).toEqual([]);
});
```

A Durable Object's database is tested the same way with `createSqlStorage()`, which also
throws on `BEGIN` exactly as the platform does. Both run on Bun and Node: the package picks
whichever built-in SQLite module the runtime has.

## Where to go next

- [Model your tables](/docs/data-and-background-work/data-models) — wrap these tables in
  models with scopes, callbacks and `ctx.models`.
- [Test Workers apps](/docs/operations-and-testing/testing) — drive the whole router against the
  test database.
- [Your app's command line](/docs/operations-and-testing/your-apps-command-line) — the same
  `ctx.db` in commands, and a SQL prompt over it.
