# @sdxc/database-middleware

Router middleware that publishes a [`remix/data-table`](https://www.npmjs.com/package/remix) database on the request context as `ctx.db`, so every handler, MCP tool and later middleware reads the database off the context it was given.

## Installation

```bash
npm add @sdxc/database-middleware
```

It goes on a `remix/router` middleware chain and publishes a `remix/data-table` `Database`, so [`remix`](https://www.npmjs.com/package/remix) (v3) installs alongside it.

## Usage

### Publish The Database

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

### Install A Test Database

The middleware publishes whichever instance it is given, so a test builds the same router over an in-memory database:

```typescript
import { DatabaseSync } from "node:sqlite";

import { database } from "@sdxc/database-middleware";
import { createSqliteDatabase } from "remix/data-table/sqlite";
import { createRouter } from "remix/router";

let db = createSqliteDatabase(new DatabaseSync(":memory:"));
let router = createRouter({ middleware: [database(db)] });
```

### The Longhand

`database(db)` stands in for this hand-written middleware and the context key it sets:

```typescript
import type { Database } from "remix/data-table";

import { createContextKey } from "remix/router";

let DatabaseKey = createContextKey<Database>();

let publishDatabase = (db: Database) => (ctx, next) => {
	ctx.set(DatabaseKey, db, { property: "db" });
	return next();
};
```

## API

### `database(db: Database): Middleware`

Returns a middleware for a router's, controller's, or route's `middleware` chain that sets `db` as `ctx.db` and under the `Database` key for every request it runs on. Its context transform types `ctx.db` on a router whose context is derived from the middleware list; importing the package also adds `db` to `remix/router`'s `RequestContext`, so a handler typed against the plain context reads it too.

### `Database`

The context key the instance is published under. `ctx.get(Database)` returns the same object as `ctx.db`, for code that receives a context without knowing which middleware ran.

## Pattern: Feeding A Model Registry

A middleware later in the chain reads `ctx.db` when it runs, so [`@sdxc/data-model`](https://www.npmjs.com/package/@sdxc/data-model) binds its models to the published database:

```typescript
import { database } from "@sdxc/database-middleware";
import { models } from "@sdxc/data-model/router";
import { Database } from "remix/data-table";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [database(new Database(adapter)), models(registry, (ctx) => ({ db: ctx.db }))],
});
```

## Pattern: One Instance Per Request

A Worker whose binding is read from the request's environment builds the router per request and hands the middleware the instance opened for it:

```typescript
import { database } from "@sdxc/database-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/router";

export default {
	fetch(request: Request, env: Env) {
		let router = createRouter({ middleware: [database(new Database(createAdapter(env.DB)))] });
		return router.fetch(request);
	},
};
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
