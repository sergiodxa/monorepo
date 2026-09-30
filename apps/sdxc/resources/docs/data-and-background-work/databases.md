---
title: Query D1 and Durable Object SQL
description: Run remix/data-table models on D1 or a Durable Object's SQLite, publish the database on ctx.db, and test against real SQL.
section:
    title: Data & background work
    order: 6
order: 2
lastUpdated: 2026-09-29
---

[`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) gives
you tables, typed queries and write helpers, and leaves the connection to a driver. Cloudflare
has two SQLite databases a Worker can reach: D1, a database bound to the Worker, and the SQL
storage inside a SQLite-backed Durable Object. There is a driver for each:
[`@sdxc/data-table-d1`](/api/data-table-d1) and
[`@sdxc/data-table-sqlstorage`](/api/data-table-sqlstorage).

This guide opens a database over D1, publishes it on the request context, covers the writes D1
can commit safely, moves the same models into a Durable Object, and tests all of it against real
SQLite with [`@sdxc/cloudflare-mocks`](/api/cloudflare-mocks). Declaring tables and writing
queries is `remix/data-table`'s own API, and its documentation covers it; everything here works
with whatever tables you already have.

```bash
npm add @sdxc/data-table-d1 @sdxc/data-table-sqlstorage remix
npm add -D @sdxc/cloudflare-mocks
```

## What the drivers add to your tables

Your tables and queries stay exactly as `remix/data-table` defines them. What a driver decides is
how values cross into SQLite, which has no native boolean or JSON type. Both drivers bridge them:
a `c.boolean()` column reads back as `true` or `false`, and a `c.json()` value is serialized on
the way in and parsed on the way out, on a plain read and on a `RETURNING` row alike.

## Open the database over D1

`createD1DatabaseAdapter` takes the D1 binding and returns the driver `new Database(...)` expects:

```typescript {% title="app/lib/database.ts" %}
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

export function openDatabase(): Database {
	return new Database(createD1DatabaseAdapter(env.DB));
}
```

The adapter also takes an `onStatement` observer, called once per statement with the rows read,
rows written and duration D1 already reports. Summing those per request is how you find the
endpoint whose query plan changed.

## Publish it on `ctx.db`

Handlers should read the database off the context rather than open it themselves. That keeps the
binding out of your controllers, and it gives a test one place to hand in its own database:

```typescript {% title="app/http/middleware/database.ts" %}
import type { Database as DataTable } from "remix/data-table";
import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

export const Database = createContextKey<DataTable>();

declare module "remix/router" {
	interface RequestContext {
		db: DataTable;
	}
}

export default function database(source: () => DataTable): Middleware {
	return (ctx, next) => {
		ctx.set(Database, source(), { property: "db" });
		return next();
	};
}
```

Register it as `database(openDatabase)` in the router's middleware list. The `property` option
installs the value as `ctx.db`, and the `declare module` block is what types it everywhere. A
handler then passes `ctx.db` to its queries, and a query written against `Database` runs unchanged
on either driver.

## Write what D1 can commit

D1 commits every statement on its own, the moment it runs. `db.transaction(...)` on D1 gives you
a scope, not atomicity: if the third statement throws, the first two are already in the database.
So write every change that must land completely as a single statement.

The D1 driver compiles `createMany()` to one multi-row `INSERT`, `updateMany()` and
`deleteMany()` to one `UPDATE` or `DELETE`, and a query-builder upsert to one
`INSERT … ON CONFLICT … DO UPDATE`, so each is atomic on its own. Reach for an upsert instead of
a read followed by a write, which two concurrent requests can both win. When the change is a SQL
expression the builder cannot bind, such as moving a timestamp forward, write it raw with a
`RETURNING` clause:

```typescript {% title="app/data/reminders.ts" %}
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

```typescript {% title="app/objects/tenant.ts" %}
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

`postings` is one of your own tables. Your tables and queries do not change, because they only
ever saw a `Database`. What changes is how atomicity works. SQL storage rejects `BEGIN` and
`COMMIT`, so `db.transaction()` rejects here. Instead, every write an object makes within one
turn of its event loop commits together. Two `create`
calls in a row are atomic; the same two calls with a `fetch` between them are not, because
awaiting I/O ends the turn. Gather what a write needs before the first write.

Apply the schema from the object itself, since its database exists only once the object runs.
The adapter's `executeScript` takes a whole migration file and runs it one statement at a time.

## Test against real SQL

`createD1Database()` from `@sdxc/cloudflare-mocks` is a D1 binding over an in-memory SQLite
database. It executes real SQL and autocommits each statement the way D1 does, so a malformed
query or an unbound value fails in the test instead of after a deploy. Apply the migration you
ship and hand the database to the router through the same `source` the middleware takes:

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
	await binding.exec(MIGRATION.replaceAll("\n", " "));
	return new Database(createD1DatabaseAdapter(binding));
}
```

D1's own `exec` reads each line as a statement, so flattening the file keeps one migration valid
for both. A Durable Object's database is tested the same way with `createSqlStorage()`, which also
throws on `BEGIN` exactly as the platform does. Both run on Bun and Node: the package picks
whichever built-in SQLite module the runtime has.

## Where to go next

- [Wire the router: middleware, context and services](/docs/building-remix-apps/wire-the-router)
  — how `ctx.db` sits among the rest of the middleware.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — run a nightly sweep
  against the same database.
- [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers) — keep a hot
  query out of D1 entirely.
- [Test Workers apps](/docs/operations-and-testing/testing) — drive the whole router against the
  test database.
- [`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) — declaring tables, queries, upserts and
  migrations.
