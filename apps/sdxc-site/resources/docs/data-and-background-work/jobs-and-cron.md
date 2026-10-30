---
title: Background jobs and cron
description: Declare jobs once, enqueue them from handlers, run them on Cloudflare Queues and cron triggers, and validate schedules users type.
section:
    title: Data & background work
    order: 7
order: 4
lastUpdated: 2026-10-25
outcomes:
    - "How to declare jobs once and write handlers with `@sdxc/jobs`"
    - "How to enqueue from a request and run on Cloudflare Queues and cron triggers"
    - "How to validate a schedule someone typed and run jobs in a test"
---

Some work should not happen while a visitor waits: sending an email, calling a slow API, sweeping
stale rows at three in the morning. [`@sdxc/jobs`](/api/jobs) moves that work onto a queue. You
declare every job in one map, write each handler in its own module, and a dispatcher runs them
with the same middleware, logging, timeouts and retries whether a request enqueued them or a cron
trigger did.

At the end, [`@sdxc/cron`](/api/cron) checks a schedule a person typed into a form.

```bash
npm add @sdxc/cron @sdxc/database-middleware @sdxc/http @sdxc/jobs @sdxc/logger \
	@sdxc/result @sdxc/trace-context remix
```

## Declare the jobs

The map is declaration and nothing else. Importing it costs its schemas, so a controller can
enqueue a job without pulling that job's dependencies into the request path:

```typescript {% title="app/jobs/index.ts" %}
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

export default jobs({
	indexPosting: job({ input: s.object({ postingId: s.string() }) }),
	expirePostings: job({ cron: "0 3 * * *" }),
});
```

`input` is parsed before the handler runs, so the handler receives only messages that match
it. A `cron` makes the job schedulable as well as enqueuable, and an invalid expression throws
as the module loads, long before the trigger would fire.

> [!WARNING]
> The key is the job's name on the wire. A message enqueued by one deploy is consumed by the next,
> so renaming a key is a breaking change for whatever is still on the queue.

## Write a handler

`createJobHandler` pairs a handler with its job, which is what types `ctx.input`:

```typescript {% title="app/jobs/expire-postings.ts" %}
import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { expireBefore } from "~/app/models/posting";

const LIFETIME_MS = 30 * 86_400_000;

export default createJobHandler(jobs.expirePostings, async (ctx) => {
	let closed = await expireBefore(ctx.db, Date.now() - LIFETIME_MS);
	ctx.log.set({ postings: { expired: closed } });
});
```

`expireBefore` is your own model function. `ctx.log` is the run's record, emitted once when
the run ends with the job name, attempt count and how it ended.

Returning normally acks the message. `ctx.retry({ delay: "5 minutes" })` asks for a redelivery
later, `ctx.exit(reason)` gives up for good, and anything else thrown is retried by the
platform. Write each as `return ctx.retry(…)`, so TypeScript knows the lines below are
unreachable.

## Share one queue

Jobs are written to a queue in one place and read from it in another: route handlers enqueue,
and the dispatcher delivers. Build the queue once, in a module both sides import, so they cannot
end up pointed at different backends:

```typescript {% title="app/initializers/queue.ts" %}
import * as cloudflare from "@sdxc/jobs/cloudflare";
import { env } from "cloudflare:workers";

export const queue = cloudflare.queue(() => env.QUEUE);
```

`cloudflare.queue` takes a function rather than the binding, so importing this module reads no
binding until something is enqueued.

## Build the dispatcher

The dispatcher owns the middleware chain and the timeout, delivers from the shared queue, and
maps each job to a loader so a handler module is imported only once a message for it arrives.
`database()` from `@sdxc/database-middleware/jobs` publishes the `ctx.db` the handler above
reads:

```typescript {% title="app/initializers/dispatcher.ts" %}
import type { JobQueue } from "@sdxc/jobs/queue";
import type { Database } from "remix/data-table";

import { database } from "@sdxc/database-middleware/jobs";
import { createJobDispatcher } from "@sdxc/jobs";

import { openDatabase } from "~/app/initializers/database";
import { logger } from "~/app/initializers/logger";
import { queue } from "~/app/initializers/queue";
import jobs from "~/app/jobs";

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

	dispatcher.map(jobs.indexPosting, () => import("~/app/jobs/index-posting"));
	dispatcher.map(jobs.expirePostings, () => import("~/app/jobs/expire-postings"));
	return dispatcher;
}

export const dispatcher = createDispatcher();
```

The worker uses the one instance built at module scope. An augmentation of `JobTypes` at the end
of the same module is what gives every handler the context this chain produces:

```typescript {% title="app/initializers/dispatcher.ts" %}
import type { JobDispatcherContext } from "@sdxc/jobs";

declare module "@sdxc/jobs" {
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}
```

The factory's options exist for tests; the defaults are what production runs.

## Enqueue from a request

A route handler enqueues through `ctx.jobs`, which `jobEnqueuer(queue)` from
`@sdxc/jobs/router` publishes. It writes through the shared queue alone, so the dispatcher, its
middleware and every job handler stay out of the request path's module graph:

```typescript {% title="app/initializers/router.ts" %}
import { jobEnqueuer } from "@sdxc/jobs/router";
import { log } from "@sdxc/logger/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { createRouter } from "remix/router";

import { logger } from "~/app/initializers/logger";
import { queue } from "~/app/initializers/queue";

export function createWebRouter() {
	return createRouter({
		middleware: [log(logger), trace(), jobEnqueuer(queue)],
	});
}
```

Listing `trace()` before it makes every message carry the request's trace, so each job run
links back to the request that enqueued it. A handler then enqueues with exactly the payload
the job's schema accepts:

```typescript {% title="app/http/controllers/publish-posting.ts" %}
import { redirect } from "@sdxc/http/response";
import { createAction } from "remix/router";

import jobs from "~/app/jobs";
import { publishPosting } from "~/app/models/posting";
import routes from "~/routes/web";

export default createAction(routes.postings.create, async (ctx) => {
	let posting = await publishPosting(ctx.formData);
	await ctx.jobs.enqueue(jobs.indexPosting, { postingId: posting.id });

	return redirect(routes.postings.index.href(), {
		status: redirect.Status.SeeOther,
	});
});
```

`publishPosting` is your own model function, and `index-posting.ts` a handler like the sweep
above. When the queue refuses a send, `enqueue` throws, so the request fails instead of
reporting work that will never run.

## Wire the Worker

`cloudflare.worker(dispatcher)` returns the `scheduled` and `queue` handlers a Worker exports,
beside the `fetch` handler the router from `createWebRouter()` answers:

```typescript {% title="bootstrap/worker.ts" %}
import * as cloudflare from "@sdxc/jobs/cloudflare";

import { dispatcher } from "~/app/initializers/dispatcher";
import { createWebRouter } from "~/app/initializers/router";

const handlers = cloudflare.worker(dispatcher);

export default {
	fetch: (request: Request) => createWebRouter().fetch(request),
	scheduled: (controller: ScheduledController) => handlers.scheduled(controller),
	queue: (batch: MessageBatch) => handlers.queue(batch),
} satisfies ExportedHandler<Cloudflare.Env>;
```

A cron delivery only enqueues every job declaring the expression that fired, so the nightly
sweep gets the same retries, timeout and dead-letter handling as any other message:

```mermaid {% alt="Route handlers and cron triggers both enqueue onto the app-jobs queue; the dispatcher runs each job, acking it when it returns or exits, and on a retry or throw sending it back to the queue until maxRetries, after which it goes to dead-letter handling" %}
flowchart LR
    Handler["Route handler: ctx.jobs.enqueue"] --> Queue[("app-jobs queue")]
    Cron[Cron trigger] -->|enqueues only| Queue
    Queue --> Dispatcher[Dispatcher runs the job]
    Dispatcher -->|returns| Acked([acked])
    Dispatcher -->|ctx.exit| Refused(["acked, ends as refuse"])
    Dispatcher -->|ctx.retry or throw| Left{attempts left?}
    Left -->|yes| Queue
    Left -->|"no, after maxRetries"| Dead([dead-letter handling])
```

The Worker's configuration declares the cron trigger with the same spelling, the queue the
Worker consumes, and the `QUEUE` binding it produces to:

```typescript {% title="cloudflare.config.ts" %}
import { bindings, defineConfig, triggers } from "cf/config";

export default defineConfig({
	worker: {
		name: "jobs-board",
		entrypoint: "./bootstrap/worker.ts",
		triggers: [
			triggers.scheduled({ schedule: "0 3 * * *" }),
			triggers.queue({ name: "app-jobs", maxRetries: 3 }),
		],
		env: {
			QUEUE: bindings.queue({ name: "app-jobs" }),
		},
	},
});
```

[`sdxc make job`](/docs/sdxc/make-job) declares, maps and tests a scheduled job and adds its
trigger in one step:

```bash
sdxc make job expire-postings --cron "0 3 * * *"
```

> [!WARNING]
> A scheduled job whose trigger is missing from the Worker's configuration never runs in
> production. `dispatcher.crons` lists the distinct schedules the mapped jobs declare, so one test
> comparing it against your configuration catches a job whose trigger was never added.

## Run jobs in a test

`@sdxc/jobs/memory` is a queue held in an array. Build the dispatcher over one and over a test
database, such as the in-memory D1 from
[Query D1 and Durable Object SQL](/docs/data-and-background-work/databases), enqueue, and drain
the queue through the dispatcher:

```typescript {% title="app/jobs/expire-postings.test.ts" %}
import * as memory from "@sdxc/jobs/memory";
import { expect, test } from "vitest";

import { createDispatcher } from "~/app/initializers/dispatcher";
import jobs from "~/app/jobs";
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

The middleware and handlers are the ones production runs; the test substitutes only the queue
and the database.

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
across a daylight saving change. A frequent cron job calls
`schedule.isDue(lastRun, { now, timeZone })` to find the user schedules that are due.

## Where to go next

- [Send email](/docs/data-and-background-work/send-email) — queue a declared email for the job
  that delivers every queued email.
- [Send alerts to chat and paging services](/docs/data-and-background-work/messaging) — a
  delivery job that retries Slack, Discord and PagerDuty sends.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — reading the record
  every run emits.
