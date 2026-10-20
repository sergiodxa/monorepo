---
title: Logs, traces and timings
description: One wide log event per invocation, a W3C trace that follows a request into its jobs, and a Server-Timing header for the browser.
section:
    title: Operations & testing
    order: 9
order: 1
lastUpdated: 2026-10-19
outcomes:
    - "How to write one wide log event per invocation with `@sdxc/logger`"
    - "How to carry a W3C trace from a request into its jobs and outbound requests"
    - "How to report timings to the browser with `Server-Timing`"
---

When a request misbehaves in production you want to answer three questions quickly: what
happened on this request, which other work did it cause, and which part of it was slow. This
guide wires one answer to each into a Remix v3 app on Workers.
[`@sdxc/logger`](/api/logger) writes one wide event per invocation,
[`@sdxc/trace-context`](/api/trace-context) gives every invocation a W3C trace that travels
into jobs and outbound requests, and [`@sdxc/server-timing`](/api/server-timing) reports
per-request timings in a header every browser's network panel reads.

```bash
npm add @sdxc/database-middleware @sdxc/http @sdxc/jobs @sdxc/logger @sdxc/result \
	@sdxc/server-timing @sdxc/trace-context @sdxc/validate remix
```

The logger and the trace are bound through `AsyncLocalStorage`, so enable `nodejs_compat` in
your Worker's compatibility flags.

## Configure the logger once

A logger is configuration, not a stream. You create it once, in its own module, so every
entry point of the Worker — the router, the job dispatcher, a Durable Object — opens its logs
with the same `service`, and a query across workers has something to group by.

```typescript {% title="app/initializers/logger.ts" %}
import { createLogger } from "@sdxc/logger";
import { env } from "cloudflare:workers";

export const logger = createLogger({
	service: "jobs-board",
	version: env.CF_VERSION_METADATA?.id,
});
```

`version` reads the deployed version from a version-metadata binding named
`CF_VERSION_METADATA`, declared in your Wrangler config, so you can tell which
deploy produced a record. Leave out `sample` and every log is written; turn it on only when
volume makes you, which is covered below.

## Attach it at the top of the router

`log(logger)` opens the request's log and publishes it as `ctx.log`. Put it near the top of
the middleware chain so everything after it writes into the same record, and put `trace()`
directly after it, so the trace ids land on the request's log. `jobEnqueuer(queue)` from
`@sdxc/jobs/router` publishes `ctx.jobs` for enqueuing background work, over the queue shown
in the jobs section below. The Remix middleware your app already runs (`formData()`, `cop()`,
…) follows them.

```tsx {% title="app/initializers/router.tsx" %}
import { jobEnqueuer } from "@sdxc/jobs/router";
import { log } from "@sdxc/logger/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { createRouter } from "remix/router";

import { logger } from "~/app/initializers/logger";
import { queue } from "~/app/initializers/queue";

export function createWebRouter() {
	let router = createRouter({
		middleware: [log(logger), trace(), jobEnqueuer(queue)],
	});
	// router.map(…) for each route
	return router;
}
```

Every request now emits one record carrying `route` (the pattern, never the concrete path),
`http.method`, `http.status`, `outcome`, `duration_ms`, and `trace_id`, `span_id` and
`trace_flags` from `trace()`. When the caller sent a valid `traceparent`, `parent_span_id`
names its span, so your record joins the caller's trace.

## Write into the record from a handler

The log is one record you add to, not a series of lines. `set` adds fields you will filter
by, `time` measures anything with a duration, `note` leaves a breadcrumb for when a query has
found the record, and `warn` and `fail` change its outcome.

```typescript {% title="app/http/controllers/postings.ts" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import Posting from "~/app/models/posting";
import { PostingSchema } from "~/app/http/validators/posting";
import { renderForm } from "~/resources/views/posting-form";
import jobs from "~/app/jobs";
import routes from "~/routes/web";

export const create = createAction(routes.postings.create, async (ctx) => {
	let submission = await validate(ctx.formData, PostingSchema);
	if (isFailure(submission)) {
		ctx.log.warn("posting.invalid", { issues: submission.error.issues.length });
		return renderForm(ctx, submission.error);
	}

	let posting = await ctx.log.time("db", () =>
		Posting.publish(ctx.db, submission.data),
	);
	ctx.log.set({ posting: { id: posting.id } });
	ctx.log.note("posting.published");

	await ctx.jobs.enqueue(jobs.sendConfirmation, { postingId: posting.id });
	let href = routes.postings.show.href({ id: posting.id });
	return redirect(href, { status: redirect.Status.SeeOther });
});
```

`Posting`, `PostingSchema` and `renderForm` are your app's own model, form schema and form
view, and `ctx.db` comes from the middleware that publishes your database. `ctx.jobs` is
`jobEnqueuer` from `@sdxc/jobs/router`, covered in
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron). `{ posting: { id } }` is stored as `posting.id`, one flat key you can filter on. Keep a
namespace meaning the same thing everywhere (`user`, `team`, `db`, `cache`, `job`) and never
build a key out of a value: `set({ team: { id } })` is one field, while a key per id grows the
index forever. `warn` marks the record `degraded` without making it an alarm; `fail(error)`
marks it `error` and records `error.type`, `error.message` and the stack. Use `fail` for the
failure branch of a `Result` you cannot recover from.

Fields that every handler would repeat, such as who the user is, belong in the middleware
that resolves them: call `ctx.log.set({ user: { id: user.id } })` there once.

## Reach the log outside a handler

A model, a cache wrapper or a mail helper does not receive `ctx`. It reads the running
invocation's log with `currentLog()`, which is `undefined` outside an invocation, so the
optional chain is all the guarding it needs. Here `loadFlags` is your call to a flag provider,
returning a `Result`, and `DEFAULT_FLAGS` what the app runs with when it fails.

```typescript {% title="app/initializers/flags.ts" %}
import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";

import { DEFAULT_FLAGS, loadFlags } from "~/app/services/flag-provider";

export async function readFlags() {
	let loaded = await loadFlags();
	if (isFailure(loaded)) {
		currentLog()?.warn("flags.provider_error", { message: loaded.error.message });
		return DEFAULT_FLAGS;
	}
	return loaded.data;
}
```

<note>
One `createLogger()` per Worker and the invocation's own log is the whole model: a logger or
log opened per request writes a second record that no trace or query joins to the first.
</note>

## Hand the same logger to the job dispatcher

Jobs are their own invocations, so they get their own records. Pass the same `logger` to
[`@sdxc/jobs`](/api/jobs) and each cron tick, queue batch and job run emits one, with
`ctx.log` in the handler working exactly like the request's. Build the queue once, in a
module the router and the dispatcher both import, so `jobEnqueuer` writes to the backend the
dispatcher delivers from:

```typescript {% title="app/initializers/queue.ts" %}
import * as cloudflare from "@sdxc/jobs/cloudflare";
import { env } from "cloudflare:workers";

export const queue = cloudflare.queue(() => env.QUEUE);
```

`database()` from `@sdxc/database-middleware/jobs` publishes the database to handlers as
`ctx.db`.

```typescript {% title="app/initializers/dispatcher.ts" %}
import { database } from "@sdxc/database-middleware/jobs";
import { createJobDispatcher } from "@sdxc/jobs";

import { openDatabase } from "~/app/initializers/database";
import { logger } from "~/app/initializers/logger";
import { queue } from "~/app/initializers/queue";

export const dispatcher = createJobDispatcher({
	logger,
	queue,
	middleware: [database(openDatabase)],
	timeout: "30 seconds",
});
```

The trace comes along for free. Because `trace()` runs before `jobEnqueuer`, every job
enqueued through `ctx.jobs` carries the request's trace in its envelope, and the run continues it with a span of its own, so the request that accepted a
submission and the job that mailed the confirmation share a `trace_id`. One query on that id
shows both records. A cron tick has no caller, so it starts a root trace that every job it
enqueues inherits.

## Carry the trace to outbound requests

A request to another service joins the trace when it carries `traceparent`. `inject` writes
the current trace into a `Headers`, and `withTrace` copies a request you are forwarding to a
service binding or a Durable Object stub.

```typescript {% title="app/services/billing.ts" %}
import { inject, withTrace } from "@sdxc/trace-context";
import { env } from "cloudflare:workers";

export async function listInvoices(): Promise<Response> {
	let headers = new Headers({ accept: "application/json" });
	inject(headers);
	return await fetch("https://billing.example.com/invoices", { headers });
}

export async function forwardToBilling(request: Request): Promise<Response> {
	return await env.BILLING.fetch(withTrace(request));
}
```

`BILLING` is a service binding to another Worker; a Durable Object stub's `fetch` takes the
forwarded request the same way.

Both do nothing outside a trace, so they are safe to call anywhere. A client built on
[`@sdxc/api-client`](/api/api-client) injects the trace on every request without this step.
On a public endpoint where you do not want callers to pick your trace ids, pass
`trace({ accept })` a predicate; a rejected header starts a fresh trace and is noted on the
log as `trace.rejected`.

## Report timings to the browser

The log is for you; `Server-Timing` is for whoever is looking at the network panel. A small
middleware gives each request a `TimingCollector` and writes the header once the handler has
answered.

```typescript {% title="app/http/middleware/server-timing.ts" %}
import type { Middleware } from "remix/router";

import { TimingCollector } from "@sdxc/server-timing";
import { createContextKey } from "remix/router";

export const Timing = createContextKey<TimingCollector>();

export default function serverTiming(): Middleware {
	return async (ctx, next) => {
		let timing = new TimingCollector();
		ctx.set(Timing, timing);
		let response = await next();
		let headers = timing.toHeaders(new Headers(response.headers));
		return new Response(response.body, { status: response.status, headers });
	};
}
```

The collector reaches handlers under the `Timing` key, imported from this module, the way any
service does (see
[Wire the router](/docs/building-remix-apps/wire-the-router)). Copying into a new `Response`
keeps this working for responses whose headers are immutable, such as a redirect or an
upstream `fetch`. In a handler, wrap the work you want to see:
`await ctx.get(Timing).measure("db", "listPostings", () => Posting.listOpen(ctx.db))`. The name is
the group you scan for and the description says which call it was.

<note>
Workers advance the clock only across I/O, so time I/O calls; pure computation reads as zero.
</note>

<warning>
Every client sees the `Server-Timing` header, so name entries as deliberately as a public API.
</warning>

## Sample only when you have to

Logging is billed per event, and width costs nothing, so the default keeps every record. When
volume gets close to your allotment, sample the successful background runs, which is where
the events are:

```typescript {% title="app/initializers/logger.ts" %}
import { createLogger } from "@sdxc/logger";

export const logger = createLogger({
	service: "jobs-board",
	sample: { rate: 0.05, keep: ({ kind }) => kind !== "job" },
});
```

A `degraded` or `error` record is always written, `keep` exempts every request, and one in
twenty successful job runs is kept. `slowerThanMs` keeps slow successes too.

`keep` also takes a condition in the JSON form of [`@sdxc/expression`](/api/expression), which
is data rather than code, so the exemption can come from configuration. While you chase a
problem for one customer, keep every one of their events and sample everyone else's:

```typescript {% title="app/initializers/logger.ts" %}
import { createLogger } from "@sdxc/logger";

export const logger = createLogger({
	service: "jobs-board",
	sample: {
		rate: 0.05,
		keep: {
			op: "any",
			of: [
				{ op: "ne", field: "kind", value: "job" },
				{ op: "eq", field: "team.id", value: "team_01j9z3kq" },
			],
		},
	},
});
```

A field is read by its dotted path, so `team.id` matches what `ctx.log.set({ team: { id } })`
recorded. The condition compiles once, when the logger is created, and one that does not
compile keeps every event: a typo in the exemption costs volume, never the record you were
looking for.

## Test what a record says

A record is what you query in production, so a test checks it the same way: run the code
inside a `Log` whose `sink` collects records instead of writing them, and assert on what was
emitted. `currentLog()` finds that log, so `readFlags` needs no change to be tested. The
provider module is replaced before `readFlags` loads, to make it fail:

```typescript {% title="app/initializers/flags.test.ts" %}
import { Log } from "@sdxc/logger";
import { failure } from "@sdxc/result";
import { expect, test, vi } from "vitest";

test("a provider failure falls back to the defaults, degraded", async () => {
	vi.doMock("~/app/services/flag-provider", async (importOriginal) => ({
		...(await importOriginal<typeof import("~/app/services/flag-provider")>()),
		loadFlags: async () => failure(new Error("provider timed out")),
	}));
	let { readFlags } = await import("~/app/initializers/flags");
	let { DEFAULT_FLAGS } = await import("~/app/services/flag-provider");

	let records: Record<string, unknown>[] = [];
	let log = new Log({ kind: "request", sink: (record) => records.push(record) });

	expect(await log.run(() => readFlags())).toBe(DEFAULT_FLAGS);
	expect(records).toEqual([
		expect.objectContaining({
			outcome: "degraded",
			notes: [
				expect.objectContaining({
					level: "warn",
					name: "flags.provider_error",
					message: "provider timed out",
				}),
			],
		}),
	]);
});
```

`run` emits the record when the body settles, so it is in `records` by the time `run`
resolves. A handler's log works the same way: build the context, pass this `log`, and call the
handler inside `log.run(...)`.

## Where to go next

- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher
  these job logs come from.
- [Send alerts to chat and paging services](/docs/data-and-background-work/messaging) — tell
  Slack, Discord or PagerDuty when something fails, with every send noted on the run's log.
- [`@sdxc/logger`](/api/logger) and [`@sdxc/trace-context`](/api/trace-context) — every field
  and option.
