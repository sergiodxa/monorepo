# ADR-054: Jobs Package With Queue Adapters

## Status

**Implemented** - 2026-09-07

Revises [ADR-044](./ADR-044-function-defined-jobs-with-declarative-schedules.md) in four places:
the flat wire format it chose, the `monitorId` field on the leaf, the `uptime` option that made
reporting the lifecycle's business, and the `send` function that stood in for a queue. The lifecycle
ADR-044 carried over unchanged is carried over again — what changes is where it ends and who applies
the ending.

## Background

`@sdxc/jobs` models a job as a declaration, a handler, and a dispatcher that pairs them. Nothing in
`src/` imports a Cloudflare binding and `@cloudflare/workers-types` is already a dev dependency, so
the package reads as though it were platform-neutral. It is not: the lifecycle ends a delivery by
calling `message.ack()` and `message.retry()` on a platform object, the dispatcher is entered through
a `MessageBatch`, and cron exists only because the platform fires `scheduled` with an expression to
match against.

That was the right shape for one deployment target. The package is now going to npm, and the four
apps consuming it are no longer the only consumers it has to satisfy. A published port is a
compatibility surface: the backends will be written by people who run them, against a contract that
cannot be renegotiated afterwards. Its shape has to be settled before the first release rather than
after the first adapter.

The target that motivates this is unchanged in practice — Cloudflare Queues in production,
in-memory in tests. Nothing here is a plan to run Postgres or Redis.

## Context

### What the package is today

| Location            | What it holds                                                                           |
| ------------------- | --------------------------------------------------------------------------------------- |
| `src/job.ts`        | `job()`: `input`, `cron`, `monitorId`; `Schedule.parse` at declaration                  |
| `src/jobs.ts`       | `jobs()`: names each leaf from its key; `messageBody()` builds the flat body            |
| `src/handler.ts`    | `createJobHandler()`, the `JobTypes` augmentation seam                                  |
| `src/context.ts`    | `JobContext`: the delivery's fields, the four ending verbs, the typed key store         |
| `src/middleware.ts` | `JobMiddleware`, the chain's context effects                                            |
| `src/lifecycle.ts`  | `runJob()`: the chain inside a timeout, the ending, the ping, `message.ack()`/`retry()` |
| `src/dispatcher.ts` | `createJobDispatcher()`: `map`, `enqueue`, `scheduled`, `queue`, refusal, dead letter   |
| `src/uptime.ts`     | A hardcoded `https://uptime.sergiodxa.com` ping and its two error classes               |

### Where the platform is bound

Four bindings, none of them a dependency:

1. **The ending is applied, not returned.** `settle()` calls `message.ack()` and
   `message.retry({ delaySeconds })`. Every other backend wants the outcome handed back so it can
   persist it — an `UPDATE`, an `XACK`, a `DeleteMessage`.
2. **The entry point is a batch.** `queue(batch)` assumes push delivery, and reads `batch.queue` to
   recognise the dead-letter queue by name.
3. **Cron is entirely outsourced.** `job({ cron })` records a string; `scheduled(controller)`
   compares it. Nothing fires that outside a platform with triggers.
4. **Retry exhaustion and the dead-letter queue belong to the platform.** `attempts`, the retry
   ceiling, and the move to the dead-letter queue are all decided outside the package.

### What publishing requires

Of this package's dependencies, `@sdxc/types`, `@sdxc/result` and `@sdxc/duration` are already in
[ADR-007](./ADR-007-publishable-package-releases.md)'s release set. `@sdxc/cron`, `@sdxc/validate`
and `@sdxc/logger` are not, so the set grows by three. `cron` and `validate` are clean additions —
their own dependencies are all in the set already.

`@sdxc/logger` carries a wrinkle. It depends on `remix@3.0.0-rc.1`, and under ADR-007's exact-pin
rule every consumer of `@sdxc/jobs` would inherit a hard pin to a Remix release candidate. Its `.`
export is remix-free; only `./middleware` imports `createContextKey` at runtime.

This package's own `remix/router` import is the `ContextValue` type alone, which is not enough to
keep it a dev dependency: a type-only import still lands in the emitted `.d.ts`, so a consumer needs
`remix` to typecheck against `JobContext`. The same holds for `@cloudflare/workers-types` in the
Cloudflare adapter's signatures, and for `vitest` in the conformance suite's emitted JavaScript. All
three are declared as optional peer dependencies rather than dependencies, so nobody installs a
runtime they are not using and nobody inherits a pin to a release candidate.

### Issues identified

1. A backend cannot be substituted, so the package's own suite runs against `@sdxc/cloudflare-mocks`
   and every app that dispatches a job needs a queue binding to be tested.
2. `uptime.ts` hardcodes one service's host, and the lifecycle sniffs two error classes to decide
   whether a reporting failure should sink work that already succeeded.
3. `monitorId` is a leaf field naming a concern the package should not have, and fifteen jobs across
   two apps declare one, so the ping is load-bearing rather than vestigial.
4. `onInvalid` is the only hook, so the moment a delivery ends is unreachable from an app.
5. `ctx.input` is `unknown` at the dispatcher level, and there is no way to narrow it.
6. The flat wire format hides the job's name inside the payload, so any backend that wants to index,
   count, or route by job has to parse a body to learn what it is.

## Decision

Eleven decisions. The first is the one the rest follow from.

### 1. The core returns a settlement, it does not apply one

`settle()` stops calling methods on a platform object and returns what it decided. The delivery
becomes plain data.

```ts
export interface JobDelivery {
	id: string;
	attempts: number;
	body: unknown;
	enqueuedAt?: Date;
}

export type Settlement =
	| { type: "ack" }
	| { type: "retry"; delay: DurationInput | undefined }
	| { type: "dead-letter"; reason: DeadLetterReason };
```

The whole neutral surface is then two methods, one delivery and one batch of them:

```ts
deliver(delivery: JobDelivery, batchSize?: number): Promise<Settlement>;

deliverBatch(
	deliveries: JobDelivery[],
	options: {
		queue?: string;
		apply: (delivery: JobDelivery, settlement: Settlement) => void;
	},
): Promise<void>;
```

`deliverBatch` takes an `apply` callback rather than answering with an array, because a batch
settles each delivery as that one finishes: one job crashing must still leave its batch mates
acked, and a method that answered with `Settlement[]` and then threw would lose them.

No batch, no ack, no platform type. The ending logic, the timeout grace, the log fields and the
counters are untouched — `return message.ack()` becomes `return { type: "ack" }`, and every backend
becomes a translation layer outside the seam.

This is not [ADR-044's rejected "Expose The `Message` Itself"](./ADR-044-function-defined-jobs-with-declarative-schedules.md).
`JobDelivery` never reaches a handler. The four verbs stay the only way a handler ends a delivery,
and the parsed `input` stays the only view of the payload it gets.

### 2. `JobQueue` is the port

```ts
export interface JobMessage {
	job: string;
	body: JSONValue;
	delay?: DurationInput;
}

export interface JobQueue {
	/** Who counts attempts and gives up: the backend's own policy, or this package's. */
	readonly retries: "backend" | "core";

	send(messages: JobMessage[]): Promise<Result<void, JobQueueError>>;

	/** Present when the backend is pulled rather than pushed. */
	claim?(options: ClaimOptions): Promise<Result<JobDelivery[], JobQueueError>>;
	settle?(delivery: JobDelivery, settlement: Settlement): Promise<Result<void, JobQueueError>>;
}
```

`claim` and `settle` are optional together, and their presence is what makes a backend pullable.
Cloudflare implements `send` alone and drives `deliver()` from its own queue handler; a pulled
backend gets the loop shipped with the package.

Every adapter names its exports for what they are — `queue`, `worker` — and is reached through a
namespace import, so the subpath says which platform and the identifier says which role. A bare
`queue` imported by name would collide with the first local variable holding one, which is what
makes the namespace the intended form rather than a preference.

Every method answers with a `Result`, per [ADR-053](./ADR-053-cache-package-with-adapters.md)'s
`Nothing throws`. A delay a backend cannot honour is a `Result` failure and not a clamp: silence at
three in the morning is the failure this package exists to prevent, and a `delay` quietly truncated
from three days to fifteen minutes is that failure.

### 3. The message envelope names the job

```json
{ "job": "checkHttp", "body": { "monitorId": "…" } }
```

ADR-044 kept the name inside the payload as `type`, and rejected an envelope because a hard cutover
dead-letters every message in flight in the app that enqueues thousands an hour. That reasoning was
right about the cutover and wrong to treat it as a cutover. A read that accepts both formats costs
one `??` per field:

```ts
let name = body.job ?? body.type;
```

One deploy reads both and writes the new shape; the next drops the fallback, once nothing older is
in flight. The window is bounded by the queue's own retention, not by a coordinated release.

The envelope is what makes a third-party adapter possible at all: a table-backed queue wants `job` as
an indexed column, a library that dispatches by job name wants it as the name, and a hosted queue
wants it as a filterable attribute. Mixed into the payload, every adapter parses a body to learn what
it is holding.

It also lifts a restriction. `input` no longer has to be an object schema and `type` is no longer a
reserved key, because the payload no longer shares a namespace with the envelope.

### 4. Cron is one `tick()`

```ts
tick(options: { now: Date; only?: CronExpression }): Promise<void>;
```

`tick` enqueues what is due and runs nothing, which is what `scheduled()` does today.

With `only`, matching stays a string comparison and no schedule is evaluated — the platform has
already decided when to deliver, exactly as ADR-044 concluded. Cloudflare's handler becomes
`tick({ now: new Date(controller.scheduledTime), only: controller.cron })`.

Without `only`, `Schedule.matches(now)` from `@sdxc/cron` decides, so a backend with no triggers
behind it is driven by a ticker on a minute's cadence.

One method, two callers, no second cron concept. Catching up a missed window is
[deferred](#5-catch-up-by-default).

### 5. Retry policy has an owner

`retries` on the port says who counts. `"backend"` leaves the ceiling where it is — for Cloudflare
that is `max_retries` in `wrangler.jsonc`, one policy per queue, which is where
[ADR-044 put it](./ADR-044-function-defined-jobs-with-declarative-schedules.md) and where it stays.
`"core"` enables a `maxAttempts` option on the dispatcher, and a `retry` settlement for a delivery
that has reached it is promoted to `dead-letter` before the adapter sees it.

The flag exists because the divergence is real rather than cosmetic: one hosted queue reports its
attempt count as approximate, and a job library that already owns backoff and its own dead-letter
list would double-count anything this package decided. It stays one flag. There is no capability
matrix.

`maxAttempts` is a dispatcher option and not a leaf field, so ADR-044's reasoning about consumer-level
policy is preserved.

### 6. `meta` replaces `monitorId`

```ts
interface Monitored {
	monitorId: string;
}

export default jobs({
	cleanExpiredSessions: job({
		cron: "0 0 * * *",
		meta: { monitorId: "74f508a2-e6e9-4f01-8c25-2884330e7870" } satisfies Monitored,
	}),
});
```

`meta` is unconstrained and inferred with `const`, so the narrow type survives to the read site:
`job({ meta: { monitorId: "abc" } })` reads back as `{ readonly monitorId: "abc" }`, literal and
all, which is the precision that comes free at the declaration site.
`Meta` threads through `JobOptions` and `JobDefinition` only — `JobContext<Input>` gains no second
type parameter, because the one reader that needs the type asks for it by job.

Nothing in the package constrains the shape, and an app that wants a shared vocabulary declares it
locally with `satisfies`. That is one line, it is checked at the declaration site, and two apps can
constrain differently — which a published package cannot do for them.

`monitorId` leaves `JobOptions` and `ctx.monitorId` leaves the context.

`ctx.of(job)` is the typed read for a hook that cares about one job, and it is not the read for a
hook covering many: an app whose whole map is monitored wants one lookup keyed on `ctx.name` rather
than a branch per job. Both are app-side — a `Map` built from the map on first use is six lines — so
the accessor stays the only thing the package owes either of them.

### 7. `ctx.of(job)` narrows a dispatcher-level context

A hook is per dispatcher, so its context is `JobContext<unknown> & ChainProperties<Chain>`: `input`
is reachable and untyped, and `meta` has no single type to have. One accessor answers both, guarded
by the job's name:

```ts
/** This delivery's view of `job`, or `null` when the delivery is for another job. */
of<Schema, Meta>(job: JobDefinition<Schema, Meta>): { input: JobOutput<Schema>; meta: Meta } | null;
```

The name check is what separates a narrowing from an assertion: the type comes from the argument
while the value comes from whichever job ran, and without the check a stale guard lies silently.
`runJob` already guards the same class of mistake with `handler.job !== job`.

Two absences, two signals, at different levels. `null` answers "is this delivery for that job" — the
object's presence. `meta === undefined` answers "did that job declare any" — a field's presence.

`ctx.input` stays a field for handlers, where `createJobHandler(map.checkHttp, …)` types it already.

### 8. `onEnd` is a settlement barrier, not an event

```ts
onEnd?: (ctx: CurrentJobContext, status: JobStatus) => void | Promise<void>;
```

```ts
export type JobStatus =
	| { type: "done" }
	| { type: "retry"; delay: DurationInput | undefined; error: Retry }
	| { type: "refuse"; error: NonRetriable }
	| { type: "timeout"; error: unknown }
	| { type: "failed"; error: unknown };
```

Its contract is one sentence: **`onEnd` runs after the ending is decided and before the delivery is
settled.** That ordering is the reason it exists. An isolate can be frozen once its handler returns,
so a report that has to reach a service has to be awaited here; the logger's `sink` already carries
every field a record holds, but it runs after the record is emitted.

Three rules make it safe:

- **Its failure is never the job's failure.** Everything it throws is caught, recorded as
  `job.hook_failed` on the job's own log, and the ending settles as decided. That is a flat rule
  replacing the two-error-class check in `settle()`, and it is the stricter of the two: an uptime
  bug currently throws a third type and redelivers work that already succeeded.
- **It is bounded.** The hook is raced against `SETTLE_GRACE`, the constant already sized for
  bounding an unwind, and an overrun is a warning rather than a hung delivery.
- **Middleware-installed values are past their disposal.** The chain has fully unwound before
  `settle()` runs, so `ctx.database` may be a connection whose scope has closed — `apps/r3-auth`
  wraps the chain in `container.scope(() => next())`, which closes when `next()` resolves, while
  another app's `database()` middleware has no teardown and happens to survive. Anything that needs
  a live dependency belongs in a middleware's `finally`, which sees the thrown endings already.

`ctx.signal` is aborted for a `timeout` or `retry` status, so a hook's own I/O takes its own signal.

The `uptime` option and the `instanceof` branch in `settle()` are deleted, and the ping stops being
something the lifecycle does. The function itself survives, unwired, as
[decision 11](#11-sdxcjobsuptime-ships-the-ping-as-a-client).

Only four moments exist in a delivery and the package names them all, so the closed set is served by
named options — `onInvalid`, `onEnd`, and `onDeadLetter` — rather than by an emitter.

### 9. Two adapters ship, the rest are papered

`adapters/cloudflare.ts` and `adapters/memory.ts` are the published set.

Memory is not a test double. It serializes on write and parses on read, expires against an
injectable clock, counts its own attempts, and holds its own dead-letter list, so it answers as a
remote backend would and is honest for a single-instance deployment. It is what a consumer with no
platform queue reaches for first.

It adds one affordance the port does not carry: `drain(deliver)` runs everything pending through the
function it is given and answers with the settlements, which is the assertion a test wants and the
reason it does not wait on `startWorker`.

The rest are [papered](#paper-adapters): a sketch each, checked against the port and shipped as
prose. Four backends nobody here runs would be four backends nobody here maintains, and a
conformance suite with two friendly implementors cannot tell whether the port is sufficient or merely
convenient. The sketches can.

### 10. The conformance suite

`@sdxc/jobs/conformance` registers the suite that says what a job queue is, against whatever the
caller constructs — the shape [ADR-053](./ADR-053-cache-package-with-adapters.md) established. Both
adapters run it. It asserts round-tripping a message, the envelope's `job` surviving, `attempts`
counting from one, a `retry` settlement redelivering, a `dead-letter` settlement not redelivering, a
delay past the backend's ceiling failing rather than truncating, and `claim` leasing a delivery so a
second claim does not see it.

### 11. `@sdxc/jobs/uptime` ships the ping as a client

The ping leaves the lifecycle and stays in the package as a subpath export: a function that takes a
monitor id, sends the request, and answers with a `Result`. It is wired to nothing.

```ts
export type UptimeErrorCode =
	/** The service answered, and refused the ping. */
	| "refused"
	/** The ping never got an answer. */
	| "unreachable"
	/** No token resolved, so no ping was sent. */
	| "unconfigured";

export class UptimeError extends Error {
	override name = "UptimeError";
	readonly code: UptimeErrorCode;
	readonly monitorId: string;
	/** The status the service refused with, for a `refused` failure. */
	readonly status: number | undefined;
}

export function createUptimeReporter(options: {
	/** Resolves the bearer token per call, so no binding is read at module scope. */
	token: () => string | undefined;
	/** @default "https://uptime.sergiodxa.com" */
	url?: URL;
}): (monitorId: string) => Promise<Result<void, UptimeError>>;
```

A factory rather than a bare function, because the token has to come from somewhere and binding it
once is what leaves the call site with a monitor id and nothing else. It resolves the token per call,
which is the property the `uptime` option had and the reason it was a thunk.

`UptimeFetchError` and `UptimeNetworkError` collapse into one class carrying a code, the shape
[ADR-053](./ADR-053-cache-package-with-adapters.md) settled on for `CacheError`. A missing token is
`unconfigured` rather than a silent success: a production secret that never arrived should be
visible to an app that looks, and an app that does not look is unaffected either way.

```ts
const uptime = createUptimeReporter({ token: () => env.UPTIME_CRON_API_KEY });

createJobDispatcher({
	logger,
	queue: cloudflare.queue(() => env.QUEUE),
	middleware: [database()],

	async onEnd(ctx, status) {
		if (status.type !== "done") return;
		let view = ctx.of(jobs.cleanExpiredSessions);
		if (view === null) return;
		await uptime(view.meta.monitorId);
	},
});
```

The `Result` is what makes discarding the outcome an act rather than an oversight — a ping that did
not land is not a reason to redeliver work that did, and the app says so by not reading it. That is
also why [decision 8](#8-onend-is-a-settlement-barrier-not-an-event) catches everything the hook
throws: the two mechanisms agree, and neither can turn a reporting failure into a job failure.

Either call works, and the app chooses. `onEnd` returns `void | Promise<void>`, and `waitUntil` is
importable from `cloudflare:workers` — the module every dispatcher already reads `env` from — so
handing the promise to the platform needs nothing from this package and no `ExecutionContext`:

```ts
waitUntil(uptime(view.meta.monitorId));
```

The trade is observability against settle latency. Awaited, the ping finishes inside the barrier and
its failure reaches that job's record as `job.hook_failed`, at the cost of a round trip before the
ack — paid once per message, so a batch of a hundred pays it a hundred times. Handed to
`waitUntil`, the delivery settles at once and the ping outlives the invocation, but its outcome
lands nowhere: `log.run()` has emitted the record by the time the promise resolves, and a wide event
is written once.

Awaiting is the better default for a job that reports a monitor, because a monitor nobody can see
failing is the thing the monitor was for. A batch large enough for the round trips to matter is the
case for `waitUntil`, and it is the app's call either way.

### API Surface

| Export                           | Kind     | Change                                    |
| -------------------------------- | -------- | ----------------------------------------- |
| `job`, `jobs`                    | function | `meta` added, `monitorId` removed         |
| `createJobHandler`, `JobContext` | function | `ctx.of()` added, `ctx.monitorId` removed |
| `createJobDispatcher`            | function | `queue` replaces `send`; `onEnd` added    |
| `messageBody`                    | function | builds the envelope                       |
| `Job`, `Ending`                  | class    | unchanged                                 |
| `JobQueue`, `JobMessage`         | type     | new — `@sdxc/jobs/queue`                  |
| `JobDelivery`, `Settlement`      | type     | new — `@sdxc/jobs/queue`                  |
| `JobQueueError`                  | class    | new — `@sdxc/jobs/queue`                  |
| `JobStatus`                      | type     | new                                       |
| `deliverBatch`, `tick`           | method   | new — replace `queue()` and `scheduled()` |
| `queue`, `worker`                | function | new — `@sdxc/jobs/cloudflare`             |
| `queue`                          | function | new — `@sdxc/jobs/memory`                 |
| `conformance`                    | function | new — `@sdxc/jobs/conformance`            |
| `createUptimeReporter`           | function | new — `@sdxc/jobs/uptime`                 |
| `UptimeError`                    | class    | replaces the two error classes            |
| `startWorker`                    | function | deferred until a pulled backend exists    |

### Worked Example

`apps/r3-auth`, whole, as it reads after this ADR. Two jobs: the daily sweep a monitor watches, and
one enqueued per user.

`app/jobs/index.ts` — the map. The key each job is filed under is its name on the wire, so a key is
as frozen as any HTTP payload.

```ts
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

/** What a job a cron monitor watches declares, so every one of them spells it the same way. */
interface Monitored {
	monitorId: string;
}

export default jobs({
	/**
	 * The daily session sweep, at midnight UTC. The monitor exists under this id and alerts on
	 * a missed run, so this exact value is what keeps the alert pointed at this job.
	 */
	cleanExpiredSessions: job({
		cron: "0 0 * * *",
		meta: { monitorId: "74f508a2-e6e9-4f01-8c25-2884330e7870" } satisfies Monitored,
	}),

	/** One user's outstanding grants, enqueued when an admin revokes their access. */
	revokeUserTokens: job({ input: s.object({ userId: s.string() }) }),
});
```

`app/jobs/clean-expired-sessions.ts` — the handler. `createJobHandler` pairs it with the job, which
is what types `ctx.input`; `ctx.database` is what the chain installed.

```ts
import { createJobHandler } from "@sdxc/jobs";

import Session from "~/app/data/session";
import jobs from "~/app/jobs";

/**
 * Reads the expired ids first so the run's record reports what the sweep actually removed, and
 * records the counts alone: a session id stays a live refresh token until it expires.
 */
export default createJobHandler(jobs.cleanExpiredSessions, async (ctx) => {
	let expiredSessions = await Session.findExpiredSessions(ctx.database);
	ctx.log.set({ sessions: { expired: expiredSessions.length } });

	if (expiredSessions.length === 0) return;

	let deletedCount = await Session.deleteExpiredSessions(ctx.database);
	ctx.log.set({ sessions: { deleted: deletedCount } });
});
```

`app/jobs/dispatcher.ts` — the queue it writes to, the chain every job runs inside, where each
handler comes from, and the report a completed run sends.

```ts
import type { JobDispatcherContext } from "@sdxc/jobs";

import { createJobDispatcher } from "@sdxc/jobs";
import { createUptimeReporter } from "@sdxc/jobs/uptime";
import * as cloudflare from "@sdxc/jobs/cloudflare";
import { env } from "cloudflare:workers";

import jobs from "~/app/jobs";
import { database } from "~/app/jobs/middleware/database";
import { logger } from "~/bootstrap/logger";

/** Reports a completed run to the monitor watching it. The token resolves per call. */
const uptime = createUptimeReporter({ token: () => env.UPTIME_CRON_API_KEY });

export const dispatcher = createJobDispatcher({
	logger,
	queue: cloudflare.queue(() => env.QUEUE),
	middleware: [database()],
	timeout: "5 minutes",

	/**
	 * Reports the sweep once it completes. Awaited rather than handed to `waitUntil`, so a ping
	 * the service refuses reaches this run's own record; every other job ends here and returns.
	 */
	async onEnd(ctx, status) {
		if (status.type !== "done") return;

		let sweep = ctx.of(jobs.cleanExpiredSessions);
		if (sweep === null) return;

		await uptime(sweep.meta.monitorId);
	},
});

/**
 * Loaders rather than the handlers themselves, so a request that only enqueues parses neither
 * module.
 */
dispatcher.map(jobs.cleanExpiredSessions, () => import("~/app/jobs/clean-expired-sessions"));
dispatcher.map(jobs.revokeUserTokens, () => import("~/app/jobs/revoke-user-tokens"));

/**
 * Names the context this app's handlers receive. A handler file imports the job map and not the
 * dispatcher, so this is what tells `createJobHandler` that `ctx` carries what the chain installed.
 */
declare module "@sdxc/jobs" {
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}
```

`bootstrap/worker.ts` — the entry point. `cloudflare.worker` is the only place a `MessageBatch` or a
`ScheduledController` is named: it translates a batch into `deliver()` calls and a trigger into a
`tick`, and applies each `Settlement` with `ack()` or `retry()`.

```ts
import * as cloudflare from "@sdxc/jobs/cloudflare";
import { env } from "cloudflare:workers";

import { dispatcher } from "~/app/jobs/dispatcher";

import application from "./app";

/** Both job handlers, bound to the dispatcher they delegate to. */
const handlers = cloudflare.worker(dispatcher);

export default {
	/**
	 * Serves an HTTP request.
	 * @param request The inbound request.
	 */
	async fetch(request) {
		let app = application({ kv: env.KV, cookieSecret: env.COOKIE_SESSION_SECRET });
		return await app.fetch(request);
	},

	/**
	 * Enqueues the work a cron delivery implies, so a sweep that outgrows the trigger's budget
	 * becomes the queue's problem and gets its own retries.
	 * @param controller The trigger being delivered.
	 */
	async scheduled(controller) {
		await handlers.scheduled(controller);
	},

	/**
	 * Runs the job each queued message names, settling once every one of them has.
	 * @param batch The messages this delivery carries.
	 */
	async queue(batch) {
		await handlers.queue(batch);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
```

Three details the example carries. `queue` takes a thunk rather than the binding, so importing the
dispatcher touches none — the property the `send` function it replaces stated in a doc comment.
`deadLetterQueue` and `onInvalid` both stay dispatcher options. Recognising a dead-letter queue
means matching a name, and the neutral batch entry already carries the name it was read from —
moving the match into `worker` would hand the adapter the logger as well, since the record for a
dead-lettered delivery belongs to the same `queue` log as every other one.

And `queue` and `worker` are two exports because they answer to two different callers. `queue` is
the producer, and anything that enqueues needs it — a request path that fans work out imports the
dispatcher and nothing else. `worker` is the consumer, needed only at the entry point, and it is
what pulls the batch translation, the dead-letter recognition and every handler loader into a
module graph. The dispatcher sits between them, so the order is fixed: a queue exists before the
dispatcher that writes through it, and the dispatcher exists before the handlers that deliver into
it.

The same three files run against no platform at all, which is the point of the port:

```ts
import * as memory from "@sdxc/jobs/memory";

let queue = memory.queue();
let dispatcher = createJobDispatcher({ queue, middleware: [database(testDatabase)] });
dispatcher.map(map.cleanExpiredSessions, handler);

await dispatcher.enqueue(map.cleanExpiredSessions);
let settled = await queue.drain((delivery) => dispatcher.deliver(delivery));

expect(settled).toEqual([{ type: "ack" }]);
```

## Implementation Plan

### Phase 1 — The seam

`JobDelivery`, `Settlement`, `deliver()`, and the envelope with its dual read. `settle()` returns
instead of calling. The Cloudflare translation stays inline in `dispatcher.queue()` for this phase,
so no app's own code changes. Both halves of this phase are unfixable later: the wire format
outlives a deploy, and a published `Settlement` outlives these apps.

App _tests_ do change, because a test that asserts an enqueued body asserts the format — around
thirty assertions across a dozen files, each a payload moving under `body`. That is the honest cost
of the envelope and the only app-side work this phase carries.

### Phase 2 — Adapters

`adapters/cloudflare.ts` takes the `Message`/`MessageBatch`/`ScheduledController` handling and
`@cloudflare/workers-types` with it. `adapters/memory.ts` and the conformance suite follow, and the
package's own suite moves off `@sdxc/cloudflare-mocks`.

### Phase 3 — Apps

`createJobDispatcher({ send })` becomes `({ queue: cloudflare.queue(() => env.QUEUE) })` across
`apps/r3-auth`, `apps/blog-saas`, `apps/uptime` and `apps/r3-uptime`. `monitorId` becomes `meta` in
`apps/r3-auth`, and its ping becomes an `onEnd` calling `createUptimeReporter`. The second deploy
drops the envelope's read fallback.

### Phase 4 — Publish

`@sdxc/cron`, `@sdxc/validate` and `@sdxc/logger` join ADR-007's release set, with `remix` demoted to
a peer or optional dependency on `@sdxc/logger`. `@sdxc/jobs` publishes as `0.0.0-pre.1` behind them.
The paper adapters ship as the port's reference documentation.

## Consequences

### Positive

- A dispatcher can be tested without a queue binding, in any runtime, which is most of the point.
- Publishing becomes possible without publishing Cloudflare's type package alongside it.
- The lifecycle's rules become uniform: reporting never changes an outcome, and a delay a backend
  cannot honour fails instead of shrinking.
- The uptime ping leaves the lifecycle, and the two error classes behind it collapse into one
  carrying a code.
- `input` stops being restricted to object schemas, and `type` stops being a reserved key.
- `ctx.of(job)` gives a dispatcher-level hook the types a handler already has.
- A backend that wants to index or route by job can, because the name is a field rather than a
  payload key.

### Negative

- The envelope needs a two-deploy window, and the first deploy of Phase 1 must reach production
  before the second.
- `retries` is a capability flag, and one flag invites a second. It is held at one on purpose, and a
  second belongs in its own ADR.
- `onEnd` runs where middleware-installed values may be disposed, and the boundary is documented
  rather than enforced.
- Four apps change their dispatcher construction at once.
- The conformance suite has two implementors, both written here, so its power as a design check is
  limited and the paper adapters carry that weight instead.
- `meta` is unconstrained, so nothing stops one job spelling a key differently from another.
- A published package carries a client for one specific service. `url` is an option so the subpath
  is a client rather than a hardcoded host, but a consumer who reports nowhere still installs it.

### Neutral

- `startWorker`, the pulled loop, is designed but unbuilt. No shipped adapter needs it.
- The `queue` field ADR-044 deferred stays deferred; the envelope makes it additive.
- Cron catch-up stays out, so a ticked backend fires only what the current minute matches.
- A hook may await its work or hand it to `waitUntil` from `cloudflare:workers`. The package takes
  no position beyond returning `void | Promise<void>`, and neither call needs anything from it.

## Paper Adapters

Four sketches, each chosen because it breaks a different assumption. None ships.

**A table-backed queue.** `claim` is `UPDATE … SET leased_until = now() + $lease WHERE state = 'ready'
AND run_at <= now() FOR UPDATE SKIP LOCKED RETURNING *`; `settle` is an `UPDATE` per outcome; `send`
is an `INSERT` with `run_at`. `retries: "core"`. Wants `job` as an indexed column, which is
[decision 3](#3-the-message-envelope-names-the-job). It also wants `send(messages, { tx })` so an
enqueue can share the transaction that caused it — the reason a table-backed queue is worth wanting
at all, and the reason `send` takes a list and an options object rather than a bare body.

**A hosted queue with visibility timeouts.** Push and pull both. `settle` maps `retry` onto a
visibility change rather than a write, `ack` onto a delete. `retries: "backend"`, because its
attempt counter is approximate. Caps a delay at fifteen minutes, which is the ceiling
[decision 2](#2-jobqueue-is-the-port) refuses to hide, and caps a batch at ten, which the adapter
chunks.

**A log-structured store with consumer groups.** `claim` reads the group's pending entries and
recovers orphans by lease age; `settle` acknowledges or leaves the entry pending. It has no delay of
its own, so a delayed `send` writes to a companion sorted set that the ticker drains — the one
sketch where `send` and `claim` touch two structures, and the reason `delay` is a message field
rather than a queue-level setting.

**A job library that owns its own policy.** `send` is an add, `claim` and `settle` are the library's
own. `retries: "backend"`, and this is the sketch that flag exists for: the library already counts
attempts, computes backoff, and keeps a failed list, so a core that promoted `retry` to
`dead-letter` would be overruling it.

## Alternatives Considered

### 1. An event emitter

`dispatcher.on("job.ended", …)`, with siblings for the other moments.

**Rejected because**: `createLogger({ sink })` is already that bus — every `cron`, `queue` and `job`
record flows through it, and [ADR-033](./ADR-033-wide-events-as-the-logging-contract.md) makes it the
contract. A second stream of the same facts, arriving at a different moment in a different shape,
competes with it. The genuine gap is narrower than observability: work that must complete before the
delivery settles, which the sink cannot do because it runs after emit. For a set of moments the
lifecycle closes, named options are discoverable in one interface and carry their own ordering.

### 2. `JobMeta` as an augmented interface

An empty interface in the package, augmented by the app, constraining `job({ meta })` everywhere.

**Rejected because**: once `ctx.of(job)` addresses meta by job, uniformity buys nothing — the reader
names what it wants and gets the exact type. It also would not do what it appears to. An augmented
`{ monitorId?: string }` still accepts `{}`, since every field is optional, so it checks shape and
not presence. A local `satisfies` gets the shape check without a global seam, and lets two apps
differ.

### 3. A meta schema on the dispatcher

`createJobDispatcher({ meta: MetaSchema })`, validating each job's meta and typing it in the hook.

**Rejected because**: `input` needs a schema for crossing two boundaries — a trust boundary and a
version boundary, since a message enqueued by yesterday's deploy is consumed by today's. `meta`
crosses neither; it is compiled in beside the job that declares it, so validating it checks the
source against itself. It would also run at `map()` time, which is module scope in every isolate.

### 4. `Meta` threaded through the context

`JobContext<Input, Meta>`, so `ctx.meta` is typed without an accessor.

**Rejected because**: a hook is per dispatcher, so `ctx.meta` would be a union across every job with
no discriminant to narrow on. It also costs a second type parameter through the context and every
`Any*` alias, to make the type worse where it is read.

### 5. Catch-up by default

Give the dispatcher a last-run store so a ticked backend fires a window it missed.

**Deferred because**: `Schedule.isDue(lastRun)` from `@sdxc/cron` already computes it, so this is
additive whenever a pulled backend exists. Cloudflare's triggers are the source of truth for a minute
having happened, and no shipped adapter is ticked, so the store would be carried by every consumer
and read by none.

### 6. Keep the flat wire format

Keep `{ type, …input }` and leave the envelope to a major version.

**Rejected because**: it is the one decision here that cannot be revisited after publishing, and the
cutover cost that justified it in ADR-044 dissolves under a dual read. Every adapter would parse a
body to learn which job it holds, and `type` would stay reserved forever.

### 7. Drop `@sdxc/result` from the port

Throw a typed `JobQueueError` instead, so the port has one fewer dependency to publish.

**Rejected because**: `@sdxc/result` is in the release set already, so it costs nothing to publish.
[ADR-053](./ADR-053-cache-package-with-adapters.md) settled this exact deviation by overruling it
after it was raised three times, and a second package answering differently would reopen it. If the
port is ever rewritten for a host with its own conventions, the internals change and this seam
changes with them.

### 8. Ship a table-backed and a log-structured adapter

Publish four backends so the port is demonstrably general.

**Rejected because**: they would be maintained by someone who does not run them, which is how a port
rots. The sketches find the design bugs; a real adapter finds the operational ones, and only its
operator can.

### 9. Keep the uptime ping wired into the lifecycle

Leave `monitorId` on the leaf and the `uptime` option on the dispatcher, and make the host
configurable.

**Rejected because**: wiring it costs a leaf field, a context field, a dispatcher option, two error
classes and an `instanceof` branch in `settle()` — and the branch is the expensive part, since it is
the lifecycle deciding on an app's behalf whether a failed report should redeliver finished work. `onEnd` plus
[a client](#11-sdxcjobsuptime-ships-the-ping-as-a-client) is more general at less cost, and it moves
the decision about a failed ping to the app, where the answer is a `Result` it can ignore rather than
an error class the lifecycle has to recognise.

### 10. Publish the ping as `@sdxc/uptime`

Give the client its own package instead of a subpath of this one.

**Rejected because**: the ping is only ever sent from a job, and ADR-007's release set already grows
by three. A subpath keeps it beside its one caller at no release cost. It moves out of the package
the day something other than a job reports to a monitor.

## Current Progress

**Implemented** as of 2026-09-07. All eleven decisions are in `packages/jobs`, and
`apps/r3-auth`, `apps/blog-saas` and `apps/uptime` run on them.

Four things the build changed about the design, each recorded above where it belongs:

- `deliver()` alone could not carry a batch. A batch settles each delivery as that one
  finishes, so one job crashing still leaves its batch mates acked, which a method
  answering with `Settlement[]` and then throwing would lose. Hence `deliverBatch` and its
  `apply` callback.
- `deadLetterQueue` and `onInvalid` stayed dispatcher options. Moving the dead-letter match
  into `worker` would have handed the adapter the logger too, since that record belongs to
  the same `queue` log as every other delivery's.
- `worker` is typed by the two methods it calls rather than by `JobDispatcher`, whose
  default empty chain no real app satisfies.
- The premise that one job declared a monitor was wrong — fifteen do, across two apps. That
  is what showed `ctx.of(job)` to be the read for a hook covering one job and a name lookup
  to be the read for a hook covering many.

Phase 4 is done too. `@sdxc/cron`, `@sdxc/validate` and `@sdxc/jobs` are open for publishing, and
`@sdxc/logger`'s `remix` dependency became an optional peer, matching what `@sdxc/auth` had settled
on a commit later.

Emitting declarations is what proved the manifests: it is the only check that sees a type-only
import reach a `.d.ts`, which is how `remix` and `@cloudflare/workers-types` turned out to belong in
`@sdxc/jobs`'s manifest after all. Neither `typecheck` nor the tests emit declarations, so neither
can catch it.

## References

- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-021: Cron Schedule Package](./ADR-021-cron-schedule-package.md)
- [ADR-033: Wide Events As The Logging Contract](./ADR-033-wide-events-as-the-logging-contract.md)
- [ADR-044: Function-Defined Jobs With Declarative Schedules](./ADR-044-function-defined-jobs-with-declarative-schedules.md)
- [ADR-053: Cache Package With Adapters](./ADR-053-cache-package-with-adapters.md)
- [fetch-router](../vendor/@remix-run/fetch-router/README.md)
- [session-storage-redis](../vendor/@remix-run/session-storage-redis/README.md)
- [Cloudflare Queues](https://developers.cloudflare.com/queues/)
