---
title: Log through the invocation
description: Every invocation already has one log, and handlers, services and models write into it rather than opening their own.
section:
    title: Conventions
    order: 3
order: 7
lastUpdated: 2026-10-25
outcomes:
    - "Why every invocation writes exactly one record, and what breaks that"
    - "When to write through `ctx.log` and when through `currentLog()`"
    - "What every record carries, and how to assert on it in a test"
---

Every invocation of your Worker — a request, a cron tick, a queue batch, a job run — writes
exactly one record with [`@sdxc/logger`](/api/logger): a wide event that the code it runs adds
fields to while it works, and that is written once when it settles. One record per invocation
lets a single query answer what happened, so handlers, services and models all write into the
invocation's own log. This page shows how each reaches that log, how to open one where nothing
does, and how to check a record in a test.

```bash
npm add @sdxc/logger remix
```

> [!NOTE]
> The current log lives in `AsyncLocalStorage`, so enable the `nodejs_compat` compatibility flag
> on the Worker.

## Find the log the invocation already has

A Worker configures one logger with `createLogger()`, in `app/initializers/logger.ts`, and
hands it to the two places invocations enter: `log(logger)` at the top of the router's
middleware, and the job dispatcher's `logger` option. Each of them opens the invocation's log
and writes it when the invocation settles, so every line of code that runs in between already
has a log to write to. [Logs, traces and timings](/docs/operations-and-testing/observability#configure-the-logger-once)
wires both.

## Write through ctx.log in handlers

A route handler and a job handler each receive the invocation's log as `ctx.log`. `set` adds
fields you will filter by, `time` adds `<name>.count` and `<name>.duration_ms`, `note` leaves a
breadcrumb, `warn` marks the record `degraded` and `fail` marks it `error`.

```typescript {% title="app/http/controllers/carts/quote.ts" %}
import { createAction } from "remix/router";

import Cart from "~/app/models/cart";
import { applyDiscount } from "~/app/services/checkout/apply-discount";
import routes from "~/routes/web";

export default createAction(routes.carts.quote, async (ctx) => {
	let cart = await ctx.log.time("db", () => Cart.find(ctx.db, ctx.params.id));
	if (cart === null) return new Response(null, { status: 404 });

	ctx.log.set({ cart: { id: cart.id, items: cart.items.length } });
	let code = ctx.url.searchParams.get("code");
	return Response.json({ total: applyDiscount(cart.totalCents, code) });
});
```

`{ cart: { id } }` is stored as the flat key `cart.id`, so it filters like any other field. Put
values in fields rather than in keys: one key per id grows the index forever. A job handler
reads its run's log as `ctx.log` the same way.

## Write through currentLog() everywhere else

A service, a model or a helper receives no `ctx`. It reads the running invocation's log with
`currentLog()`, which answers `undefined` outside an invocation, so an optional call is all the
guarding it needs and the function runs unchanged in a script or a test without a log.

```typescript {% title="app/services/checkout/apply-discount.ts" %}
import { currentLog } from "@sdxc/logger";

const DISCOUNTS = new Map<string, number>([["LAUNCH", 20]]);

export function applyDiscount(totalCents: number, code: string | null): number {
	if (code === null) return totalCents;

	let percent = DISCOUNTS.get(code);
	if (percent === undefined) {
		currentLog()?.note("discount.unknown", { code });
		return totalCents;
	}

	currentLog()?.set({ discount: { code, percent } });
	return Math.round((totalCents * (100 - percent)) / 100);
}
```

Called from the quote controller, these fields land on the request's record; called from a
job, on the job's.

> [!WARNING]
> Construct no logger and no `Log` inside a request, a job or a service. A second log writes a
> second record that no query joins to the first, and one that is never emitted is lost. The
> invocation already has a log; `ctx.log` and `currentLog()` are how you reach it.

## Open a log where nothing opens one

A Durable Object alarm runs outside the router and the dispatcher, so it opens its own log
through the same logger. `run()` makes the log current, fails it when the body throws, and
writes it once the body settles:

```typescript {% title="app/models/session-store.ts" %}
import { DurableObject } from "cloudflare:workers";

import { logger } from "~/app/initializers/logger";

export class SessionStore extends DurableObject<Cloudflare.Env> {
	async alarm() {
		let fields = { store: { id: this.ctx.id.toString() } };
		await logger.open("alarm", fields).run(async (log) => {
			let removed = await log.time("storage", () => this.removeExpired());
			log.set({ sessions: { removed } });
		});
	}

	async removeExpired(): Promise<number> {
		return 0;
	}
}
```

Inside `run()`, `currentLog()` answers this log, so the services the alarm calls write into it
exactly as they would during a request.

## Read what each record carries

Every record carries the logger's `service`, `environment` and `version`, its `kind`
(`request`, `cron`, `queue`, `job`, `alarm` or `command`), every field the code set, `outcome`
(`ok`, `degraded` or `error`) and `duration_ms`, plus `error.*` when it failed. Each entry point
adds what it knows, such as `route` and `http.status` on a request or `job.name` on a job run.

The `trace_id` ties records together: the request that enqueued a job and the job's run share
one, so a single query on it returns both.

## Test what a record says

A `Log` built with its own `sink` collects records instead of printing them, and `currentLog()`
finds it inside `run()`, so the service needs no change to be tested:

```typescript {% title="app/services/checkout/apply-discount.test.ts" %}
import { Log } from "@sdxc/logger";
import { expect, test } from "vitest";

import { applyDiscount } from "~/app/services/checkout/apply-discount";

test("records the discount it applied on the invocation's record", async () => {
	let records: Array<Readonly<Record<string, unknown>>> = [];
	let log = new Log({ kind: "request", sink: (record) => records.push(record) });

	let total = await log.run(() => applyDiscount(10_000, "LAUNCH"));

	expect(total).toBe(8_000);
	expect(records).toEqual([
		expect.objectContaining({
			kind: "request",
			"discount.code": "LAUNCH",
			"discount.percent": 20,
			outcome: "ok",
		}),
	]);
});
```

`run` writes the record when its body settles, so it is in `records` by the time `run`
resolves. The same wrapper checks a whole request, `log.run(() => createWebRouter().fetch(request))`,
whose record then holds what the controller and every service set.

## Where to go next

- [Logs, traces and timings](/docs/operations-and-testing/observability) — sampling, carrying
  the trace to outbound requests and `Server-Timing` on top of these records.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher
  that opens the cron, queue and job logs.
- [`@sdxc/logger`](/api/logger) — every method on a log and every option of `createLogger`.
