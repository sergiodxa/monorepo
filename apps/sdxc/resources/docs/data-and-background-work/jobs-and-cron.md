---
title: Background jobs and cron
description: Declare jobs once, enqueue them from handlers, run them on Cloudflare Queues and cron triggers, and validate schedules users type.
section:
    title: Data & background work
    order: 6
order: 3
lastUpdated: 2026-09-29
---

Some work should not happen while a visitor waits: sending an email, calling a slow API, sweeping
stale rows at three in the morning. [`@sdxc/jobs`](/api/jobs) moves that work onto a queue. You
declare every job in one map, write each handler in its own module, and a dispatcher runs them
with the same middleware, logging, timeouts and retries whether a request enqueued them or a cron
trigger did.

The shape will feel familiar from the router: a map of addressable definitions, handlers mapped
onto them, and middleware that publishes services onto a typed context. At the end,
[`@sdxc/cron`](/api/cron) covers the other half of scheduling: checking an expression a person
typed into a form.

```bash
npm add @sdxc/jobs @sdxc/cron @sdxc/logger @sdxc/result remix
```

## Declare the jobs

The map is declaration and nothing else. Importing it costs its schemas, so a controller can
enqueue a job without pulling that job's dependencies into the request path:

```typescript {% title="app/jobs/index.ts" %}
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

export default jobs({
	sendConfirmation: job({
		input: s.object({ postingId: s.string(), locale: s.string() }),
	}),
	expirePostings: job({ cron: "0 3 * * *" }),
});
```

The key is the job's name on the wire. A message enqueued by one deploy is consumed by the next,
so renaming a key is a breaking change for whatever is still on the queue. `input` is parsed
before the handler runs, so a message that does not match never reaches your code.

A `cron` makes the job schedulable as well as enqueuable. The expression is parsed at
declaration: its type requires five fields, and an out-of-range value throws
`InvalidCronExpression` when the module loads rather than when the trigger fires.

## Write a handler

`createJobHandler` pairs a handler with its job, which is what types `ctx.input`:

```typescript {% title="app/jobs/expire-postings.ts" %}
import { createJobHandler } from "@sdxc/jobs";

import { expireBefore } from "~/app/data/posting";
import jobs from "~/app/jobs";

const LIFETIME_MS = 30 * 86_400_000;

export default createJobHandler(jobs.expirePostings, async (ctx) => {
	let closed = await expireBefore(ctx.database, Date.now() - LIFETIME_MS);
	ctx.log.set({ postings: { expired: closed } });
});
```

`expireBefore` is your own model function, closing the rows older than a cutoff and answering how
many it closed. `ctx.log` is the run's record, emitted once when the run ends: `set()` a field you will query by,
`note()` a breadcrumb, `time()` anything with a duration. Every run gets its own record, carrying
the job name, attempt count and how it ended, and a job enqueued during a request shares that
request's trace id.

Returning normally acks the message. When you need another ending, the context has a verb for
each: `ctx.retry({ delay: "5 minutes" })` asks for a redelivery later, `ctx.exit(reason)` gives up
for good because a retry would reach the same result, and anything else thrown is retried by the
platform. Write every verb as `return ctx.retry(…)`: each one throws, so nothing after it runs,
and the `return` is what tells TypeScript the lines below are unreachable, since it narrows on a
never-returning call only through a `const` name and `ctx` is a parameter.

## Publish services onto the job context

`ctx.database` above came from job middleware, the same way `ctx.db` comes from request
middleware. A test hands in its own source, and the handler never touches a binding:

```typescript {% title="app/jobs/middleware/database.ts" %}
import type { JobMiddleware } from "@sdxc/jobs";
import type { Database as DataTable } from "remix/data-table";

import { createContextKey } from "remix/router";

export const Database = createContextKey<DataTable>();

interface DatabaseEffect {
	key: typeof Database;
	value: DataTable;
	property: "database";
}

export function database(source: () => DataTable): JobMiddleware<DatabaseEffect> {
	return async (ctx, next) => {
		ctx.set(Database, source(), { property: "database" });
		await next();
	};
}
```

The effect type names what the middleware publishes, and the dispatcher folds it out of its chain
to type `ctx.database` on every handler.

## Share one queue

Jobs are written to a queue in one place and read from it in another: route handlers enqueue,
and the dispatcher delivers. Build the queue once, in a module both sides import, so they cannot
end up pointed at different backends:

```typescript {% title="app/jobs/queue.ts" %}
import * as cloudflare from "@sdxc/jobs/cloudflare";
import { env } from "cloudflare:workers";

export const queue = cloudflare.queue(() => env.QUEUE);
```

`cloudflare.queue` takes a function rather than the binding, so importing this module reads no
binding until something is enqueued.

## Build the dispatcher

The dispatcher owns the middleware chain and the timeout, delivers from the shared queue, and
maps each job to a loader so a handler module is imported only once a message for it arrives:

```typescript {% title="app/jobs/dispatcher.ts" %}
import type { JobQueue } from "@sdxc/jobs/queue";
import type { Database } from "remix/data-table";

import { createJobDispatcher } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { database } from "~/app/jobs/middleware/database";
import { queue } from "~/app/jobs/queue";
import { openDatabase } from "~/app/lib/database";
import { logger } from "~/app/logger";

interface DispatcherOptions {
	queue?: JobQueue;
	openDb?: () => Database;
}

export function createDispatcher(options: DispatcherOptions = {}) {
	let dispatcher = createJobDispatcher({
		logger,
		queue: options.queue ?? queue,
		middleware: [database(options.openDb ?? openDatabase)] as const,
		timeout: "2 minutes",
	});

	dispatcher.map(
		jobs.sendConfirmation,
		() => import("~/app/jobs/send-confirmation"),
	);
	dispatcher.map(jobs.expirePostings, () => import("~/app/jobs/expire-postings"));
	return dispatcher;
}

export const dispatcher = createDispatcher();
```

The worker uses the one instance built at module scope. An augmentation of `JobTypes` is what
gives every handler the context this chain produces:

```typescript {% title="app/jobs/types.ts" %}
import type { JobDispatcherContext } from "@sdxc/jobs";

import type { dispatcher } from "~/app/jobs/dispatcher";

declare module "@sdxc/jobs" {
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}
```

The factory's options exist for tests: the defaults are what production runs.

## Enqueue from a request

A route handler enqueues through `ctx.jobs`, which `jobEnqueuer(queue)` from
`@sdxc/jobs/router` publishes. It writes through the shared queue alone, so the dispatcher, its
middleware and every job handler stay out of the request path's module graph:

```typescript {% title="app/router.ts" %}
import { jobEnqueuer } from "@sdxc/jobs/router";
import { log } from "@sdxc/logger/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { createRouter } from "remix/router";

import { queue } from "~/app/jobs/queue";
import { logger } from "~/app/logger";

export default createRouter({
	middleware: [log(logger), trace(), jobEnqueuer(queue)],
});
```

Importing the middleware is what types `ctx.jobs`. Listing `trace()` before it makes every
message carry the request's trace, so each job run links back to the request that enqueued it.
A handler then enqueues with exactly the payload the job's schema accepts:

```typescript {% title="app/http/controllers/publish-posting.ts" %}
import { redirect } from "@sdxc/http/response";
import { createAction } from "remix/router";

import { publishPosting } from "~/app/data/posting";
import jobs from "~/app/jobs";
import routes from "~/routes/web";

export default createAction(routes.postings.create, async (ctx) => {
	let posting = await publishPosting(ctx.formData);
	await ctx.jobs.enqueue(jobs.sendConfirmation, {
		postingId: posting.id,
		locale: ctx.locale,
	});

	return redirect(routes.postings.index.href(), {
		status: redirect.Status.SeeOther,
	});
});
```

`publishPosting` is your own model function, and `ctx.locale` is the language the
[`@sdxc/i18n`](/api/i18n) middleware detected, so the email can be written in it.

A job with no `input` is enqueued with no second argument, and `enqueueMany` writes one message
per input in a single call. When the queue refuses a send, `enqueue` raises the backend's
`JobQueueError`, so the request fails instead of reporting work that will never run. Inside a
job handler or a test, where the dispatcher is already in hand, `dispatcher.enqueue` takes the
same arguments.

## Wire the Worker

`cloudflare.worker(dispatcher)` returns the `scheduled` and `queue` handlers a Worker exports,
beside the `fetch` handler your router factory answers:

```typescript {% title="bootstrap/worker.ts" %}
import * as cloudflare from "@sdxc/jobs/cloudflare";

import { dispatcher } from "~/app/jobs/dispatcher";
import application from "~/bootstrap/app";

const handlers = cloudflare.worker(dispatcher);

export default {
	fetch: (request: Request) => application().fetch(request),
	scheduled: (controller: ScheduledController) => handlers.scheduled(controller),
	queue: (batch: MessageBatch) => handlers.queue(batch),
} satisfies ExportedHandler<Cloudflare.Env>;
```

A cron delivery runs no job. It enqueues every job declaring the expression that fired and
returns, so the nightly sweep gets the same retries, timeout and dead-letter handling as any other
message. The Worker's configuration declares the trigger with the same spelling, and the queue it
both produces to and consumes:

```json
{
	"triggers": { "crons": ["0 3 * * *"] },
	"queues": {
		"producers": [{ "binding": "QUEUE", "queue": "app-jobs" }],
		"consumers": [{ "queue": "app-jobs", "max_retries": 3 }]
	}
}
```

`dispatcher.crons` lists the distinct schedules the mapped jobs declare, so one test comparing it
against your configuration catches a job whose trigger was never added.

## Run jobs in a test

`@sdxc/jobs/memory` is a queue held in an array. Build the dispatcher over one and over a test
database, such as the in-memory D1 from
[Query D1 and Durable Object SQL](/docs/data-and-background-work/databases), enqueue, and drain
the queue through the dispatcher:

```typescript {% title="app/jobs/expire-postings.test.ts" %}
import * as memory from "@sdxc/jobs/memory";
import { expect, test } from "vitest";

import jobs from "~/app/jobs";
import { createDispatcher } from "~/app/jobs/dispatcher";
import { createTestDatabase } from "~/app/test/database";

test("the nightly sweep runs to completion", async () => {
	let db = await createTestDatabase();
	let queue = memory.queue();
	let dispatcher = createDispatcher({ queue, openDb: () => db });

	await dispatcher.enqueue(jobs.expirePostings);
	let settlements = await queue.drain((delivery) => dispatcher.deliver(delivery));

	expect(settlements).toEqual([{ type: "ack" }]);
});
```

The middleware and handlers are the ones production runs, so what the test substitutes is the
queue and the database, and nothing between them.

## Validate a schedule someone typed

`job({ cron })` is for schedules you write. When a user picks one, such as a weekly report, the
expression is input. `Schedule.parse` returns a `Result` whose failure names the field and the
character position to point at, so the form can say exactly what is wrong:

```typescript {% title="app/services/report-schedule.ts" %}
import { Schedule } from "@sdxc/cron";
import { isFailure, success } from "@sdxc/result";

export interface ScheduleInput {
	expression: string;
	timeZone: string;
}

export function planSchedule(input: ScheduleInput) {
	let parsed = Schedule.parse(input.expression);
	if (isFailure(parsed)) return parsed;

	let schedule = parsed.data;

	return success({
		expression: schedule.toString(),
		timeZone: input.timeZone,
		nextRunAt: schedule.next({ from: new Date(), timeZone: input.timeZone }),
	});
}
```

A form action calls `planSchedule` with the fields it validated. On a failure it re-renders with
`error.reason` and `error.position`; on a success it stores what came back.

Every occurrence query takes the time zone explicitly, so a report at 09:00 stays at 09:00 local
across a daylight saving change. Store `toString()`, the normalized form, beside the zone.
`schedule.describe()` returns structured data such as `{ kind: "weekly", weekdays: [1], at: [...] }`
for you to translate, and `schedule.isDue(lastRun, { now, timeZone })` is what a frequent cron job
calls to find the user schedules that are due.

## Where to go next

- [Send email](/docs/data-and-background-work/send-email) — the confirmation job, written out.
- [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases) — the database the
  job middleware publishes.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — reading the record
  every run emits.
- [Feature flags](/docs/data-and-background-work/feature-flags) — gate a job's behavior per
  subject.
