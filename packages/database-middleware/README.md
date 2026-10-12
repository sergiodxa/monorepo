# @sdxc/database-middleware

Middleware that publishes a [`remix/data-table`](https://www.npmjs.com/package/remix) database as `ctx.db` on a request or a job.

## Installation

```sh
npm add @sdxc/database-middleware
```

It runs on a `remix/router` middleware chain, so [`remix`](https://www.npmjs.com/package/remix) installs alongside it. The `./jobs` entry point runs on an [`@sdxc/jobs`](https://www.npmjs.com/package/@sdxc/jobs) dispatcher; install that package when you use it.

## Usage

### Publish the database on requests

```typescript
import { database } from "@sdxc/database-middleware";
import { Database, sql } from "remix/data-table";
import { createRouter } from "remix/router";

let db = new Database(adapter);
let router = createRouter({ middleware: [database(db)] });

router.get("/posts", async (ctx) => {
	let posts = await ctx.db.exec(sql`select * from posts`);
	return Response.json(posts.rows);
});
```

`database(db)` stands in for a context key and a middleware setting it:

```typescript
import type { Database } from "remix/data-table";
import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

let DatabaseKey = createContextKey<Database>();

function publishDatabase(db: Database): Middleware {
	return (ctx, next) => {
		ctx.set(DatabaseKey, db, { property: "db" });
		return next();
	};
}
```

### Read it by key

Code that receives a context without knowing which middleware ran reads the same instance through the `Database` key:

```typescript
import type { RequestContext } from "remix/router";

import { Database } from "@sdxc/database-middleware";
import { sql } from "remix/data-table";

function countPosts(ctx: RequestContext) {
	return ctx.get(Database).exec(sql`select count(*) as total from posts`);
}
```

### Publish it on jobs

`@sdxc/database-middleware/jobs` exports a `database()` for a job dispatcher, under the same key, so a job handler reads `ctx.db` the way a route does:

```typescript
import { database } from "@sdxc/database-middleware/jobs";
import { createJobDispatcher } from "@sdxc/jobs";

let dispatcher = createJobDispatcher({ middleware: [database(db)] as const });
```

## API

### `database(db: Database): Middleware`

Returns router middleware that sets `db` as `ctx.db` and under the `Database` key on every request it runs for. A router derived from the middleware list types `ctx.db`, and importing the package adds `db` to `remix/router`'s `RequestContext`.

### `database(db: Database | (() => Database)): JobMiddleware` from `./jobs`

Returns job middleware that sets the database as `ctx.db` and under the `Database` key on every job run. A function is called once per run, so each run reads the instance it returns.

### `Database`

The context key both middlewares publish under; `ctx.get(Database)` returns the same object as `ctx.db`. Both entry points export it.

## Pattern: In-memory database in tests

The middleware publishes whichever instance it is given, so a test builds the real router over an in-memory SQLite database.

```typescript
import { DatabaseSync } from "node:sqlite";

import { database } from "@sdxc/database-middleware";
import { sql } from "remix/data-table";
import { createSqliteDatabase } from "remix/data-table/sqlite";
import { createRouter } from "remix/router";

let db = createSqliteDatabase(new DatabaseSync(":memory:"));
let router = createRouter({ middleware: [database(db)] });

router.get("/answer", async (ctx) => {
	let result = await ctx.db.exec(sql`select 41 + 1 as answer`);
	return Response.json(result.rows);
});

let response = await router.fetch("https://example.com/answer");
```

## Pattern: One database per job run

A long-lived dispatcher takes a function, so each run opens the database its source returns, and a test swaps in a fresh one between deliveries.

```typescript
import { DatabaseSync } from "node:sqlite";

import { database } from "@sdxc/database-middleware/jobs";
import { createJobDispatcher, createJobHandler, job, jobs } from "@sdxc/jobs";
import { sql } from "remix/data-table";
import { createSqliteDatabase } from "remix/data-table/sqlite";

let JOBS = jobs({ sweep: job({ cron: "0 0 * * *" }) });

let current = createSqliteDatabase(new DatabaseSync(":memory:"));

let dispatcher = createJobDispatcher({ middleware: [database(() => current)] as const });

dispatcher.map(JOBS.sweep, async () => ({
	default: createJobHandler(JOBS.sweep, async (ctx) => {
		await ctx.db.exec(sql`delete from sessions where expires_at < ${Date.now()}`);
	}),
}));

await dispatcher.deliver({ id: "m1", attempts: 1, body: { type: "sweep" } });
current = createSqliteDatabase(new DatabaseSync(":memory:"));
await dispatcher.deliver({ id: "m2", attempts: 1, body: { type: "sweep" } });
```

## Pattern: One instance per request

A Worker whose database binding arrives with each request builds the router per request and hands the middleware the instance opened for it.

```typescript
import { database } from "@sdxc/database-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/router";

export default {
	fetch(request: Request, env: Env) {
		let db = new Database(createAdapter(env.DB));
		let router = createRouter({ middleware: [database(db)] });
		return router.fetch(request);
	},
};
```

## Pattern: Feeding later middleware

A middleware later in the chain reads `ctx.db` when it runs, so [`@sdxc/data-model`](https://www.npmjs.com/package/@sdxc/data-model) binds its models to the published database.

```typescript
import { database } from "@sdxc/database-middleware";
import { models } from "@sdxc/data-model/router";
import { Database } from "remix/data-table";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [database(new Database(adapter)), models(registry, (ctx) => ({ db: ctx.db }))],
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/database-middleware": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
