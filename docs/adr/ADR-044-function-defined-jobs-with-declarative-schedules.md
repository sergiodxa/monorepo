# ADR-044: Function-Defined Jobs With Declarative Schedules

## Status

**Accepted** - 2026-09-02

## Background

`@pkg/jobs` gives every queue consumer in the monorepo one lifecycle: a batched logger, an ack/retry decision derived from the thrown error, an optional uptime ping, and per-job database usage attribution. It does that through an abstract `Job` class whose subclasses implement `perform()`, and it does it well — the lifecycle is not what this ADR changes.

What the package does not model is everything around that lifecycle. A job does not know its own message type, does not know its schedule, cannot enqueue itself, and has no way to be handed its dependencies, so each app rebuilds those facts by hand: a discriminated-union schema of every message body, a `switch` mapping each `type` to a class, an `if` chain mapping each cron expression to a `send()`, a `validate()` call inside every `perform()`, and a `getServiceContainer()` lookup for every service the job touches. The rest of the repository moved to Remix v3's shape — a map of addressable definitions, a dispatcher that maps handlers onto them, and middleware that publishes request-scoped values into a typed context — while jobs stayed on the class-and-switch shape that predates it.

## Context

### Current State

| Location                                    | What it does                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `packages/jobs/src/index.ts`                | `Job`: `run()` lifecycle, `RetryError` / `NonRetriableError`, uptime ping, `setJobUsageTracker` |
| `apps/uptime/bootstrap/worker.ts`           | 20-member `QueueMessageSchema`, a 20-case dispatch `switch`, and a 12-branch cron `if` chain    |
| `apps/uptime/app/jobs/*.ts`                 | 20 job classes, each re-validating `this.input` and resolving services from the container       |
| `apps/uptime/app/lib/queue.ts`              | `sendQueueMessage` / `sendQueueBatch`, bodies typed `unknown`, cost recorded per write          |
| `apps/uptime/wrangler.jsonc`                | 12 cron triggers, each commented with the job it is for                                         |
| `apps/r3-auth/bootstrap/worker.ts`          | The same shape at one-job scale: `DAILY_CRON` constant, `switch`, hand-written lazy import      |
| `apps/r3-auth/app/http/validators/queue.ts` | A one-member `s.variant("type", …)` that exists only to name that job                           |

### What Adding One Job Costs Today

Adding one job to `apps/uptime` takes six edits across five files, in this order:

1. Write the job class, with a `static schema` and a `validate()` call at the top of `perform()`.
2. Add a member to `QueueMessageSchema` in the worker, restating the same message shape.
3. Add a `case` to the dispatch `switch`, importing the class at the top of the worker.
4. Add a branch to the cron `if` chain, matching a cron expression written as a string literal.
5. Add the trigger to `wrangler.jsonc`, spelling the same expression a second time.
6. Enqueue it from anywhere else by writing the body literal `{ type: "sendFunnelReport" }` by hand.

Nothing checks that steps 2 and 1 agree, that step 4's expression is one of step 5's, or that step 6's literal matches any registered type.

### Issues Identified

| Issue                                             | Impact                                                                                                                                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A job's message shape is declared twice           | The worker's variant member and the job's `static schema` drift silently; `verifyDomainOwnership` already carries a `teamDomainId` the worker's member does not mention                                                     |
| A job's schedule lives outside the job            | Reading `check-ssl.ts` does not say it runs at 06:00; three files have to be read together                                                                                                                                  |
| Enqueuing is untyped                              | `sendQueueMessage(body: unknown)` accepts any object, so a typo in `type` or a missing field is a dead-letter at runtime rather than a type error                                                                           |
| Every `perform()` opens with the same eight lines | `validate()`, `isFailure`, `throw new Job.NonRetriableError(...)`, repeated in 20 files                                                                                                                                     |
| The dispatch `switch` is a second registry        | A job class that exists but was never added to it silently never runs                                                                                                                                                       |
| Cron expressions are string literals in two files | An edit to `wrangler.jsonc` that does not match the worker's `if` produces a trigger that fires and enqueues nothing                                                                                                        |
| Enqueuing a job imports the job                   | A controller that enqueues names a class, so the handler and everything it pulls in join the request path's module graph; `apps/r3-auth` hand-writes an `await import()` inside its dispatch `switch` to avoid exactly this |
| A job reaches out for its dependencies            | `perform()` calls `getServiceContainer().get(Database)`, so testing one means standing up a container scope, and jobs stay wired into the container that new code is meant to stop using                                    |
| Shared behavior is expressed by subclassing       | `SendTeamDailyDigestsJob` and `SendTeamWeeklyDigestsJob` extend a third class purely to vary two constants                                                                                                                  |
| Class statics carry configuration                 | `static override monitorId` needs the `override` keyword and cannot be read back off a value                                                                                                                                |

## Decision

Model jobs the way the repository already models HTTP: a **map** of definitions, a **dispatcher** that maps handlers onto them with middleware, and **handlers** in their own modules that read what they need from a **context**.

### 1. `jobs()` Builds The Map, `job()` Declares A Leaf

```typescript
// app/jobs/index.ts
import { job, jobs } from "@pkg/jobs";
import * as s from "remix/data-schema";

export default jobs(
	{
		clean: job({
			cron: "0 0 * * *",
			monitorId: "80294988-476e-4e99-9f5c-abfeb369316a",
		}),
		checkHttp: job({
			input: s.object({ id: s.string(), monitorId: s.string(), scheduledAt: s.number() }),
		}),
	},
	{ send: sendQueueBatch },
);
```

The key is the job's name, and the name is the message `type` — the same way a route map's key names a route. `jobs()` stamps each leaf with its key, so a definition is a complete value: `jobs.checkHttp.enqueue({ … })` works anywhere the map is imported, with no router in sight.

| Option      | Meaning                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `input`     | Object schema parsed before the handler runs. Absent means the job takes no payload            |
| `cron`      | Cron expression this job is enqueued on. Absent means the job is only ever enqueued explicitly |
| `monitorId` | Uptime cron monitor pinged after a successful run, unchanged from `static monitorId`           |

Every job is enqueuable. A job is additionally schedulable when it declares `cron`, and the two are independent: `aggregateDailyStats` runs on `0 1 * * *` and is also enqueued on demand by the backfill endpoint.

Keys may nest, as route maps do, and a nested job's name is its dot-joined path (`digests.daily`). Because the name is the wire format, renaming a group renames every message type under it, so the migration keeps `apps/uptime`'s existing keys flat and verbatim.

The map holds no handler code and imports no job module, which is what makes it the thing a controller imports to enqueue.

### 2. `createJobHandler()` Holds The Work

```typescript
// app/jobs/clean.ts
import { createJobHandler } from "@pkg/jobs";

import jobs from "~/app/jobs";
import { Database } from "~/app/jobs/middleware/database";

export default createJobHandler(jobs.clean, async ({ database, logger }) => {
	let deleted = await database.delete(pings).where(lt(pings.created_at, cutoff)).returning();
	logger.info("clean.completed", { deleted: deleted.length });
});
```

The handler receives one context object: the job's own declaration, the message it is running for, and whatever the middleware published. Passing the definition is what supplies the input type, the same way `createAction()` types a stored Remix handler.

A handler settles its own delivery when it wants to, through `ctx.ack()` and `ctx.retry(options?)`. The `Message` itself stays out of reach: the context exposes the two verbs, so the dispatcher keeps owning the logging, the uptime ping, and the decision it makes when the handler settles nothing.

| Call                                | Effect                                                                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ctx.ack()`                         | Settles the delivery now and returns. The run continues, and completing still pings and logs `job.completed`                  |
| `ctx.retry()`                       | Settles the delivery for redelivery and returns. The handler is expected to return next; the run logs `job.retrying`, no ping |
| `ctx.retry({ delay: "5 minutes" })` | The same, held for that long — the backoff `RetryError` has no way to express                                                 |
| Returning without settling          | Unchanged: ping, then ack, then `job.completed`                                                                               |
| Throwing                            | Unchanged: `RetryError` retries, `NonRetriableError` acks, `JobTimeout` reports a timeout, anything else re-throws            |

The first settlement wins. A second call is ignored, and so is the dispatcher's own ack at the end of a run the handler already settled — which is what makes early-acking safe for a job that wants its delivery released before a slow tail finishes. A handler that settles and then throws still logs the throw; it does not re-settle.

`delay` is a `DurationInput` from `@pkg/duration`, so a backoff is written the way the cron package already takes a grace period: `ctx.retry({ delay: "5 minutes" })`. The package converts it with `toSeconds()`, which rounds to the nearest second, and hands that to the platform's `delaySeconds`. Taking a duration rather than a raw seconds number is what keeps a caller from passing milliseconds to a seconds-shaped API, which is the mistake that package exists to prevent — a bare number in a `DurationInput` is already milliseconds.

`RetryError` accepts `delay` alongside `cause`, so the thrown and the called spelling of a retry carry the same options and neither is the second-class one.

### 3. Middleware And Context

The context mixes the two the repository already has: the route context's typed key access and middleware-installed properties, and `@pkg/mcp`'s habit of flattening the descriptor being executed onto that same object, so a tool reads `ctx.input` and `ctx.tool` without going through a key.

| Property            | Comes from     | Meaning                                                                                                        |
| ------------------- | -------------- | -------------------------------------------------------------------------------------------------------------- |
| `input`             | The leaf       | The payload, parsed and typed by `s.InferOutput` of the leaf's schema; `undefined` when the leaf declares none |
| `name`              | The map key    | The job's name, dot-joined for a nested leaf                                                                   |
| `cron`              | The leaf       | The schedule it is enqueued on, `undefined` when it has none                                                   |
| `monitorId`         | The leaf       | The uptime monitor it reports to, `undefined` when it has none                                                 |
| `logger`            | The dispatcher | The job's `BatchedLogger`, already carrying its identifier                                                     |
| `id`, `attempts`    | The message    | Delivery id and delivery count                                                                                 |
| `batchSize`         | The batch      | How many messages share this invocation, for a job that prices its share of it                                 |
| `ack`, `retry`      | The dispatcher | Settle this delivery from inside the handler                                                                   |
| `signal`            | The dispatcher | Aborts when the job's timeout expires; pass it to `fetch`, or read `signal.aborted` between iterations         |
| `get`, `has`, `set` | The context    | Typed key access, the same surface `RequestContext` has                                                        |
| Anything else       | Middleware     | Installed by `set(key, value, { property })`, so a handler reads `ctx.database` with its real type             |

`cron` and `monitorId` are on the context because a handler mapped to more than one leaf is a real case: the daily and weekly team digests differ by exactly those two values, so reading them turns today's three-class hierarchy into one handler mapped twice.

Middleware is declared once on the dispatcher and runs around every job, in the shape `fetch-router` already uses: a factory returning `(context, next)`, which must call `next()`.

```typescript
// app/jobs/middleware/database.ts
import type { JobMiddleware } from "@pkg/jobs";

import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { env } from "cloudflare:workers";
import { createContextKey } from "remix/router";
import { Database as DataTable } from "remix/data-table";

export const Database = createContextKey<DataTable>();

export function database(): JobMiddleware<{
	key: typeof Database;
	value: DataTable;
	property: "database";
}> {
	return async (ctx, next) => {
		ctx.set(Database, new DataTable(createD1DatabaseAdapter(env.DB)), { property: "database" });
		await next();
	};
}
```

Context keys come from `remix/router`: `createContextKey()` returns a plain typed key, tied to nothing in the dispatcher, and `@pkg/mcp` already reuses it outside a fetch router. The context object is the package's own, because `RequestContext` takes a `Request` in its constructor and carries `headers`, `url`, `params`, and `router` — a job has none of those, and inventing a synthetic request to borrow the class would be a lie in every log line. `JobContext` implements the same `get` / `has` / `set(key, value, { property })` surface, so an app defines a key once and publishes it from both an HTTP middleware and a job middleware, and a service written against `ctx.database` does not care which one is running.

Middleware is dispatcher-level only. Per-job middleware is deliberately absent: a job that needs setup nothing else needs can do it in its own first lines, and one chain for every job is what keeps the ordering guarantees legible.

Ordering inside a delivery is: read `type`, find the definition, parse the body, build the context, run the middleware chain, load the handler module, run the handler. Middleware therefore never runs for a message that was never going to be handled, and a throw from middleware is classified exactly as a throw from a handler — `RetryError` retries, `NonRetriableError` acks.

This is what makes a handler testable without a worker:

```typescript
import handler from "~/app/jobs/clean";

test("deletes pings past the retention window", async () => {
	let ctx = new JobContext(jobs.clean, { id: "message-1", attempts: 1 });
	ctx.set(Database, await testDatabase(), { property: "database" });

	await handler(ctx);

	expect(ctx.settlement).toBeUndefined();
});
```

A context built without a message records what the handler asked for on `ctx.settlement` rather than calling into the platform, so a test asserts a retry the same way it asserts a row.

### 4. Enqueuing Goes Through The Map

The second argument to `jobs()` is how the map reaches its queue:

| Option | Type                                     | Purpose                                                                        |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------ |
| `send` | `(bodies: JSONValue[]) => Promise<void>` | The app's queue write. `apps/uptime` passes its cost-counting `sendQueueBatch` |

Enqueuing is the one thing that cannot come from the dispatcher: `jobs.checkHttp.enqueue()` is called from controllers that have no business importing a dispatcher, which is exactly the module-graph problem the map exists to solve. The sender therefore arrives where the map is built — the one module every call site already imports — so there is no registration call to make, no order to get wrong, and no entry point that can forget to make it. A map that exists can enqueue.

The package takes a `send` function rather than a `Queue` binding because the binding is not the whole write anywhere it is used: `apps/uptime` prices each queue operation on the way out, and chunking a batch at the platform's 100-message limit already lives in the app. Passing a function also keeps the map's own module free of work at import time: nothing reads a binding until something enqueues.

```typescript
// app/http/controllers/actions/team-domains.ts
waitUntil(jobs.verifyDomainOwnership.enqueue({ teamDomainId: domain.id }));

// app/jobs/enqueue-pending-domains.ts
await jobs.verifyDomainOwnership.enqueueMany(domains.map((d) => ({ teamDomainId: d.id })));
```

`enqueue` takes exactly the job's input type, and takes no argument at all for a job without a schema. Both forms funnel into one `send` call, so a batch stays one write, and neither loads a handler.

### 5. `createJobDispatcher()` Maps Handlers And Owns Both Worker Handlers

```typescript
// app/jobs/dispatcher.ts
import { createJobDispatcher } from "@pkg/jobs";

import jobs from "~/app/jobs";
import { costLedger } from "~/app/jobs/middleware/cost-ledger";
import { database } from "~/app/jobs/middleware/database";

export const dispatcher = createJobDispatcher({
	middleware: [database(), costLedger()],
	onInvalid: deadLetter,
});

dispatcher.map(jobs.clean, () => import("~/app/jobs/clean"));
dispatcher.map(jobs.checkHttp, () => import("~/app/jobs/check-http"));
```

```typescript
// bootstrap/worker.ts
export default {
	async scheduled(controller) {
		await dispatcher.scheduled(controller);
	},

	async queue(batch) {
		await dispatcher.queue(batch);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
```

| Member                   | Behavior                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `map(definition, load)`  | Registers where a job's handler comes from: a loader returning its module, or the handler itself. Throws on a duplicate name    |
| `queue(batch)`           | Runs every message concurrently and settles when all of them have                                                               |
| `scheduled(controller)`  | Enqueues every mapped job whose `cron` equals `controller.cron`, in one batched send. Never runs one                            |
| `crons`                  | The distinct cron expressions the mapped jobs declare, for asserting against `wrangler.jsonc`                                   |
| `middleware` option      | The chain every job runs inside                                                                                                 |
| `timeout` option         | How long the dispatcher waits for one job before it aborts `ctx.signal` and stops waiting                                       |
| `uptime` option          | Deferred resolver for the monitor-ping token, matching the credential rule ADR-043 settled                                      |
| `onInvalid` option       | Called with a body naming no mapped job, or failing that job's schema, wrapped ready to send on. Defaults to logging and acking |
| `deadLetterQueue` option | Name of the dead-letter queue, so the dispatcher recognizes its batches and records them itself                                 |

A cron delivery enqueues; it never handles. `scheduled()` writes one message per due job and returns, so the handler runs later, off the queue, exactly as it does for a job that was enqueued by a controller. Both apps already work this way by hand — `apps/r3-auth`'s worker says it outright, that a sweep outgrowing the trigger's budget should become the queue's problem and get its own retries — and this makes it the dispatcher's rule rather than a convention each worker re-decides. It is also why `cron` is purely additive on a leaf: the scheduled path _is_ the enqueue path, so a scheduled job needs no second code path, gets the same middleware, timeout, logging, and uptime ping, and gets the retries and dead-letter queue a cron trigger cannot offer. The practical shape of it is that a `scheduled` invocation loads no job module at all.

A malformed message never parses a handler module, and an isolate that only serves `fetch` never parses one at all. The loader is the convention rather than a passed handler because a loader is what keeps the handler out of the importing module's graph.

`apps/uptime` passes `onInvalid` to keep its current behavior of forwarding the body to the dead-letter queue as `{ invalid: body }`; `deadLetter` in the sample above is that app's own function, not package API.

The dead-letter queue is the dispatcher's, not the app's. Naming it in `deadLetterQueue` is the whole of an app's involvement on that side: a batch arriving from it is recorded and acked by the package, with no leaf, no handler module, and no way for a message there to be retried — that queue has no dead-letter queue of its own, so anything left unacked would redeliver forever.

Both ends of the convention move with it. A message reaches that queue either because the platform exhausted its `max_retries` and moved it verbatim, or because the dispatcher refused it: a body naming no job, or failing its schema, will not parse on a redelivery either, so `onInvalid` receives it already wrapped as `{ invalid: body }` and the app's only part is writing that to its `DLQ` binding. The recorder on the other side reads the same wrapper to tell "never matched anything" from "tried three times and died", which is why the package owns both halves rather than leaving the shape to each app. That envelope is a wire format like any other: bodies sit in that queue across deploys.

`map()` is the only thing that makes a job runnable, so a job in the map that nobody maps is dead code that still accepts enqueues. One test walks the map and asserts every leaf is mapped — the completeness check the hand-written `switch` never had either.

### 6. Timeouts Bound The Wait, Not The Handler

```typescript
export const dispatcher = createJobDispatcher({ timeout: "5 minutes", middleware: [database()] });
```

A handler cannot be terminated — JavaScript has no way to stop a promise mid-flight — so this is not a kill switch, and the ADR would be lying if it read like one. What the timeout does is bound how long the dispatcher waits, cancel the I/O the handler agreed to have cancelled, and put a name on the failure.

That is worth having because `queue()` awaits every message: one hung job holds the invocation open long after every other message in the batch has settled, and it dies at the platform's own limit with no attribution. Neither app sets `limits.cpu_ms`, `max_batch_timeout`, or `max_concurrency`, so that platform limit is the only backstop today.

At the deadline the dispatcher aborts `ctx.signal` and gives the handler a short, package-fixed grace to give up on its own before settling on its behalf. A handler that notices gives up by throwing, in the same vocabulary as every other outcome:

```typescript
export default createJobHandler(jobs.checkFlows, async ({ signal, database }) => {
	for (let flow of await flowsDue(database)) {
		if (signal.aborted) throw new JobTimeout();
		await runFlow(flow, { signal });
	}
});
```

Throwing rather than settling is what keeps the cooperative path clear of the one hazard `ctx.retry()` carries: it unwinds, so there is no handler that gives up and keeps working anyway. `new JobTimeout()` is spelled like the two error classes beside it, and named to stay clear of the `TimeoutError` DOMException that `AbortSignal.timeout()` raises.

`ctx.ack()` stays the escape hatch for what a throw cannot express. A sweep partway through sending mail has done durable, non-idempotent work, and wants the delivery gone rather than redelivered:

```typescript
if (signal.aborted) return ack(); // The mail already sent must not be sent twice.
```

The dispatcher's own default is the other one: leave the message unacked so the platform redelivers, which is right for a job that hung before doing anything durable. Only the handler can tell those apart, which is what the grace is for, and it is sized to unwind rather than to keep working. Acking that way settles the message and nothing more: the run still reports a timeout and still pings no monitor, because a handler that gave up early has not done the work the monitor watches for.

All three paths report the same thing. A thrown `JobTimeout`, an `AbortError` surfacing from a `fetch` that was given `ctx.signal`, and the dispatcher giving up all log `job.timed-out` and skip the uptime ping. With no `timeout` configured, `ctx.signal` is a signal that never aborts, so handlers pass it along unconditionally.

### 7. The Wire Format Does Not Change

A message body stays flat: the job's name under `type`, the input's fields alongside it.

```json
{ "type": "checkHttp", "id": "…", "monitorId": "…", "scheduledAt": 1756800000000 }
```

Messages enqueued by the deploy before the migration are still in flight when the one after it starts consuming, and `apps/uptime` enqueues on the order of one message per monitor per minute. A nested envelope (`{ type, input }`) would read better and would dead-letter every message in the queue at cutover. `input` is therefore restricted to object schemas, and `type` is reserved.

### 8. Cron Expressions Are Compared, Not Parsed

`scheduled()` compares a definition's `cron` to `controller.cron` as strings. It does not parse the expression, and the package does not depend on `@pkg/cron`: the map is evaluated at module scope, where a Worker's upload validation runs under a startup CPU budget, and work put there fails the upload rather than the test suite.

Validity is checked where it costs nothing at runtime. Each app gets one test asserting that `dispatcher.crons` and the `triggers.crons` in its `wrangler.jsonc` are the same set, and that each expression parses with `Schedule.parse` from `@pkg/cron`. That test is what makes the two files a single source of truth, and it catches a trigger that fires into nothing as well as a job that declares a schedule nothing triggers.

### 9. The Lifecycle Carries Over Unchanged

Log event names (`job.started`, `job.completed`, `job.retrying`, `job.non-retriable`, `job.failed`, `job.uptime-failed`), the `job:<name>:<message id>` logger identifier, the ack/retry decision for a handler that settles nothing itself, and the uptime ping with its swallowed failures all keep their current behavior. `RetryError` and `NonRetriableError` become top-level named exports instead of statics on `Job`; they are the same classes, so `instanceof` keeps working across the migration.

The logger identifier is now the map key rather than a kebab-cased class name, which changes `job:check-http-job:…` to `job:check-http:…`. Dashboards filtering on those identifiers are updated with the app that produces them.

The usage tracker is the one lifecycle feature middleware makes redundant. `setJobUsageTracker` exists only because an app had no way to wrap a job's execution, which is precisely what a middleware is, so `apps/uptime`'s `trackJobCost` becomes a `costLedger()` middleware and the package drops `Job.Usage`, `Job.UsageTracker`, and its module-level tracker slot. The totals keep reaching the same batched log entry, written by the middleware through `ctx.logger` after `next()` resolves.

### API Surface

| Export                  | Kind     | Note                                                                                              |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `jobs()`                | Function | Builds a job map, naming each leaf after its key                                                  |
| `job()`                 | Function | Declares one leaf: `input`, `cron`, `monitorId`                                                   |
| `createJobHandler()`    | Function | Types a handler against a definition, returns a `JobHandler`                                      |
| `createJobDispatcher()` | Function | Returns `map` / `queue` / `scheduled` / `crons`                                                   |
| `JobContext`            | Class    | The context handlers and middleware share; built from a leaf and a message, or by a test directly |
| `JobMiddleware`         | Type     | `(context, next) => Promise<void>`, entry-typed like `Middleware`                                 |
| `JobTimeout`            | Class    | Give up because the timeout fired; also what the dispatcher reports when it gives up              |
| `RetryError`            | Class    | Retry this message, optionally after a `delay`                                                    |
| `NonRetriableError`     | Class    | Ack this message, it will not get better                                                          |

## Consequences

### Positive

- **Handlers are testable as functions** - A test builds a `JobContext`, sets the keys the handler reads, and calls it. No container scope, no queue message, no worker.
- **Jobs stop reaching for their dependencies** - The database arrives through middleware instead of `getServiceContainer()`, which takes 20 job files off the container new code is meant to stop using.
- **The request path stops importing job code** - A controller that enqueues imports a map of schemas, instead of a class whose module pulls in the database, the mailer, and the Polar client. The hand-written `await import()` in `apps/r3-auth`'s dispatch `switch` becomes the default for every job in every app.
- **A malformed message loads nothing** - The body is parsed against the definition before the loader is awaited, so a dead-letter costs a schema check.
- **Every job is visible in one map** - What jobs exist, what each carries, and what runs at 06:00 are one file, the way routes are.
- **Enqueuing is typed** - `jobs.checkHttp.enqueue({ … })` is checked against the same schema the consumer parses with, so a wrong field is a type error rather than a dead letter.
- **Cron drift is testable** - `dispatcher.crons` gives the assertion that `wrangler.jsonc` and the code agree.
- **Backoff becomes expressible** - `ctx.retry({ delay: "5 minutes" })` gives a rate-limited job the delay it wants, where today every retry is immediate and a job that knows better has no way to say so.
- **A hung job is named and bounded** - The batch closes on time and the log says which job hung, where today the invocation dies at the platform's limit and the batch is what gets reported.
- **Both worker handlers are one line** - Every branch a worker used to carry — cron matching, type dispatch, batch bookkeeping, the dead-letter queue — is either a declaration or a mapping, so the entry point says only that jobs are routed.
- **The dead-letter queue costs an app one option** - Naming it is all an app does; the package recognizes those batches, tells an exhausted message from a refused one, records it, and acks. `apps/uptime` deletes a job file, and `apps/r3-auth`, which has no such queue, sets nothing.
- **A schedule is a queue message** - Every job runs through one path whatever triggered it, so a scheduled job gets the retries, the dead-letter queue, the middleware, and the timeout that a cron trigger has none of.
- **Nothing is configured globally** - The sender is an argument to the map and the ping token an option on the dispatcher, so a job cannot be enqueued by a process that forgot to set something up.
- **Cross-cutting work is written once** - The cost ledger, the container scope, and anything else that wrapped every `perform()` becomes one middleware in one list.
- **Shared jobs become functions** - The two team digests come from one factory returning two leaves, instead of a three-class hierarchy.

### Negative

- **The map's keys are a wire contract** - Renaming a key renames a message type, and renaming a nested group renames every type beneath it. Nothing in the type system says so; only this ADR and a comment in the map will.
- **The package reimplements a slice of Remix's context types** - Entry-typed middleware that installs `ctx.db` needs the conditional types behind `property`, and those are internal to `fetch-router`. They have to be written here and kept in step. If they prove unstable, the fallback is keys only, and handlers read `ctx.get(Database)` with an `undefined` to narrow.
- **Dead-letter records are the package's shape** - An app names the queue and gets the package's log events for it. `onInvalid` still decides what is forwarded and where, but what a dead-letter record looks like is no longer an app's to change.
- **A timeout can duplicate work** - The handler keeps running after the dispatcher stops waiting, so a job that hangs partway can finish its writes and then have its redelivery do them again. Queues are at-least-once and jobs already tolerate redelivery, but the timeout turns "hung" into "possibly done twice", and only a cooperative `ctx.ack()` avoids it.
- **Two ways to settle a delivery** - Throwing and calling both exist, and `ctx.retry()` returns rather than unwinding, so a handler that calls it and keeps working is a mistake the compiler cannot catch. Throwing is the path to reach for, and first-settlement-wins bounds the other to wasted work rather than a double settle.
- **A job in the map with no mapping is silently dead** - It still accepts enqueues, and nothing in the type system objects. One test catches it; the compiler does not.
- **A large mechanical migration** - 21 job classes become handlers, two apps gain a map, a dispatcher, and middleware, two workers change, and every enqueue call site moves to the map. `apps/uptime` is the bulk of it and carries the traffic.
- **Log identifiers change** - `job:check-http-job:…` becomes `job:check-http:…`, which breaks saved queries at the cutover.
- **Two packages during the migration** - `@pkg/jobs` and `@pkg/jobs-next` both exist until the last app moves, and the rename in Phase 4 touches every import that landed in Phases 2 and 3.

### Neutral

- **Handler modules load per dispatch** - The runtime caches a module after the first message that needs it, so the cost is one parse per isolate rather than one per message.
- **Queue handler timing** - `dispatcher.queue(batch)` is awaited and runs its messages concurrently, where the workers currently hand each `Job.run` to `waitUntil` and return. Both keep the invocation alive until every message settles; the awaited form is what lets the dispatcher report a batch-level failure.
- **The container does not disappear** - Services a job still resolves from it keep working; the middleware chain is simply where an app can stop doing so, one service at a time.
- **The wire format is unchanged** - Nothing in the queue, the dead-letter queue, or the DLQ consumer needs a migration.

## Implementation Plan

The work happens in a new package, `@pkg/jobs-next`, rather than beside the class in `@pkg/jobs`. Two shapes this different sharing a module means every export has to say which world it belongs to, and the old package has two apps depending on it the whole time. The name is temporary by construction: Phase 4 deletes `@pkg/jobs` and renames this one into its place, so nothing ends up living under a version-flavoured name.

### Phase 1: The New Package

**Priority:** High
**Estimated Effort:** 2 days

1. Scaffold `packages/jobs-next` and add `jobs()`, `job()`, `createJobHandler()`, `createJobDispatcher()`, `JobContext`, and `JobMiddleware`, taking `@pkg/duration` as a dependency for the retry delay.
2. Build the context on `createContextKey` from `remix/router`, with `get` / `has` / `set(key, value, { property })` and the entry typing that makes an installed property visible to handlers.
3. Port the lifecycle — logger identifier, ack/retry classification, uptime ping — from `@pkg/jobs`, keeping its log event names.
4. Export `RetryError`, `NonRetriableError`, and `JobTimeout` at the top level.
5. Tests: naming from map keys including nested paths, dispatch by `type`, a loader resolved once and reused, a handler module left unloaded for a body that fails its schema, middleware ordering and its `RetryError` classification, settlement precedence across `ctx.ack()` / `ctx.retry()` / a later throw / the dispatcher's own ack, a `delay` converted to whole seconds and reaching the platform from both spellings, a context property installed by middleware and read by a handler, a timeout aborting `ctx.signal`, a thrown `JobTimeout` and a cooperative `ctx.ack()` both winning inside the grace, the dispatcher settling after it, an `AbortError` from the shared signal reported as a timeout, and `job.timed-out` logged with no ping, a dead-letter batch recorded and acked with both body shapes told apart, `ctx.batchSize` reporting the batch, `scheduled()` matching one cron across several jobs and enqueuing them rather than running them, `enqueue` / `enqueueMany` batching into one `send`, duplicate-name rejection, and the unchanged ack/retry/ping behavior.
6. Write the README around the new API. `@pkg/jobs` is not touched in this phase and keeps serving both apps.

### Phase 2: `apps/r3-auth`

**Priority:** High
**Estimated Effort:** 3 hours

1. Add `app/jobs/index.ts` with a one-leaf map declaring `cleanExpiredSessions`, its cron, and its monitor id, built with a `send` that writes to the queue binding.
2. Reduce `clean-expired-sessions.ts` to a handler reading its database from context, and add the `database()` middleware.
3. Add `app/jobs/dispatcher.ts` with the one `map()` call and the `uptime` resolver, keeping today's dynamic import as its loader.
4. Delete `app/http/validators/queue.ts` and the `DAILY_CRON` constant, and reduce both worker handlers to the dispatcher calls.
5. Add the `dispatcher.crons` assertion against `wrangler.jsonc` and the mapped-leaf test.

### Phase 3: `apps/uptime`

**Priority:** Medium
**Estimated Effort:** 3 days

1. Declare the 20 jobs in `app/jobs/index.ts`, folding each `static schema` into `input` and each `static monitorId` into its leaf, keeping every key spelled exactly as the message type it replaces, and build it with `send: sendQueueBatch`.
2. Reduce each job file to a handler, folding the `validate()` preamble into the signature and the container lookups into context reads.
3. Write the `database()` and `costLedger()` middleware, retiring `setJobUsageTracker(trackJobCost)`.
4. Add `app/jobs/dispatcher.ts` with the 20 `map()` calls, the `uptime` resolver, `deadLetterQueue: "ping-dlq"`, and an `onInvalid` that writes to the `DLQ` binding, then reduce both worker handlers to their dispatcher call. Delete `app/jobs/dead-letter.ts`.
5. Turn the every-minute claim into an ordinary cron job: a leaf on `* * * * *` whose handler claims the due monitors, apportions their teams, and calls `checkHttp.enqueueMany(…)` — the shape `enqueuePendingDomains` already has. Delete `setQueueBatchSize` in favour of `ctx.batchSize`.
6. Convert every `sendQueueMessage` / `sendQueueBatch` call site to `enqueue` / `enqueueMany` against the map.
7. Delete `QueueMessageSchema`, add both tests, and update the log filters that name job identifiers.

### Phase 4: Delete The Old Package And Take Its Name

**Priority:** Low
**Estimated Effort:** 1 hour

1. Delete `packages/jobs` once nothing depends on it — the class, its statics, `setJobUsageTracker`, and the usage types go with it.
2. Rename `packages/jobs-next` to `packages/jobs` and `@pkg/jobs-next` to `@pkg/jobs`, updating both apps' dependencies and imports.
3. The temporary name exists only between Phase 1 and here, so no app ever ships a release naming it long-term.

## Alternatives Considered

### 1. Keep The Class, Add Statics

Add `static cron` and `static enqueue()` to `Job`, and have the worker iterate a registry of classes.

**Rejected because**: it fixes the schedule and the registry but not the two-schema problem — a class cannot infer `perform()`'s input from `static schema`, so every job keeps validating by hand and `enqueue` stays untyped. The shape also stays class-first while the rest of the repository is not.

### 2. The Handler Inside The Definition

`job("clean", { cron, monitorId, handler })`, one value and one file per job.

**Rejected because**: a definition that holds its handler cannot be imported without it, so enqueuing from a controller drags the handler's whole dependency tree onto the request path, the worker parses every job's module at startup, and the lazy import `apps/r3-auth` hand-writes today would have to be deleted. The single file is the nicer read; the module graph is what the split is for.

### 3. A Positional Name Instead Of A Map Key

`job("clean", { cron, monitorId })`, with each definition exported on its own and the dispatcher mapping them.

**Rejected because**: the name is then written next to a key that already says it, in the module that already collects them. A map keyed by name is how the repository declares routes, and `jobs()` stamping each leaf gives back the one thing a bare key cannot: a definition that knows its own name, so `enqueue` lives on it.

### 4. Enqueue Through The Dispatcher

Give the dispatcher the sender instead of the map, so call sites write `dispatcher.enqueue(jobs.checkHttp, { … })`.

**Rejected because**: it makes every controller that enqueues import the dispatcher, and with it every loader and every middleware — where the map is the smallest thing that can be imported. Enqueuing also reads better as a property of the job.

### 5. Per-Job Middleware

Allow a middleware list on each leaf, as controllers and routes may have their own.

**Rejected because**: no job in either app needs one, and a chain that varies per job makes the ordering something you work out per message instead of read once. A job needing its own setup writes it in its first lines.

### 6. Expose The `Message` Itself

Put Cloudflare's `Message` on the context and let handlers call `message.ack()` and `message.retry()` directly.

**Rejected because**: the dispatcher has to know how a delivery was settled to decide whether to ping, what to log, and whether to settle it itself. Two verbs it owns give it that; a handle to the platform object does not, and it would put `message.body` next to the parsed `input` as a second, unvalidated source of the same data.

### 7. More Fields On The Leaf

`maxAttempts`, `timeout`, `description`, and a cron `timeZone` were each considered for the declaration.

**Rejected because**: `max_retries` is a consumer-level policy that `wrangler.jsonc` states as one policy per queue, and no job reads `message.attempts`; the only timeout in either app is a monitor's configured `timeoutSeconds`, which is customer data that varies per row rather than a property of the job, and the runaway guard belongs on the dispatcher; a doc comment above the leaf already describes it; and a time zone would change nothing, since Cloudflare's triggers are UTC and `scheduled()` dispatches by matching the expression in `wrangler.jsonc`. A `queue` field is deferred rather than rejected: both apps have one work queue, and a second would grow the sender port to `send(bodies, { queue })`.

### 8. A Nested Message Envelope

Send `{ type, input: { … } }` so the payload cannot collide with the envelope.

**Rejected because**: it dead-letters every message in flight at the cutover, in the app that enqueues thousands of them an hour, in exchange for reserving one key.

### 9. Generate The Cron Triggers

Have the build write `triggers.crons` in `wrangler.jsonc` from the map.

**Rejected because**: `wrangler.jsonc` is the deployment contract and is read by people and by Wrangler without running the app's code. Its triggers also carry the reasoning for each hour, which a generator would delete. An assertion gets the same guarantee and leaves the file authored.

## References

- [ADR-008: Service Container For Remix v3](./ADR-008-service-container-for-remix-v3.md)
- [ADR-021: Cron Schedule Package](./ADR-021-cron-schedule-package.md)
- [ADR-033: Wide Events As The Logging Contract](./ADR-033-wide-events-as-the-logging-contract.md)
- [ADR-043: Billing Package With Pluggable Providers](./ADR-043-billing-package-with-pluggable-providers.md)
- [fetch-router](../vendor/@remix-run/fetch-router/README.md)
- [Cloudflare Queues](https://developers.cloudflare.com/queues/)

## Current Progress

- [ ] Phase 1: The Package
- [ ] Phase 2: `apps/r3-auth`
- [ ] Phase 3: `apps/uptime`
- [ ] Phase 4: Remove The Class

## Notes

- File convention: `app/jobs/index.ts` is the map and the only thing an enqueue call site imports; `app/jobs/dispatcher.ts` holds the dispatcher, the middleware, and the loaders, and is imported by the worker alone; `app/jobs/<name>.ts` exports one handler as its default. Handlers keep the filenames they have today. The static import edge runs handler to map, and the dispatcher reaches handlers only through thunks, so there is no import cycle.
- `@pkg/mcp` already treats `createContextKey` as a primitive it can use away from a fetch router, and types its handler contexts as a request context plus the descriptor being executed (`ctx.input`, `ctx.tool`). `JobContext` is that idea for a unit of work with no request behind it: the leaf's own `name`, `cron`, and `monitorId` sit alongside `input` for the same reason `ctx.tool` does.
- The uptime worker's every-minute trigger does work no declaration covers: it claims the monitors that are due, apportions the invocation's cost across their teams, and enqueues one message per monitor. That becomes a job of its own on the same cron, so the worker keeps no branch — the cost of which is that the claim runs a queue hop after the trigger instead of inside it, and attributes its cost to its own ledger rather than the trigger's.
- `DeadLetterJob` never extended `Job`, and it does not become a leaf or a handler: it moves into the package as what `deadLetterQueue` turns on. Its two log events and the `{ invalid: body }` wrapper they distinguish move with it, and `apps/uptime` deletes the file. As with every other job, its logger identifier loses the class-name suffix: `job:dead-letter-job:…` becomes `job:dead-letter:…`.
- A job that declares `cron` and is enqueued explicitly runs the same code either way, so `aggregateDailyStats` needs no branch to tell a scheduled run from a backfill.
- `jobs()` and `job()` run at module scope. They store their arguments and stamp names, and do nothing else: no parsing, no binding reads, no registry writes.
