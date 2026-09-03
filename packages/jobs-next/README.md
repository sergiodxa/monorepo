# @pkg/jobs-next

Background jobs for Cloudflare Queues, declared in one map and run by one dispatcher.

## Overview

A job is declared, not implemented, in the map: its name, the payload it carries, the
cron it runs on, and the monitor that watches it. The handler lives in its own module
and is loaded only when a message for it arrives, so enqueuing a job from a request
handler costs a schema rather than the job's whole dependency tree.

Every job is enqueuable. A job that declares a `cron` is additionally schedulable, and
the two share one path: a cron delivery enqueues a message and returns, so a scheduled
job gets the same middleware, timeout, logging, retries, and dead-letter queue as any
other. Nothing runs inside the `scheduled` handler.

The shape mirrors the way this repository routes HTTP — a map of addressable
definitions, a runtime that maps handlers onto them, and middleware that publishes
values into a typed context. Context keys come from
[`remix/router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router),
so one key serves an HTTP middleware and a job middleware alike.

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

Nested keys are dot-joined, so `digests.daily` is that job's name.

### Writing a handler

```typescript
import { createJobHandler } from "@pkg/jobs-next";

import jobs from "~/app/jobs";

export default createJobHandler(jobs.checkHttp, async (ctx) => {
	let monitor = await ctx.database.find(ctx.input.monitorId);
	ctx.logger.info("check.started", { monitorId: monitor.id });
});
```

### Wiring the worker

```typescript
import { createJobDispatcher } from "@pkg/jobs-next";

import jobs from "~/app/jobs";

export const dispatcher = createJobDispatcher({
	middleware: [database()],
	timeout: "5 minutes",
	uptime: () => env.UPTIME_CRON_API_KEY,
	deadLetterQueue: "ping-dlq",
	onInvalid: (_message, body) => env.DLQ.send(body, { contentType: "json" }),
});

dispatcher.map(jobs.clean, () => import("~/app/jobs/clean"));
dispatcher.map(jobs.checkHttp, () => import("~/app/jobs/check-http"));
```

```typescript
export default {
	async scheduled(controller) {
		await dispatcher.scheduled(controller);
	},

	async queue(batch) {
		await dispatcher.queue(batch);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
```

### Enqueuing a job

```typescript
await jobs.checkHttp.enqueue({ monitorId: monitor.id });
await jobs.checkHttp.enqueueMany(monitors.map((monitor) => ({ monitorId: monitor.id })));
```

## API

### `jobs(tree: JobTree, options: JobsOptions): JobMap`

Builds the app's job map, naming every leaf after the key it is filed under and binding
it to the queue the app writes through.

**Parameters:**

- `tree`: The declared jobs, keyed by the name each is known by on the wire. Groups may
  nest, and a nested job's name is its dot-joined path
- `options.send`: `(bodies: JSONValue[]) => Promise<void>` — the app's queue write

**Returns:**

- The same shape, with every leaf a `JobDefinition` that knows its name and can enqueue

**Example:**

```typescript
export default jobs({ clean: job({ cron: "0 0 * * *" }) }, { send: sendQueueBatch });
```

### `job(options?: JobOptions): JobLeaf`

Declares one job for a map. Holds no handler, so importing a map costs its schemas.

**Parameters:**

- `options.input`: Object schema parsed before the handler runs. Absent means no payload
- `options.cron`: Cron expression this job is enqueued on, spelled exactly as the
  matching trigger in `wrangler.jsonc`. Parsed here, so an expression the platform would
  reject throws at declaration; the type is five space-separated fields, so anything
  coarser than that is a compile error. Absent means it is only ever enqueued explicitly
- `options.monitorId`: Uptime cron monitor to ping once a run completes

**Returns:**

- The leaf to file under the name this job is known by

**Throws:**

- `InvalidCronExpression` when `cron` is not an expression the platform would accept,
  naming the offending field and its position

**Example:**

```typescript
let checkHttp = job({ input: s.object({ monitorId: s.string() }), monitorId: "8f1c…" });

job({ cron: "0 99 * * *" }); // Throws: out-of-range in the hour field at position 2
job({ cron: "invalid" }); // Type error: not five fields
```

### `definition.enqueue(input): Promise<void>`

Enqueues one message for a job. Takes exactly what the job's schema accepts, and takes
no argument at all for a job that declares none. Loads no handler.

**Example:**

```typescript
await jobs.verifyDomain.enqueue({ teamDomainId: domain.id });
await jobs.clean.enqueue();
```

### `definition.enqueueMany(inputs): Promise<void>`

Enqueues one message per input in a single write. Enqueuing nothing writes nothing.

**Parameters:**

- `inputs`: One payload per message

**Example:**

```typescript
await jobs.notify.enqueueMany(changes.map((change) => ({ monitorId: change.id })));
```

### `createJobHandler(job: JobDefinition, handler: JobHandlerFunction): JobHandler`

Pairs a handler with the job it runs. Passing the job is what types `ctx.input`, and it
is what the dispatcher checks the handler was mapped to.

**Parameters:**

- `job`: The job this handler runs, from the app's map
- `handler`: The work, receiving one context

**Returns:**

- The handler, carrying the job it belongs to

**Example:**

```typescript
export default createJobHandler(jobs.clean, async (ctx) => {
	ctx.logger.info("clean.completed");
});
```

### `createJobDispatcher(options?: JobDispatcherOptions): JobDispatcher`

Builds the registry both worker handlers delegate to.

**Parameters:**

- `options.middleware`: Chain every job runs inside, in the order declared
- `options.timeout`: How long a job gets before `ctx.signal` aborts and the dispatcher
  stops waiting
- `options.uptime`: `() => string | undefined` — resolves the monitor-ping token
- `options.deadLetterQueue`: Name of the dead-letter queue this worker also consumes,
  so its batches are recorded and acked here rather than dispatched
- `options.onInvalid`: Forwards a refused message, already wrapped as `{ invalid: body }`

**Returns:**

- A dispatcher with `map`, `queue`, `scheduled`, and `crons`

**Example:**

```typescript
export const dispatcher = createJobDispatcher({ middleware: [database()] });
```

#### `dispatcher.map(job: JobDefinition, load): void`

Registers where a job's handler comes from. Throws when that name is already mapped.

**Parameters:**

- `job`: The job, from the app's map
- `load`: A loader returning the handler's module, or the handler itself. A loader is
  awaited once per isolate, and only after a message has matched and parsed

**Example:**

```typescript
dispatcher.map(jobs.clean, () => import("~/app/jobs/clean"));
```

#### `dispatcher.queue(batch: MessageBatch): Promise<void>`

Runs every message in the batch concurrently, settling when all of them have. Batches
from the dead-letter queue are recorded and acked instead.

**Example:**

```typescript
async queue(batch) {
	await dispatcher.queue(batch);
}
```

#### `dispatcher.scheduled(controller: ScheduledController): Promise<void>`

Enqueues every mapped job whose `cron` equals the trigger's, in one write. Runs none of
them, and loads no handler.

**Example:**

```typescript
async scheduled(controller) {
	await dispatcher.scheduled(controller);
}
```

#### `dispatcher.crons: string[]`

The distinct schedules the mapped jobs declare, for asserting that the code and
`wrangler.jsonc` agree.

**Example:**

```typescript
expect(dispatcher.crons.toSorted()).toEqual(config.triggers.crons.toSorted());
```

### `JobContext`

The context every middleware and handler shares for one delivery.

#### `new JobContext(job: JobDefinition, init: JobContextInit)`

Builds a context. The dispatcher does this per delivery; a test does it to call a
handler directly.

**Parameters:**

- `job`: The job being run, which supplies `name`, `cron`, and `monitorId`
- `init.id`: The queue message's id
- `init.attempts`: Which delivery of this message this is, counting from one
- `init.input`: The payload, already parsed against the job's schema
- `init.batchSize`: How many messages share this invocation. Defaults to one
- `init.logger`: Where this job's events go. One is created when omitted
- `init.signal`: Aborts when the job's timeout expires. Never aborts when omitted

**Example:**

```typescript
let ctx = new JobContext(jobs.clean, { id: "message-1", attempts: 1 });
```

#### Properties

- `ctx.input`: The payload, typed by the job's schema
- `ctx.name`, `ctx.cron`, `ctx.monitorId`: The job's own declaration
- `ctx.id`, `ctx.attempts`: The delivery's identifier and delivery count
- `ctx.batchSize`: How many messages share this invocation
- `ctx.logger`: A batched logger, flushed as one entry when the job ends
- `ctx.signal`: Aborts when the timeout expires

#### `ctx.ack(reason?: string): never`

Finishes here: the delivery is acked and the run reported as completed. What returning
does, from anywhere in the call stack. Throws `Ack`.

#### `ctx.retry(options?: RetryOptions): never`

Gives up on this delivery and asks for another. Throws `Retry`.

**Parameters:**

- `options.delay`: How long the platform holds the message, as a duration
- `options.cause`: What led here

**Example:**

```typescript
if (response.status === 429) ctx.retry({ delay: "5 minutes" });
```

#### `ctx.exit(reason?: string, options?: ErrorOptions): never`

Gives up for good: the delivery is acked, because a redelivery reaches the same result,
and the run is reported as a failure. Throws `NonRetriable`.

**Example:**

```typescript
if (team === null) ctx.exit("Team no longer exists");
```

#### `ctx.timeout(reason?: string): never`

Gives up because time ran out: the delivery is retried and no monitor is told the job
ran. Throws `Timeout`.

#### `ctx.get(key: ContextKey): value | undefined`

Reads a value some middleware published, falling back to the key's default.

#### `ctx.has(key: ContextKey): boolean`

Whether a value has been published for a key.

#### `ctx.set(key: ContextKey, value, options?: { property: string }): void`

Publishes a value, optionally installing it as a direct property so handlers read
`ctx.database` rather than `ctx.get(Database)`.

**Example:**

```typescript
ctx.set(Database, connect(), { property: "database" });
```

### Endings

Each verb throws its own class. `Job` groups them for `instanceof`, and
`@pkg/jobs-next/errors` exports each one individually, which is what a type position
needs.

| Ending             | Thrown by       | What the dispatcher does                       |
| ------------------ | --------------- | ---------------------------------------------- |
| `Job.Ack`          | `ctx.ack()`     | Ping the monitor, ack, log `job.completed`     |
| `Job.Retry`        | `ctx.retry()`   | Log `job.retrying`, retry, holding for `delay` |
| `Job.NonRetriable` | `ctx.exit()`    | Log `job.non-retriable`, ack                   |
| `Job.Timeout`      | `ctx.timeout()` | Log `job.timed-out`, retry, ping nothing       |

**Example:**

```typescript
import { Job } from "@pkg/jobs-next";
import type { Retry } from "@pkg/jobs-next/errors";

function holdFor(error: Retry) {
	return error.delay;
}

try {
	await charge(invoice);
} catch (error) {
	if (error instanceof Job.Retry) throw error; // Never swallow an ending.
	ctx.retry({ delay: "1 minute", cause: error });
}
```

### Types

#### `JobMiddleware<Effect>`

```typescript
type JobMiddleware<Effect> = (ctx: JobContext, next: () => Promise<void>) => Promise<void>;
```

The `Effect` names what the middleware publishes — `{ key, value, property }` — which is
what makes an installed property visible to handlers.

#### `JobTypes`

Augmented by an app to name the context its handlers receive.

```typescript
declare module "@pkg/jobs-next" {
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}
```

#### `SendMessages`

```typescript
type SendMessages = (bodies: JSONValue[]) => Promise<void>;
```

## Pattern: Middleware That Provides A Database

Middleware publishes what handlers read, so a handler names no container and a test
provides its own.

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

## Pattern: One Handler For Several Schedules

Two leaves that differ only by schedule share one handler, which reads `ctx.cron` to
tell them apart.

```typescript
// app/jobs/index.ts
digests: {
	daily: job({ cron: "0 8 * * *", monitorId: "3d1a…" }),
	weekly: job({ cron: "0 9 * * 1", monitorId: "77b2…" }),
}

// app/jobs/dispatcher.ts
dispatcher.map(jobs.digests.daily, () => import("~/app/jobs/digests"));
dispatcher.map(jobs.digests.weekly, () => import("~/app/jobs/digests"));

// app/jobs/digests.ts
export default createJobHandler(jobs.digests.daily, async (ctx) => {
	let since = ctx.cron === "0 9 * * 1" ? "7 days" : "1 day";
	await sendDigests(ctx.database, since);
});
```

## Pattern: Cooperative Cancellation

A timeout aborts `ctx.signal` and stops the dispatcher waiting; it cannot stop a
handler. A loop that checks between iterations gives up cleanly, and a handler whose
work is already durable acks instead so a redelivery does not repeat it.

```typescript
export default createJobHandler(jobs.sendDigests, async (ctx) => {
	for (let team of await teamsDue(ctx.database)) {
		if (ctx.signal.aborted) ctx.ack(); // The mail already sent must not be sent twice.
		await sendDigest(team, { signal: ctx.signal });
	}
});
```

## Pattern: A Job That Enqueues Other Jobs

A sweep that fans work out is an ordinary cron job whose handler enqueues, which keeps
the fan-out on the queue instead of inside the cron trigger's budget.

```typescript
export default createJobHandler(jobs.enqueueDueChecks, async (ctx) => {
	let due = await claimDue(ctx.database, Date.now());
	await jobs.checkHttp.enqueueMany(due.map((monitor) => ({ monitorId: monitor.id })));
	ctx.logger.info("checks.enqueued", { count: due.length });
});
```

## Pattern: Testing A Handler

A handler is a function over a context, so a test builds the context and calls it. No
queue, no worker, no container.

```typescript
import { Job, JobContext } from "@pkg/jobs-next";

import handler from "~/app/jobs/clean";
import { Database } from "~/app/jobs/middleware/database";

test("deletes rows past the retention window", async () => {
	let ctx = new JobContext(jobs.clean, { id: "message-1", attempts: 1 });
	ctx.set(Database, await testDatabase(), { property: "database" });

	await handler(ctx);
});

test("asks for a retry while the API is rate limiting", async () => {
	let ctx = new JobContext(jobs.checkHttp, { id: "message-1", attempts: 1, input });

	await expect(handler(ctx)).rejects.toBeInstanceOf(Job.Retry);
});
```

## Related Packages

- [`@pkg/logger`](/packages/logger) - Batched logging, one entry per job
- [`@pkg/duration`](/packages/duration) - The duration strings a retry delay and a timeout take
- [`@pkg/validate`](/packages/validate) - Standard Schema validation, used to parse a payload
- [`@pkg/cron`](/packages/cron) - Parses the cron a job declares, and rejects one the platform would not accept
- [`@pkg/cloudflare-mocks`](/packages/cloudflare-mocks) - Queue binding that drives a consumer in tests

## Tips

1. **Spell a cron exactly as its trigger** - A valid expression still fires nothing if
   `wrangler.jsonc` does not name it, and `job()` cannot know that. Assert
   `dispatcher.crons` against the config in a test.
2. **Treat a map key as a wire contract** - Renaming one renames a message type, and
   messages enqueued by the previous deploy are still in flight.
3. **Map a loader, not a handler** - `() => import(…)` is what keeps job code out of the
   request path's module graph.
4. **Never swallow an ending** - A `catch` around a `ctx.*` call catches the thrown
   ending too; re-throw anything you did not mean to handle.
5. **Reach for `ctx.exit()` for bad input** - Invalid data will not become valid on a
   redelivery, so acking and recording beats spending the retries.
6. **Pass `ctx.signal` to every fetch** - It is what makes a timeout cancel work rather
   than merely stop waiting for it.
7. **Let a monitor mean what it says** - A run that timed out pings nothing, so a
   monitor alerting is evidence the job really stopped completing.
