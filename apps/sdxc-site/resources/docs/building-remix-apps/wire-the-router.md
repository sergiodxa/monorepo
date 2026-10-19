---
title: "Wire the router: middleware, context and services"
description: Build the global middleware chain once, publish services onto the request context, and let tests swap them.
section:
    title: Building Remix apps
    order: 4
order: 1
lastUpdated: 2026-10-19
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

The logger, the trace and `asyncContext()` all keep per-request state in `AsyncLocalStorage`,
so enable the `nodejs_compat` compatibility flag on the Worker.

## One logger per worker

A logger is configuration, not a per-request object. Create it once in its own module, so the
router and anything else that opens a log (a job dispatcher, a cron handler) write records
under the same `service` name and a query can group them.

```typescript {% title="app/initializers/logger.ts" %}
import { createLogger } from "@sdxc/logger";

export const logger = createLogger({ service: "my-app" });
```

The `log(logger)` middleware opens one wide record per request, publishes it as `ctx.log`,
and writes it once the response settles. Handlers never construct a logger; they add fields
to the one already open.

## The composition root

Build the router in a function rather than at module scope. The Worker calls it per request,
and a test calls the same function, so what the test drives is the chain production runs.
Each route is mapped through `lazy()` from [`@sdxc/lazy-route`](/api/lazy-route), so a request
imports only the controller it reaches; [Canonical URLs, lazy routes and header
fields](/docs/building-remix-apps/router-utilities) covers it in full.

```tsx {% title="app/initializers/router.tsx" %}
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { userAgent } from "@sdxc/user-agent/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import routes from "~/routes/web";

import { logger } from "./logger";

export function createWebRouter() {
	let router = createRouter({
		middleware: [
			headRequests(),
			asyncContext(),
			log(logger),
			trace(),
			userAgent(),
			// …then the Remix middleware your app already runs:
			// cop(), formData(), a renderer
		],
		defaultHandler,
	});
	router.map(
		routes.home,
		lazy(() => import("~/app/http/controllers/home")),
	);
	return router;
}
```

The order carries meaning:

- **`headRequests()` goes first.** The router matches methods strictly, so without it a `HEAD`
  probe from a monitor falls through to the 404 handler. It dispatches the `HEAD` as a `GET`
  and strips the body, and because it leads the chain, a `HEAD` runs through every guard a
  `GET` does.
- **`asyncContext()` is there for `@sdxc/user-agent/helpers`.** Predicates such as
  `isTouch()` read the current request through it when called with no argument, so a
  component deep inside a render asks without being handed anything.
- **`trace()` after `log()`.** It continues the caller's `traceparent` or starts a trace,
  publishes it as `ctx.trace`, and stamps `trace_id` and `span_id` on the log that is already
  open.
- **`userAgent()` anywhere before the handlers.** It reads the `User-Agent` header once and
  publishes the parsed browser, engine, system and device as `ctx.userAgent`.

The Remix middleware after them (cross-origin protection, form parsing, rendering) is
unchanged by any of this; see the
[Remix documentation](https://github.com/remix-run/remix) for those.

Write the list inline in `createRouter()`, so the router's context type records what each
middleware adds. Each package also augments `RequestContext` in `remix/router`, so installing
`log()` is what makes `ctx.log` exist in your editor.

## Publishing a service

A service a handler needs, such as the database, belongs on the context rather than in an
import. The database opens from the D1 binding:

```typescript {% title="app/initializers/database.ts" %}
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

export function openDatabase(): Database {
	return new Database(createD1DatabaseAdapter(env.DB));
}
```

`database(db)` from `@sdxc/database-middleware` publishes it as `ctx.db`, typed on every
request context. A service of your own follows the same pattern: a context key, a `db`-style
property declared on `RequestContext`, and middleware that sets the value per request:

```typescript
import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

export const Billing = createContextKey<BillingClient>();

declare module "remix/router" {
	interface RequestContext {
		billing: BillingClient;
	}
}

export function billing(client: BillingClient): Middleware {
	return (ctx, next) => {
		ctx.set(Billing, client, { property: "billing" });
		return next();
	};
}
```

A test hands in a database of its own. Pass it through the composition root, defaulting to the
production one. Since the router is built per request, so is the database, and each request
uses the binding it was served with:

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
			// …then cop(), formData() and a renderer, as before
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

## Reading it from a handler

A handler reads everything from `ctx`, and adds what it learned to the log instead of
writing a line of its own. `Project` is your model and `ProjectPage` your view.

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

`ctx.log.time("db", …)` adds `db.count` and `db.duration_ms` to the request's single record,
and `project.id` becomes a field you can filter on. Code with no `ctx` in reach calls
`currentLog()` from `@sdxc/logger`, which returns the same log.

## Swapping it in a test

Because the service arrives through the composition root, a test builds the real router with
a different source and sends it a request. `createTestDatabase` is a helper of your own that
opens an in-memory D1 database with your schema applied.

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

Nothing is mocked: the log, the trace and the rest of the chain run as they do in
production, and only the database differs.

The Worker entry is then a thin wrapper:

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
- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui) —
  what goes inside `ctx.render`.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — getting more out
  of `ctx.log` and `ctx.trace`.
- [Test Workers apps](/docs/operations-and-testing/testing) — building `createTestDatabase`
  and testing against real bindings.
