---
title: "Wire the router: middleware, context and services"
description: Build the global middleware chain once, publish services onto the request context, and let tests swap them.
section:
    title: Building Remix apps
    order: 4
order: 1
lastUpdated: 2026-10-25
outcomes:
    - "How to build the global middleware chain once as the composition root"
    - "How to publish a service onto the request context and read it in a handler"
    - "How to swap a service in a test"
---

Every request your Worker serves passes through one router, and the router's global middleware
decides what a handler can count on before it runs: a log, a trace, the user agent, and your
own services. This guide adds [`@sdxc/http`](/api/http), [`@sdxc/logger`](/api/logger),
[`@sdxc/trace-context`](/api/trace-context) and [`@sdxc/user-agent`](/api/user-agent) to that
chain in a single composition root, then publishes a database opened through
[`@sdxc/data-table-d1`](/api/data-table-d1) as `ctx.db` with
[`@sdxc/database-middleware`](/api/database-middleware), so handlers read it and a test
replaces it without touching a handler.

```bash
npm add @sdxc/data-table-d1 @sdxc/database-middleware @sdxc/http @sdxc/lazy-route \
	@sdxc/logger @sdxc/trace-context @sdxc/user-agent remix
```

> [!WARNING]
> The logger, the trace and `asyncContext()` all keep per-request state in
> `AsyncLocalStorage`, so enable the `nodejs_compat` compatibility flag on the Worker before you
> deploy this chain.

## Create one logger per Worker

A logger is configuration every request shares. Create it once, so the router, a job dispatcher
and a cron handler all write records under the same `service` name:

```typescript {% title="app/initializers/logger.ts" %}
import { createLogger } from "@sdxc/logger";

export const logger = createLogger({ service: "my-app" });
```

The `log(logger)` middleware opens one wide record per request, publishes it as `ctx.log`, and
writes it once the response settles.

## Publish a service

A service a handler needs, such as the database, belongs on the context rather than in an
import, so a test can replace it. The database opens from the D1 binding:

```typescript {% title="app/initializers/database.ts" %}
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

export function openDatabase(): Database {
	return new Database(createD1DatabaseAdapter(env.DB));
}
```

`database(db)` from `@sdxc/database-middleware` publishes it as `ctx.db`, typed on every request
context.

## Build the composition root

Build the router in a function that takes the database, defaulting to the production one. The
Worker calls it per request and a test calls the same function, so what the test drives is the
chain production runs. Each route is mapped through `lazy()`, so a request imports only the
controller it reaches; [Canonical URLs, lazy routes and header
fields](/docs/building-remix-apps/router-utilities) covers it.

```tsx {% title="app/initializers/router.tsx" %}
import type { Database as DataTable } from "remix/data-table";

import { database } from "@sdxc/database-middleware";
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { userAgent } from "@sdxc/user-agent/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import { openDatabase } from "~/app/initializers/database";
import routes from "~/routes/web";

import { logger } from "./logger";

export function createWebRouter(db: DataTable = openDatabase()) {
	let router = createRouter({
		middleware: [
			headRequests(),
			asyncContext(),
			log(logger),
			trace(),
			userAgent(),
			database(db),
			// …then the Remix middleware your app already runs:
			// cop(), formData(), a renderer
		],
		defaultHandler,
	});
	router.map(
		routes.home,
		lazy(() => import("~/app/http/controllers/home")),
	);
	router.map(
		routes.project,
		lazy(() => import("~/app/http/controllers/project")),
	);
	return router;
}
```

The order carries meaning:

- **`headRequests()` goes first.** It dispatches a `HEAD` as a `GET` and strips the body, so a
  monitor's probe runs through every guard a `GET` does instead of reaching the 404 handler.
- **`asyncContext()`** lets `@sdxc/user-agent/helpers` such as `isTouch()` read the current
  request with no argument.
- **`trace()` after `log()`.** It continues the caller's `traceparent` or starts a trace,
  publishes `ctx.trace`, and stamps `trace_id` on the open log.
- **`userAgent()` before the handlers.** It publishes the parsed browser, system and device as
  `ctx.userAgent`.

Write the list inline in `createRouter()`, so the router's context type records what each
middleware adds.

## Read it from a handler

A handler reads everything from `ctx`, and adds what it learned to the log. `Project` is your
model and `ProjectPage` your view.

```tsx {% title="app/http/controllers/project.tsx" %}
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import Project from "~/app/models/project";
import ProjectPage from "~/resources/views/project";
import routes from "~/routes/web";

export default createAction(routes.project, async (ctx) => {
	let { id } = s.parse(s.object({ id: s.string() }), ctx.params);

	ctx.log.set({ project: { id } });
	let project = await ctx.log.time("db", () => Project.find(ctx.db, id));

	return ctx.render(
		<ProjectPage project={project} browser={ctx.userAgent.browser} />,
	);
});
```

`ctx.log.time("db", …)` adds `db.count` and `db.duration_ms` to the request's single record.
Code with no `ctx` in reach calls `currentLog()` from `@sdxc/logger` for the same log.

## Swap it in a test

A test builds the real router with a database of its own. `createTestDatabase` is your helper
that opens an in-memory database with your schema applied:

```typescript {% title="app/initializers/router.test.ts" %}
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { createTestDatabase } from "~/app/test/database";

test("the home page lists projects", async () => {
	let db = await createTestDatabase();
	let router = createWebRouter(db);

	let response = await router.fetch(new Request("https://app.test/"));

	expect(response.status).toBe(200);
});
```

Only the database differs from production. The Worker entry is a thin wrapper:

```typescript {% title="bootstrap/worker.ts" %}
import { createWebRouter } from "~/app/initializers/router";

export default {
	async fetch(request: Request) {
		return await createWebRouter().fetch(request);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
```

## Where to go next

- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — what to do
  with `ctx.formData` and `ctx.params` once they arrive.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — getting more out
  of `ctx.log` and `ctx.trace`.
- [Test Workers apps](/docs/operations-and-testing/testing) — building `createTestDatabase`
  and testing against real bindings.
