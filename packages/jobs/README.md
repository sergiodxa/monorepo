# @sdxc/jobs

Background jobs for Cloudflare Queues, declared in one map and run by one dispatcher.

## Overview

A job is declared, not implemented, in the map: its name, the payload it carries, the
cron it runs on, and the monitor that watches it. The map is declaration and nothing
else — no handler, no queue — so importing it costs its schemas. The handler lives in
its own module and is loaded only when a message for it arrives.

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
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

export default jobs({
	clean: job({ cron: "0 0 * * *", monitorId: "8f1c…" }),
	checkHttp: job({ input: s.object({ monitorId: s.string() }) }),
	digests: {
		daily: job({ cron: "0 8 * * *" }),
		weekly: job({ cron: "0 9 * * 1" }),
		},
	},
});
```

Nested keys are dot-joined, so `digests.daily` is that job's name.

### Writing a handler

```typescript
import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";

export default createJobHandler(jobs.checkHttp, async (ctx) => {
	let monitor = await ctx.database.find(ctx.input.monitorId);
	ctx.logger.info("check.started", { monitorId: monitor.id });
});
```

### Wiring the worker

```typescript
import { createJobDispatcher } from "@sdxc/jobs";

import jobs from "~/app/jobs";

export const dispatcher = createJobDispatcher({
	send: sendQueueBatch,
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
await dispatcher.enqueue(jobs.checkHttp, { monitorId: monitor.id });
await dispatcher.enqueueMany(
	jobs.checkHttp,
	monitors.map((m) => ({ monitorId: m.id })),
);
```

A call site that should not pull the dispatcher — and its middleware, loaders, and every
handler behind them — into its module graph builds the body instead and sends it through
whatever the app already writes with:

```typescript
await sendQueueBatch([messageBody(jobs.checkHttp, { monitorId: monitor.id })]);
```

## API

### `jobs(tree: JobTree): JobMap`

Builds the app's job map, naming every leaf after the key it is filed under.

**Parameters:**

- `tree`: The declared jobs, keyed by the name each is known by on the wire. Groups may
  nest, and a nested job's name is its dot-joined path

**Returns:**

- The same shape, with every leaf a `JobDefinition` that knows its name, schedule,
  monitor, and schema

**Example:**

```typescript
export default jobs({ clean: job({ cron: "0 0 * * *" }) });
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

### `messageBody(job: JobDefinition, input?): JSONValue`

Builds the body one message carries: the payload's fields plus the `type` that names the
job. For a call site that sends through the app's own queue helper rather than through
the dispatcher.

**Example:**

```typescript
await sendQueueBatch([messageBody(jobs.notify, { monitorId: monitor.id })]);
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

- `options.send`: `(bodies: JSONValue[]) => Promise<void>` — the app's queue write, used
  by `enqueue` and by the cron trigger. A dispatcher without one still runs what the
  queue delivers, and refuses to enqueue
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

#### `dispatcher.enqueue(job: JobDefinition, input?): Promise<void>`

Enqueues one message for a job. Takes exactly what the job's schema accepts, and no
argument at all for a job that declares none. Loads no handler.

**Example:**

```typescript
await dispatcher.enqueue(jobs.verifyDomain, { teamDomainId: domain.id });
await dispatcher.enqueue(jobs.clean);
```

#### `dispatcher.enqueueMany(job: JobDefinition, inputs): Promise<void>`

Enqueues one message per input in a single write. Enqueuing nothing writes nothing.

**Example:**

```typescript
await dispatcher.enqueueMany(
	jobs.notify,
	changes.map((change) => ({ id: change.id })),
);
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
expect([...dispatcher.crons].sort()).toEqual([...config.triggers.crons].sort());
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

#### `ctx.require(key: ContextKey): value`

The same, refusing to continue when nothing published one. This is how one middleware
reads what an earlier middleware put on the context: inside a chain the context is the
bare one, so an installed property like `ctx.database` is not visible there — only the
key is.

**Example:**

```typescript
let database = ctx.require(Database);
```

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
`@sdxc/jobs/errors` exports each one individually, which is what a type position
needs.

| Ending             | Thrown by       | What the dispatcher does                       |
| ------------------ | --------------- | ---------------------------------------------- |
| `Job.Ack`          | `ctx.ack()`     | Ping the monitor, ack, log `job.completed`     |
| `Job.Retry`        | `ctx.retry()`   | Log `job.retrying`, retry, holding for `delay` |
| `Job.NonRetriable` | `ctx.exit()`    | Log `job.non-retriable`, ack                   |
| `Job.Timeout`      | `ctx.timeout()` | Log `job.timed-out`, retry, ping nothing       |

**Example:**

```typescript
import { Job } from "@sdxc/jobs";
import type { Retry } from "@sdxc/jobs/errors";

function holdFor(error: Retry) {
	return error.delay;
}

try {
	await charge(invoice);
} catch (error) {
	if (error instanceof Job.Ending) throw error; // Never swallow an ending.
	ctx.retry({ reason: "Charge failed", delay: "1 minute", cause: error });
}
```

`Job.Ending` is the base all four share, so a broad `catch` re-throws whichever one the
handler chose without naming each.

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
declare module "@sdxc/jobs" {
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
import type { JobMiddleware } from "@sdxc/jobs";

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

## Pattern: One Body Of Work, Several Schedules

Two leaves that differ only by schedule share their work through a plain function, and
each gets its own thin handler module. A handler is paired with exactly one job — the
dispatcher refuses a handler mapped to a different one — so the sharing happens below
`createJobHandler`, not around it.

```typescript
// app/jobs/send-team-digests.ts
export async function sendTeamDigests(ctx: JobHandlerContext<undefined>, period: "day" | "week") {
	await mailDigests(ctx.database, period);
}

// app/jobs/send-team-daily-digests.ts
export default createJobHandler(jobs.sendTeamDailyDigests, (ctx) => sendTeamDigests(ctx, "day"));

// app/jobs/send-team-weekly-digests.ts
export default createJobHandler(jobs.sendTeamWeeklyDigests, (ctx) => sendTeamDigests(ctx, "week"));
```

Each leaf keeps its own monitor and its own loader, so one schedule failing is one
monitor alerting.

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
	await dispatcher.enqueueMany(
		jobs.checkHttp,
		due.map((m) => ({ monitorId: m.id })),
	);
	ctx.logger.info("checks.enqueued", { count: due.length });
});
```

## Pattern: Testing A Handler

A handler is a function over a context, so a test builds the context and calls it. No
queue, no worker, no container.

```typescript
import { createJobContext, Job } from "@sdxc/jobs";

import handler from "~/app/jobs/clean";
import { Database } from "~/app/jobs/middleware/database";

test("deletes rows past the retention window", async () => {
	let ctx = createJobContext(jobs.clean, { id: "message-1", attempts: 1 });
	ctx.set(Database, await testDatabase(), { property: "database" });

	await handler(ctx);
});

test("asks for a retry while the API is rate limiting", async () => {
	let ctx = createJobContext(jobs.checkHttp, { id: "message-1", attempts: 1, input });

	await expect(handler(ctx)).rejects.toBeInstanceOf(Job.Retry);
});
```

`createJobContext` types the context the way the handler receives it — including whatever
the app declared its middleware installs. Building one skips that chain, so the test
populates what the chain would have; `new JobContext(...)` is the untyped equivalent the
dispatcher itself uses.

## Related Packages

- [`@sdxc/logger`](/packages/logger) - Batched logging, one entry per job
- [`@sdxc/duration`](/packages/duration) - The duration strings a retry delay and a timeout take
- [`@sdxc/validate`](/packages/validate) - Standard Schema validation, used to parse a payload
- [`@sdxc/cron`](/packages/cron) - Parses the cron a job declares, and rejects one the platform would not accept
- [`@sdxc/cloudflare-mocks`](/packages/cloudflare-mocks) - Queue binding that drives a consumer in tests

## Tips

1. **Spell a cron exactly as its trigger** - A valid expression still fires nothing if
   `wrangler.jsonc` does not name it, and `job()` cannot know that. Assert
   `dispatcher.crons` against the config in a test.
2. **Treat a map key as a wire contract** - Renaming one renames a message type, and
   messages enqueued by the previous deploy are still in flight.
3. **Map a loader, not a handler** - `() => import(…)` is what keeps job code out of the
   request path's module graph. For the same reason, prefer `messageBody()` plus the
   app's own queue helper when a controller enqueues, over importing the dispatcher.
4. **Never swallow an ending** - A `catch` around a `ctx.*` call catches the thrown
   ending too. Re-throw it with `if (error instanceof Job.Ending) throw error;`.
5. **Write `return ctx.retry(…)`** - The verbs return `never`, but TypeScript only
   narrows on a never-returning call through a `const` name, and `ctx` is a parameter —
   so returning is what tells the compiler the lines below are unreachable.
6. **Reach for `ctx.exit()` for bad input** - Invalid data will not become valid on a
   redelivery, so acking and recording beats spending the retries.
7. **Pass `ctx.signal` to every fetch** - It is what makes a timeout cancel work rather
   than merely stop waiting for it.
8. **Let a monitor mean what it says** - A run that timed out pings nothing, so a
   monitor alerting is evidence the job really stopped completing.
