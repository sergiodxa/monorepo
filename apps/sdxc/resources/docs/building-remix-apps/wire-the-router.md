---
title: "Wire the router: middleware, context and services"
description: Build the global middleware chain once, publish services onto the request context, and let tests swap them.
section:
    title: Building Remix apps
    order: 3
order: 1
lastUpdated: 2026-09-29
---

Every request your Worker serves passes through one router, and the router's global middleware
decides what a handler can count on before it runs: a log, a trace, the user agent, and your
own services. This guide adds [`@sdxc/http`](/api/http), [`@sdxc/logger`](/api/logger),
[`@sdxc/trace-context`](/api/trace-context) and [`@sdxc/user-agent`](/api/user-agent) to that
chain in a single composition root, then publishes a database opened through
[`@sdxc/data-table-d1`](/api/data-table-d1) as `ctx.db`, so handlers read it and a test
replaces it without touching a handler.

```bash
npm add remix @sdxc/http @sdxc/logger @sdxc/trace-context \
	@sdxc/user-agent @sdxc/data-table-d1
```

The logger, the trace and `asyncContext()` all keep per-request state in `AsyncLocalStorage`,
so enable the `nodejs_compat` compatibility flag on the Worker.

## One logger per worker

A logger is configuration, not a per-request object. Create it once in its own module, so the
router and anything else that opens a log (a job dispatcher, a cron handler) write records
under the same `service` name and a query can group them.

```typescript {% title="bootstrap/logger.ts" %}
import { createLogger } from "@sdxc/logger";

export const logger = createLogger({ service: "my-app" });
```

The `log(logger)` middleware opens one wide record per request, publishes it as `ctx.log`,
and writes it once the response settles. Handlers never construct a logger; they add fields
to the one already open.

## The composition root

Build the router in a function rather than at module scope. The Worker calls it per request,
and a test calls the same function, so what the test drives is the chain production runs.

```tsx {% title="bootstrap/app.tsx" %}
import type { Middleware } from "remix/router";

import { headRequests } from "@sdxc/http/middleware/head-requests";
import { log } from "@sdxc/logger/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { userAgent } from "@sdxc/user-agent/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import home from "~/app/http/controllers/home";
import routes from "~/routes/web";

import { logger } from "./logger";

export default function application() {
	let middleware: Middleware[] = [
		headRequests(),
		asyncContext(),
		log(logger) as Middleware,
		trace() as Middleware,
		userAgent(),
		// …then the Remix middleware your app already runs:
		// cop(), formData(), a renderer
	];

	let router = createRouter({ middleware, defaultHandler });
	router.map(routes.home, home);
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

The array is annotated `Middleware[]`, so a middleware whose return type describes what it
adds to the context is cast to the plain type. The properties stay typed anyway: each package
augments `RequestContext` in `remix/router`, so installing `log()` is what makes `ctx.log`
exist in your editor.

## Publishing a service

A service a handler needs, such as the database, belongs on the context rather than in an
import. Middleware creates a context key, declares the property on `RequestContext`, and sets
the value per request.

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

The middleware takes a function that opens the database, not the database itself. The
production source reads the D1 binding at request time, so each request uses the binding it
was served with:

```typescript {% title="app/lib/database.ts" %}
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

export function openDatabase(): Database {
	return new Database(createD1DatabaseAdapter(env.DB));
}
```

A test hands in a source of its own. Pass it through the composition root, defaulting to the
production one:

```tsx {% title="bootstrap/app.tsx" %}
import type { Database as DataTable } from "remix/data-table";
import type { Middleware } from "remix/router";

import { headRequests } from "@sdxc/http/middleware/head-requests";
import { log } from "@sdxc/logger/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { userAgent } from "@sdxc/user-agent/middleware";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import home from "~/app/http/controllers/home";
import project from "~/app/http/controllers/project";
import database from "~/app/http/middleware/database";
import { openDatabase } from "~/app/lib/database";
import routes from "~/routes/web";

import { logger } from "./logger";

export default function application(openDb: () => DataTable = openDatabase) {
	let middleware: Middleware[] = [
		headRequests(),
		asyncContext(),
		log(logger) as Middleware,
		trace() as Middleware,
		userAgent(),
		database(openDb),
		// …then cop(), formData() and a renderer, as before
	];

	let router = createRouter({ middleware, defaultHandler });
	router.map(routes.home, home);
	router.map(routes.project, project);
	return router;
}
```

## Reading it from a handler

A handler reads everything from `ctx`, and adds what it learned to the log instead of
writing a line of its own. `Project` is your model and `ProjectPage` your view.

```tsx {% title="app/http/controllers/project.tsx" %}
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import Project from "~/app/data/project";
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

```typescript {% title="bootstrap/app.test.ts" %}
import { expect, test } from "vitest";

import { createTestDatabase } from "~/app/lib/test/database";

import application from "./app";

test("the home page lists projects", async () => {
	let db = await createTestDatabase();
	let router = application(() => db);

	let response = await router.fetch(new Request("https://app.test/"));

	expect(response.status).toBe(200);
});
```

Nothing is mocked: the log, the trace and the rest of the chain run as they do in
production, and only the database differs.

The Worker entry is then a thin wrapper:

```typescript {% title="bootstrap/worker.ts" %}
import application from "./app";

export default {
	async fetch(request: Request) {
		return await application().fetch(request);
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
