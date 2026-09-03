# @pkg/jobs-next

Background jobs for Cloudflare Queues: one map declares them, one router runs them,
and handlers are ordinary functions that read what they need off a context.

## Overview

A job is declared, not implemented, in the map: its name, the payload it carries, the
cron it runs on, and the monitor that watches it. The handler lives in its own module
and is loaded only when a message for it arrives, so enqueuing a job from a request
handler costs a schema rather than the job's whole dependency tree.

Every job is enqueuable. A job that declares a `cron` is additionally schedulable, and
the two share one path: a cron delivery enqueues a message and returns, so a scheduled
job gets the same middleware, timeout, logging, retries, and dead-letter queue as any
other. Nothing runs inside the `scheduled` handler.

## Usage

### Declaring the map

The key is the job's name, and the name is the message `type` — a wire contract, since
messages enqueued by one deploy are consumed by the next.

```typescript
import { job, jobs } from "@pkg/jobs-next";
import * as s from "remix/data-schema";

export default jobs(
	{
		clean: job({ cron: "0 0 * * *", monitorId: "8f1c…" }),
		checkHttp: job({ input: s.object({ monitorId: s.string() }) }),
		digests: {
			daily: job({ cron: "0 8 * * *" }),
			weekly: job({ cron: "0 9 * * 1" }),
		},
	},
	{ send: sendQueueBatch },
);
```

Nested keys are dot-joined, so `digests.daily` is that job's name. `send` is the app's
queue write — a function rather than a binding, so an app that prices its queue
operations or chunks a batch at the platform's limit does that in one place.

### Writing a handler

```typescript
import { createJobHandler } from "@pkg/jobs-next";

import jobs from "~/app/jobs";

export default createJobHandler(jobs.checkHttp, async ({ input, logger, database }) => {
	let monitor = await database.find(input.monitorId);
	logger.info("check.started", { monitorId: monitor.id });
});
```

Passing the job is what types `ctx.input`, and it is also what the router checks the
handler was mapped to.

### Wiring the worker

```typescript
import { createJobRouter } from "@pkg/jobs-next";

import jobs from "~/app/jobs";

export const router = createJobRouter({
	middleware: [database()],
	timeout: "5 minutes",
	uptime: () => env.UPTIME_CRON_API_KEY,
	deadLetterQueue: "ping-dlq",
	onInvalid: (_message, body) => env.DLQ.send(body, { contentType: "json" }),
});

router.map(jobs.clean, () => import("~/app/jobs/clean"));
router.map(jobs.checkHttp, () => import("~/app/jobs/check-http"));
```

```typescript
export default {
	async scheduled(controller) {
		await router.scheduled(controller);
	},

	async queue(batch) {
		await router.queue(batch);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
```

### Middleware and context

Middleware runs around every job and publishes what handlers read. Keys come from
`remix/router`, so one key serves both an HTTP middleware and a job middleware.

```typescript
import type { JobMiddleware } from "@pkg/jobs-next";

import { createContextKey } from "remix/router";

export const Database = createContextKey<Database>();

export function database(): JobMiddleware<{
	key: typeof Database;
	value: Database;
	property: "database";
}> {
	return async (ctx, next) => {
		ctx.set(Database, connect(), { property: "database" });
		await next();
	};
}
```

Naming the router's context once makes every handler see what its chain installed:

```typescript
declare module "@pkg/jobs-next" {
	interface JobTypes {
		context: JobRouterContext<typeof router>;
	}
}
```

### Enqueuing

```typescript
await jobs.checkHttp.enqueue({ monitorId: monitor.id });
await jobs.checkHttp.enqueueAll(monitors.map((monitor) => ({ monitorId: monitor.id })));
```

`enqueue` takes exactly what the job's schema accepts, and takes no argument at all for
a job that declares none. A batch is one write, and enqueuing nothing writes nothing.

### Ending a delivery

| From the handler                       | What happens                                                                |
| -------------------------------------- | --------------------------------------------------------------------------- |
| Return                                 | Ping the job's monitor, ack, log `job.completed`                            |
| `throw new RetryError(msg, { delay })` | Log `job.retrying`, retry the message, optionally after a delay             |
| `throw new NonRetriableError()`        | Log `job.non-retriable`, ack — a redelivery reaches the same result         |
| `throw new JobTimeout()`               | Log `job.timed-out`, retry, no ping                                         |
| `ctx.ack()`                            | Settle now and keep going, for work already durable                         |
| `ctx.retry({ delay: "5 minutes" })`    | Settle for redelivery; return next                                          |
| Anything else thrown                   | Log `job.failed` and re-throw, leaving the platform to retry the invocation |

The first settlement wins, and the router settles nothing a handler already settled.

### Timeouts

`timeout` bounds how long the router waits for one job. It cannot stop a handler —
nothing can stop a promise — so what it does is abort `ctx.signal`, cancelling the I/O
that agreed to be cancelled, and stop the batch being held open by one stuck job.

```typescript
export default createJobHandler(jobs.checkFlows, async ({ signal, database }) => {
	for (let flow of await flowsDue(database)) {
		if (signal.aborted) throw new JobTimeout();
		await runFlow(flow, { signal });
	}
});
```

At the deadline the signal aborts and the handler has a short grace to give up on its
own, before the router leaves the message unacked for redelivery. A handler whose work
is durable and must not repeat can `ctx.ack()` instead. A run whose signal aborted
reports `job.timed-out` and pings no monitor however it was settled.

## API

| Export               | What it is                                                               |
| -------------------- | ------------------------------------------------------------------------ |
| `jobs()`             | Builds the map, naming every leaf after its key and binding it to `send` |
| `job()`              | Declares one leaf: `input`, `cron`, `monitorId`                          |
| `createJobHandler()` | Pairs a handler with the job it runs, and types its payload              |
| `createJobRouter()`  | The registry both worker handlers delegate to                            |
| `JobContext`         | The context handlers and middleware share; tests build one directly      |
| `JobTimeout`         | Give up because the timeout fired                                        |
| `RetryError`         | Retry this delivery, optionally after a `delay`                          |
| `NonRetriableError`  | Ack this delivery; it will not get better                                |

### Router

| Member                  | What it does                                                                   |
| ----------------------- | ------------------------------------------------------------------------------ |
| `map(job, load)`        | Registers a handler, as a loader or the handler itself. Loads once per isolate |
| `queue(batch)`          | Runs every message concurrently, settling when all of them have                |
| `scheduled(controller)` | Enqueues every mapped job on that cron, in one write. Runs none of them        |
| `crons`                 | The distinct schedules its jobs declare, for asserting against a config        |

### Context

| Property                    | What it carries                                          |
| --------------------------- | -------------------------------------------------------- |
| `input`                     | The payload, parsed against the job's schema             |
| `name`, `cron`, `monitorId` | The job's own declaration                                |
| `id`, `attempts`            | The delivery's identifier and delivery count             |
| `batchSize`                 | How many messages share this invocation                  |
| `logger`                    | A batched logger, flushed as one entry when the job ends |
| `signal`                    | Aborts when the timeout expires                          |
| `ack`, `retry`              | Settle this delivery                                     |
| `get`, `has`, `set`         | The typed key store middleware publishes through         |

## Testing

A handler is a function over a context, so a test builds the context and calls it. No
queue, no worker, no container.

```typescript
import handler from "~/app/jobs/clean";

test("deletes rows past the retention window", async () => {
	let ctx = new JobContext(jobs.clean, { id: "message-1", attempts: 1 });
	ctx.set(Database, await testDatabase(), { property: "database" });

	await handler(ctx);

	expect(ctx.settlement).toBeUndefined();
});
```

A context built without a message records what the handler asked for on
`ctx.settlement` rather than calling a platform, so a retry is asserted like a row.

## Related Packages

- [`@pkg/logger`](/packages/logger) - Batched logging for Cloudflare Workers
- [`@pkg/duration`](/packages/duration) - The duration strings a retry delay and a timeout take
- [`@pkg/validate`](/packages/validate) - Standard Schema validation, used to parse a payload
- [`@pkg/cloudflare-mocks`](/packages/cloudflare-mocks) - Queue binding that drives a consumer in tests
