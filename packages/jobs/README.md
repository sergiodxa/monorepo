# @sdxc/jobs

Declared background jobs dispatched over a pluggable queue backend.

A job map declares every job by name: the payload it carries, the cron it runs on and any `meta`
its callers read. A dispatcher maps a lazily loaded handler onto each one and runs it inside a
middleware chain, a timeout and one log record per run. A cron trigger only enqueues, so a
scheduled job gets the same middleware, retries and dead-letter handling as any other.

## Installation

```sh
npm add @sdxc/jobs
```

Payload schemas are any [Standard Schema](https://standardschema.dev), such as `remix/data-schema`
from [`remix`](https://www.npmjs.com/package/remix). The optional peers are
`@cloudflare/workers-types` for `./cloudflare`, `remix` for the context keys and `./router`,
[`@sdxc/cli`](https://www.npmjs.com/package/@sdxc/cli) (with `remix`) for `./cli`, and `vitest`
for `./conformance`.

| Entry point     | Exports                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| `.`             | `jobs`, `job`, `createJobDispatcher`, `createJobHandler`, `JobContext`, … |
| `./cloudflare`  | `queue` and `worker` for Cloudflare Queues                                |
| `./memory`      | An in-memory `queue` for tests and platform-free runs                     |
| `./router`      | `jobEnqueuer()`, the `remix/router` middleware publishing `ctx.jobs`      |
| `./cli`         | `jobEnqueuer()`, the `@sdxc/cli` middleware publishing `ctx.jobs`         |
| `./queue`       | The `JobQueue` interface an adapter implements                            |
| `./errors`      | Each ending class on its own, for type positions                          |
| `./uptime`      | `createUptimeReporter()`, a cron-monitor ping                             |
| `./conformance` | The Vitest suite every queue adapter passes                               |

## Usage

### Declare the jobs

```typescript
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

export default jobs({
	cleanup: job({ cron: "0 0 * * *" }),
	sendReceipt: job({ input: s.object({ orderId: s.string() }) }),
	digests: {
		daily: job({ cron: "0 8 * * *" }),
		weekly: job({ cron: "0 9 * * 1" }),
	},
});
```

A job's name is its key, dot-joined when nested (`digests.daily`), and messages are addressed by
it, so renaming a key strands the messages already in flight. The map holds no handlers, so
importing it costs only its schemas.

### Write a handler

```typescript
import { createJobHandler } from "@sdxc/jobs";

import jobs from "./jobs.js";

export default createJobHandler(jobs.sendReceipt, async (ctx) => {
	let order = await ctx.log.time("db", () => findOrder(ctx.input.orderId));
	ctx.log.set({ order: { id: order.id, total: order.total } });
	await sendReceipt(order, { signal: ctx.signal });
});
```

`ctx.input` is typed by the job's schema. `ctx.log` is the run's record, emitted once when it
ends: `set()` queryable fields, `note()` breadcrumbs, `time()` durations.

### Map handlers onto a dispatcher

```typescript
import { createJobDispatcher } from "@sdxc/jobs";
import * as cloudflare from "@sdxc/jobs/cloudflare";
import { createLogger } from "@sdxc/logger";
import { env } from "cloudflare:workers";

import jobs from "./jobs.js";

export const dispatcher = createJobDispatcher({
	logger: createLogger({ service: "worker" }),
	queue: cloudflare.queue(() => env.QUEUE),
	timeout: "5 minutes",
});

dispatcher.map(jobs.cleanup, () => import("./jobs/cleanup.js"));
dispatcher.map(jobs.sendReceipt, () => import("./jobs/send-receipt.js"));

export default { ...cloudflare.worker(dispatcher) } satisfies ExportedHandler<Env>;
```

A handler module loads once per isolate, only after a message for it has arrived and parsed.
`worker()` turns each cron trigger into `dispatcher.tick()` and each queue batch into
`dispatcher.deliverBatch()`. Spell every `cron` exactly as its trigger in the Worker's config.

### Enqueue a job

```typescript
await dispatcher.enqueue(jobs.sendReceipt, { orderId: order.id });
await dispatcher.enqueue(jobs.cleanup);
await dispatcher.enqueueMany(
	jobs.sendReceipt,
	orders.map((order) => ({ orderId: order.id })),
);
```

Each call takes exactly what the job's schema accepts, and no argument for a job without one. A
route handler enqueues through `ctx.jobs` from `./router`, which brings only the queue into the
request path:

```typescript
import * as cloudflare from "@sdxc/jobs/cloudflare";
import { jobEnqueuer } from "@sdxc/jobs/router";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [jobEnqueuer(cloudflare.queue(() => env.QUEUE))],
});

router.post(routes.orders.receipt, async (ctx) => {
	await ctx.jobs.enqueue(jobs.sendReceipt, { orderId: ctx.params.id });
	return new Response(null, { status: 202 });
});
```

### End a run

```typescript
export default createJobHandler(jobs.sendReceipt, async (ctx) => {
	let order = await findOrder(ctx.input.orderId);
	if (order === null) return ctx.exit("Order no longer exists");

	let response = await fetch(mailerUrl, { method: "POST", signal: ctx.signal });
	if (response.status === 429) return ctx.retry({ delay: "5 minutes", reason: "Rate limited" });
});
```

Returning acks the message. `ctx.ack()`, `ctx.retry()`, `ctx.exit()` and `ctx.timeout()` throw,
so they end the run from anywhere in the call stack; write `return ctx.retry(…)` so TypeScript
reads the lines below as unreachable. Reach for `exit()` when a redelivery would reach the same
result, such as bad input.

## API

### `jobs(tree: JobTree): JobMap`

The job map: the same shape as `tree`, with every leaf a `JobDefinition` carrying its `name`,
`cron`, `input` schema and `meta`.

### `job(options?: JobOptions): JobLeaf`

Declares one job. Every option is optional:

- `input`: the schema the payload is parsed against before the handler runs. An object or a bare
  value both work. Absent means no payload.
- `cron`: the five-field expression the job is enqueued on. Fewer fields is a type error, and an
  expression the platform would reject throws `InvalidCronExpression` from
  [`@sdxc/cron`](https://www.npmjs.com/package/@sdxc/cron) at declaration.
- `meta`: anything the app reads back through `ctx.of(job)`, typed as written.

### `createJobHandler(job, handler): JobHandler`

Pairs a handler with its job, typing `ctx.input`. The dispatcher refuses a handler mapped onto a
different job.

### `createJobContext(job, init: JobContextInit): JobHandlerContext`

A context typed the way the handler receives it, for calling a handler directly in a test. It
skips the middleware chain, so the test publishes what the chain would with `ctx.set()`.

### `messageBody(job, input?): JSONValue`

The body one message carries, `{ job, body?, traceparent?, tracestate? }`, for sending through a
queue client of your own.

```typescript
await env.QUEUE.send(messageBody(jobs.sendReceipt, { orderId }), { contentType: "json" });
```

### `createJobDispatcher(options?: JobDispatcherOptions): JobDispatcher`

- `logger`: a `Logger` from [`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger) whose
  `service` every record carries.
- `queue`: the `JobQueue` to enqueue through. Without one the dispatcher still runs deliveries
  and throws when asked to enqueue.
- `middleware`: the chain every job runs inside, in order. Write it inline so handlers see what
  it installs.
- `timeout`: a duration after which `ctx.signal` aborts. The handler then has five seconds to
  end the run before the dispatcher records a timeout and retries the message.
- `onEnd(ctx, status: JobStatus)`: runs once the ending is decided and before the message is
  settled. A throw is recorded as `job.hook_failed` and running past five seconds as
  `job.hook_overran`; the ending settles as decided either way. It runs after the middleware
  chain has unwound.
- `maxAttempts`: deliveries a message gets before it is dead-lettered, on a queue whose
  `retries` is `"core"`.

| Member                              | Does                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `map(job, load)`                    | Registers a loader `() => import(…)` or the handler; throws on a repeat  |
| `enqueue(job, input?)`              | Sends one message, raising the queue's `JobQueueError`                   |
| `enqueueMany(job, inputs)`          | Sends one message per input in one write; an empty list sends nothing    |
| `deliver(delivery, batchSize?)`     | Runs one `JobDelivery` and answers the `Settlement` to apply             |
| `deliverBatch(deliveries, options)` | Runs a batch in one `queue` record, calling `options.apply` as each ends |
| `tick({ now, only? })`              | Enqueues every due job in one write, running none                        |
| `mapped`                            | Every job with a handler                                                 |
| `crons`                             | The distinct expressions the mapped jobs declare                         |

`tick` with `only` enqueues the jobs declaring that exact expression; without it, the jobs whose
schedule fires in `now`'s UTC minute. `deliverBatch` with `deadLettered: true` records and acks
every delivery instead of running it. A message naming no mapped job or failing its schema is
refused and dead-lettered without loading a handler.

### `JobContext`

What every middleware and handler receives for one delivery. `new JobContext(job, init)` builds
the untyped one the dispatcher uses.

| Member                                 | Is                                                                   |
| -------------------------------------- | -------------------------------------------------------------------- |
| `input`, `name`, `cron`                | The parsed payload and the job's declaration                         |
| `id`, `attempts`, `batchSize`          | The message id, its delivery count from one, and the batch size      |
| `log`                                  | The run's `Log`, emitted once when it ends                           |
| `signal`                               | Aborts when the timeout expires                                      |
| `trace`                                | The W3C trace this run belongs to; jobs it enqueues name it parent   |
| `of(job)`                              | `{ input, meta }` typed by that job, or `null` for another job's run |
| `ack(reason?)`                         | Acks; the run is done                                                |
| `retry({ delay?, reason?, cause? })`   | Retries, held for `delay`                                            |
| `exit(reason?, { cause? })`            | Acks, and records the run as failed                                  |
| `timeout(reason?)`                     | Retries, and records the run as timed out                            |
| `set(key, value, { property? })`       | Publishes a value under a `remix/router` context key                 |
| `get(key)`, `require(key)`, `has(key)` | Reads one back; `require` throws when nothing published it           |

`JobContextInit` takes `id`, `attempts`, and optionally `input`, `batchSize`, `log`, `signal`
and `trace`. Inside a middleware only keys are visible, so read an earlier middleware's value
with `ctx.require(Key)`.

### Endings

The four verbs throw subclasses of `Ending`, grouped as `Job` (`Job.Ack`, `Job.Retry`,
`Job.NonRetriable`, `Job.Timeout`, `Job.Ending`) and exported one by one from `./errors`.
`Retry` carries the `delay` it asked for.

| Ending             | Message                 | `job.ending` | `outcome`  |
| ------------------ | ----------------------- | ------------ | ---------- |
| return, `Job.Ack`  | Acked                   | `done`       | `ok`       |
| `Job.Retry`        | Retried after `delay`   | `retry`      | `degraded` |
| `Job.NonRetriable` | Acked                   | `refuse`     | `error`    |
| `Job.Timeout`      | Retried                 | `timeout`    | `error`    |
| anything else      | Rethrown to the runtime | `failed`     | `error`    |

Once the timeout has aborted the signal, any ending is recorded as `timeout`; `ctx.ack()` still
acks the message.

### Records

Each invocation emits one record through the dispatcher's logger, with flat dotted fields and
the [W3C Trace Context](https://www.w3.org/TR/trace-context/) it ran under (`trace_id`,
`span_id`, `parent_span_id`).

| `kind`  | Fields                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `cron`  | `cron.expression`, `cron.scheduled_at`, `jobs.enqueued`                                                                           |
| `queue` | `queue.name`, `queue.batch_size`, and a `jobs.done`/`retried`/`refused`/`failed`/`timed_out` count                                |
| `job`   | `job.name`, `job.id`, `job.attempts`, `job.batch_size`, `job.cron`, `job.ending`, `job.delay_s`, and whatever the handler `set()` |

A refused message ends `refused` with `job.refusal` (`unknown-job` or `invalid-input`), and one
read off the dead-letter queue ends `dead_letter`; both keep the body as `job.body`. A message
enqueued during a request or another job continues that trace, so the two share a `trace_id`.

### `jobEnqueuer(queue: JobQueue): Middleware` from `./router`

Publishes `ctx.jobs` (a `JobEnqueuer` with `enqueue` and `enqueueMany`) and the `Jobs` context
key. Importing it types `ctx.jobs` on every `RequestContext`, and a failed write throws the
queue's `JobQueueError`.

### `jobEnqueuer(queue: JobQueue, options?: { dispatcher }): CommandMiddleware` from `./cli`

Publishes `ctx.jobs` to an [`@sdxc/cli`](https://www.npmjs.com/package/@sdxc/cli) command under
the same `Jobs` key, writing through `queue`; each message carries the run's trace. With
`options.dispatcher`, `queue` is a memory queue whose jobs run through that dispatcher in the
command's process once the handler settles, round after round until nothing is due. A job that
throws settles as a retry, and messages still delayed are noted as `jobs.pending` on the
command's log.

### `queue(binding)` and `worker(dispatcher, options?)` from `./cloudflare`

`queue(() => env.QUEUE)` writes through a Cloudflare Queue binding, splitting large
`enqueueMany` calls into batches the platform accepts; the platform counts retries.
`worker(dispatcher, options)` answers `{ queue, scheduled }` handlers. `options.deadLetterQueue`
names the dead-letter queue this Worker also consumes, whose batches are recorded and acked, and
`options.deadLetter: () => env.DLQ` is where a refused message is written. A retry delay past 12
hours is held for 12 hours, and `send` fails a `JobMessage.delay` past 12 hours with `unsupported_delay`.

### `queue(options?)` from `./memory`

A `MemoryQueue` holding serialized messages in an array, with its own attempt count
(`retries: "core"`) and dead-letter list. `options.now` supplies the clock. `drain(deliver)`
runs and settles everything claimable, `messages` and `deadLettered` read what it holds, and
`reset()` empties both.

### `JobQueue` from `./queue`

The backend interface. Every call answers a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) failing with a `JobQueueError`
whose `code` is `unavailable`, `invalid_message` or `unsupported_delay`.

```typescript
interface JobQueue {
	readonly retries: "backend" | "core";
	send(messages: JobMessage[]): Promise<Result<void, JobQueueError>>;
	claim?(options: ClaimOptions): Promise<Result<JobDelivery[], JobQueueError>>;
	settle?(delivery: JobDelivery, settlement: Settlement): Promise<Result<void, JobQueueError>>;
}
```

A pushed backend implements `send`; a pulled one adds `claim` and `settle` together. `retries`
says whether the backend or the dispatcher's `maxAttempts` decides when to dead-letter.
`invalidMessage(body)` wraps a refused body for a backend that writes to its dead-letter queue,
and `readDeadLetter(body)` answers `{ reason, body }` for a dead-lettered one.

### `createUptimeReporter({ token, url? })` from `./uptime`

A ping `(monitorId) => Promise<Result<void, UptimeError>>` for a cron monitor, meant for
`onEnd`. `UptimeError.code` is `refused`, `unreachable`, or `unconfigured` when `token()`
answers `undefined`.

### `conformance(options)` from `./conformance`

Registers the Vitest suite a `JobQueue` adapter passes. `options` takes `name`, `create`,
`messages(queue)`, and optionally `advance(ms)` to run the delay tests and `unsupportedDelay` to
run the ceiling tests.

### Types

`JobDefinition`, `JobMap`, `JobTree`, `JobLeaf` and `JobOptions` describe a map, and
`AnyJobDefinition` any job in it. `JobInput<typeof job>` and `JobArgs<typeof job>` name what
enqueuing a job takes, for a helper of your own. `JobHandler`, `JobHandlerFunction` and
`JobHandlerContext<Schema>` describe handlers. `JobMiddleware<Effect>` is a middleware whose
`Effect` (`{ key, value, property }`) names what it installs. `JobTypes` is augmented with
`context: JobDispatcherContext<typeof dispatcher>` to type handlers with what the chain installs.
`JobStatus` is what `onEnd` receives; `JobDelivery`, `JobMessage` and `Settlement` are what a
backend translates.

## Pattern: Middleware That Provides A Database

A middleware publishes a value under a context key and installs it as a property; augmenting
`JobTypes` types that property on every handler.

```typescript
import type { JobDispatcherContext, JobMiddleware } from "@sdxc/jobs";

import { createJobDispatcher, createJobHandler } from "@sdxc/jobs";
import { createContextKey } from "remix/router";

import jobs from "./jobs.js";

export const Database = createContextKey<Database>();

function database(): JobMiddleware<{
	key: typeof Database;
	value: Database;
	property: "database";
}> {
	return async (ctx, next) => {
		let db = await connect();
		ctx.set(Database, db, { property: "database" });
		try {
			await next();
		} finally {
			await db.close();
		}
	};
}

export const dispatcher = createJobDispatcher({ middleware: [database()] });

declare module "@sdxc/jobs" {
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}

export default createJobHandler(jobs.cleanup, async (ctx) => {
	let removed = await ctx.database.deleteExpiredSessions();
	ctx.log.set({ sessions: { removed } });
});
```

A later middleware reads it with `ctx.require(Database)`.

## Pattern: Scheduled Jobs Watched By A Cron Monitor

Two schedules share their work through a plain function, each keeps its own handler, and each
declares the monitor that watches it in `meta`. `onEnd` pings only for a `done` run, so a
monitor alerting means the job really stopped completing.

```typescript
import type { JobHandlerContext } from "@sdxc/jobs";

import { createJobDispatcher, createJobHandler, job, jobs } from "@sdxc/jobs";
import { createUptimeReporter } from "@sdxc/jobs/uptime";
import { env } from "cloudflare:workers";

interface Monitored {
	monitorId: string;
}

export const JOBS = jobs({
	dailyDigest: job({ cron: "0 8 * * *", meta: { monitorId: "mon_daily" } satisfies Monitored }),
	weeklyDigest: job({ cron: "0 9 * * 1", meta: { monitorId: "mon_weekly" } satisfies Monitored }),
});

async function sendDigests(ctx: JobHandlerContext<undefined>, period: "day" | "week") {
	ctx.log.set({ digest: { period } });
	await mailDigests(period);
}

export const daily = createJobHandler(JOBS.dailyDigest, (ctx) => sendDigests(ctx, "day"));
export const weekly = createJobHandler(JOBS.weeklyDigest, (ctx) => sendDigests(ctx, "week"));

let uptime = createUptimeReporter({ token: () => env.UPTIME_TOKEN });

export const dispatcher = createJobDispatcher({
	async onEnd(ctx, status) {
		if (status.type !== "done") return;
		for (let watched of [JOBS.dailyDigest, JOBS.weeklyDigest]) {
			let run = ctx.of(watched);
			if (run !== null) await uptime(run.meta.monitorId);
		}
	},
});

dispatcher.map(JOBS.dailyDigest, daily);
dispatcher.map(JOBS.weeklyDigest, weekly);
```

An awaited ping finishes before the message is acked. Its `Result` is discarded here on purpose:
a failed ping never redelivers work that succeeded.

## Pattern: Retries, Timeouts And Cancellation

A timeout aborts `ctx.signal` but cannot stop a handler, so pass the signal to every `fetch` and
check it between steps. A broad `catch` rethrows any `Ending` so the handler's own decision
survives.

```typescript
import { createJobHandler, Job } from "@sdxc/jobs";

import jobs from "./jobs.js";

export default createJobHandler(jobs.syncInvoices, async (ctx) => {
	for (let invoice of await pendingInvoices()) {
		if (ctx.signal.aborted) return ctx.ack(); // what already synced stays synced

		try {
			let response = await fetch(invoice.url, { signal: ctx.signal });
			if (response.status === 429) {
				return ctx.retry({ delay: "1 minute", reason: "Rate limited" });
			}
			if (response.status === 404) return ctx.exit(`Invoice ${invoice.id} is gone`);
			await markSynced(invoice, await response.json());
		} catch (error) {
			if (error instanceof Job.Ending) throw error;
			return ctx.retry({ reason: "Sync failed", delay: "1 minute", cause: error });
		}
	}
});
```

Acking under an aborted signal settles the message but records a timeout, so `onEnd` sees
`timeout` rather than `done`.

## Pattern: A Job That Fans Out Work

A cron job whose handler enqueues keeps the fan-out on the queue, where each check gets its own
run, retries and record.

```typescript
import { createJobHandler } from "@sdxc/jobs";

import { dispatcher } from "./dispatcher.js";
import jobs from "./jobs.js";

export default createJobHandler(jobs.scheduleChecks, async (ctx) => {
	let due = await sitesDueForCheck(new Date());
	await dispatcher.enqueueMany(
		jobs.checkSite,
		due.map((site) => ({ siteId: site.id })),
	);
	ctx.log.set({ checks: { enqueued: due.length } });
});
```

Every message carries this run's trace, so each `checkSite` record names it as parent.

## Pattern: Testing A Handler

A handler is a function over a context. Build one with `createJobContext`, publish what the
middleware would, and assert on the ending it throws or the record it writes.

```typescript
import { createJobContext, Job } from "@sdxc/jobs";
import { Log } from "@sdxc/logger";
import { expect, test } from "vitest";

import handler from "./jobs/send-receipt.js";
import jobs from "./jobs.js";
import { Database } from "./middleware.js";

test("asks for a retry while the mailer rate limits", async () => {
	let ctx = createJobContext(jobs.sendReceipt, { id: "m1", attempts: 1, input: { orderId: "o1" } });
	ctx.set(Database, await testDatabase(), { property: "database" });

	await expect(handler(ctx)).rejects.toBeInstanceOf(Job.Retry);
});

test("records the order it sent", async () => {
	let records: Record<string, unknown>[] = [];
	let log = new Log({ kind: "job", sink: (record) => void records.push(record) });
	let ctx = createJobContext(jobs.sendReceipt, {
		id: "m1",
		attempts: 1,
		input: { orderId: "o1" },
		log,
	});
	ctx.set(Database, await testDatabase(), { property: "database" });

	await log.run(() => handler(ctx));

	expect(records[0]).toMatchObject({ "order.id": "o1" });
});
```

## Pattern: Running Jobs Without A Platform

The memory queue runs the whole loop in one process: `tick()` without `only` evaluates each
schedule against `now`, and `drain()` delivers and settles what is queued, counting attempts
against `maxAttempts`. Asserting `dispatcher.crons` against the Worker's configured triggers
catches a schedule that would never fire.

```typescript
import { createJobDispatcher } from "@sdxc/jobs";
import * as memory from "@sdxc/jobs/memory";
import { expect, test } from "vitest";

import jobs from "./jobs.js";

test("the midnight tick runs cleanup once", async () => {
	let queue = memory.queue();
	let dispatcher = createJobDispatcher({ queue, maxAttempts: 3 });
	dispatcher.map(jobs.cleanup, () => import("./jobs/cleanup.js"));

	await dispatcher.tick({ now: new Date("2026-01-01T00:00:00Z") });
	expect(queue.messages).toMatchObject([{ job: "cleanup" }]);

	let settlements = await queue.drain((delivery) => dispatcher.deliver(delivery));
	expect(settlements).toEqual([{ type: "ack" }]);
	expect(dispatcher.crons).toEqual(["0 0 * * *"]);
});
```

## Pattern: Running Enqueued Jobs From A Command

A command line's `jobEnqueuer()` takes the queue the run should write to. Locally that is a memory
queue drained through the app's own dispatcher, so a job a command enqueues runs in the terminal
the developer is watching, against the same database; against production it is the deployed
queue, and the deployed consumer does the work.

```typescript
import { command, commands, createCLI, success } from "@sdxc/cli";
import { createJobDispatcher } from "@sdxc/jobs";
import { jobEnqueuer } from "@sdxc/jobs/cli";
import * as memory from "@sdxc/jobs/memory";
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware/cli";
import { trace } from "@sdxc/trace-context/middleware/cli";

import jobs from "./jobs.js";

let logger = createLogger({ service: "app-cli" });
let queue = memory.queue();
let dispatcher = createJobDispatcher({ queue, logger, maxAttempts: 3 });
dispatcher.map(jobs.sendReceipt, () => import("./jobs/send-receipt.js"));

let contract = commands({
	receipts: commands({ resend: command({ description: "Resend receipts" }) }),
});

let cli = createCLI({
	name: "app",
	commands: contract,
	middleware: [log(logger), trace(), jobEnqueuer(queue, { dispatcher })],
});

cli.map(contract.receipts.resend, async (ctx) => {
	let orders = await findUnsentOrders();
	await ctx.jobs.enqueueMany(
		jobs.sendReceipt,
		orders.map((order) => ({ orderId: order.id })),
	);
	return success();
});

process.exitCode = await cli.run(process.argv.slice(2));
```

Each job writes its own `job` record under the command's log and continues its trace. Building
the dispatcher over the same memory queue means the jobs those jobs enqueue run as well.

## Pattern: Writing A Queue Adapter

An adapter implements `JobQueue` and passes the conformance suite, which is what makes it a
substitute for the shipped ones.

```typescript
import type { JobMessage, JobQueue } from "@sdxc/jobs/queue";

import { conformance } from "@sdxc/jobs/conformance";
import { JobQueueError } from "@sdxc/jobs/queue";
import { failure, success } from "@sdxc/result";

interface Topic {
	publish(bodies: unknown[]): Promise<void>;
	readonly published: unknown[];
}

export function topicQueue(topic: Topic): JobQueue {
	return {
		retries: "backend",
		async send(messages: JobMessage[]) {
			try {
				await topic.publish(
					messages.map(({ job, body }) => (body === undefined ? { job } : { job, body })),
				);
				return success(undefined);
			} catch (error) {
				return failure(
					new JobQueueError("The topic refused the write", { code: "unavailable", cause: error }),
				);
			}
		},
	};
}

let topic = createTestTopic();

conformance({
	name: "topicQueue",
	create() {
		topic = createTestTopic();
		return topicQueue(topic);
	},
	messages: () => topic.published,
});
```

A backend whose platform delivers by push calls `dispatcher.deliverBatch()` from its consumer and
applies each `Settlement`; one that is polled adds `claim` and `settle`, and `advance` lets the
suite check delays.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/jobs": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
