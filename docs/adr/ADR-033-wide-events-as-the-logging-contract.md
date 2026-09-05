# ADR-033: Wide Events As The Logging Contract

## Status

**Proposed** - 2026-09-04

## Background

[ADR-004](./ADR-004-request-logger.md) introduced `RequestLogger`, a request-scoped logger that grouped events by React Router lifecycle phase — middleware, loaders, actions, render — and flushed them as one console entry carrying request, response, and Cloudflare metadata. `BatchedLogger` did the same for a unit of background work, and a singleton `logger` wrote immediately for everything else.

Three things have changed since. No app depends on `react-router` any more; all of them are on Remix v3 and `remix/router`, so the phases the logger organizes around no longer exist. Every worker runs with `"observability": { "enabled": true }`, so Cloudflare emits its own per-invocation log containing most of what `RequestLogger` was written to capture by hand. And the worker entry points have converged on one shape — `fetch` into a router, `scheduled` and `queue` into a job dispatcher ([ADR-044](./ADR-044-function-defined-jobs-with-declarative-schedules.md)), MCP served as a route ([ADR-036](./ADR-036-model-context-protocol-server-package.md)) — which is a shape with exactly two places every invocation passes through, the router and the dispatcher, and one logger can attach at both.

## Context

### Current State

`@sdxc/logger` exports three classes, all named `Logger`, distinguished by when they write:

| Export          | Writes                                        | Used by                                                                                                                       |
| --------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `logger`        | One console call per log, immediately         | Services with no invocation in reach, the uptime cost ledger                                                                  |
| `BatchedLogger` | One console call per unit of work, on `flush` | `@sdxc/jobs`, one per job run plus one per refused message                                                                    |
| `RequestLogger` | One console call per request, on `flush`      | The middleware every app's router starts with, and both engine packages, which construct one per request in their own `fetch` |

`RequestLogger` produces:

```jsonc
{
	"id": "8f3…", "timestamp": 1204.4, "duration": 145,
	"request": { "url": {…}, "method": "GET", "headers": {…}, "cf": {…} },
	"response": { "status": 200, "headers": {…} },
	"subject": {…}, "profile": {…}, "billing": {…},
	"middleware": { "session": [ { "level": "info", "event": "session.read", … } ] },
	"loaders": { "/dashboard/tenants": [ … ] }
}
```

Roughly 490 call sites across the apps and packages write into one of the three.

### Where Logging Happens Today

| Entry point              | How the logger arrives                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fetch` → router         | `logger` middleware constructs a `RequestLogger`, publishes `ctx.logger`, flushes in `finally`                                                               |
| `fetch` → engine package | `@sdxc/oidc-provider` and `@sdxc/blog-engine` construct their own `RequestLogger` inside `fetch`, then pass it into their router through a second middleware |
| `fetch` → MCP route      | Nothing. `createHandler` reports unexpected errors through an `onError` callback the app wires by hand                                                       |
| `scheduled` → dispatcher | Nothing. The trigger enqueues and returns unlogged                                                                                                           |
| `queue` → dispatcher     | `runJob` constructs a `BatchedLogger` per message; `refuse` and `recordDeadLetter` construct their own                                                       |
| Durable Object `fetch`   | Whatever the engine package does                                                                                                                             |
| Anywhere else            | `getContext().logger` through Remix's `asyncContext()`, or the immediate singleton                                                                           |

Every row constructs its own logger with its own idea of what to record. `service`, `version`, and an environment are known once per worker, and nothing states them.

### What Cloudflare Already Logs

With observability enabled, each invocation — a `fetch`, a `scheduled` trigger, a `queue` batch, a Durable Object alarm — produces a log tagged `$cloudflare.$metadata.type = "cf-worker-event"` holding the Request, the Response, timing, and the colo/geo/network context, and every `console` call made during that invocation is correlated to it. Logs are JSON-indexed with unlimited field cardinality, capped at 256 KB per log.

So the request URL, method, headers, status, response headers, and the whole `cf` block are recorded twice: once by Cloudflare, once by us, inside a budget we would rather spend on things Cloudflare cannot know.

### Issues Identified

1. **Half the package restates Cloudflare.** `filterRequestHeaders`, `filterResponseHeaders`, `extractCfInfo`, `RequestInfo`, `ResponseInfo`, and their two header allowlists exist to reproduce fields already present on the invocation log.

2. **High-cardinality data sits in key position.** `loaders` and `middleware` are objects keyed by route ID and middleware name, so every route introduces a new field path in the index and its events land inside arrays of objects. "All requests where `tenants.loaded` reported a count above 100" is not expressible; the data is reachable only by reading one log at a time.

3. **The scope taxonomy is dead.** `middleware()` is called seven times across the monorepo; `loader()`, `action()`, and `render` are effectively unused. Everything else calls the unscoped `info`/`error`, which lands in a flat `events` array — the shape ADR-004 set out to replace.

4. **There is no measurable content.** No query counts, no outbound call counts or durations, no cache hit/miss, no outcome field. The entry records what the code did, not what happened to the request, so it answers "what was logged" and not "which requests were slow, and what did they have in common".

5. **Nothing is configured once.** `service`, `version`, and an environment are known once per worker, and no log carries them. A query across workers has nothing to group by.

6. **`scheduled` and the MCP surface log nothing of their own.** A cron trigger that enqueued zero jobs and one that enqueued twelve look identical; a tool call is a `POST /mcp` with no method or tool name on it.

7. **Every consumer constructs its own logger.** The router middleware, both engine packages, and three places in the jobs dispatcher each call a constructor with their own identifier scheme, so what a log looks like depends on which code path produced it.

8. **`timestamp` means two different things.** `BatchedLogger` and `RequestLogger` set it from `performance.now()` — milliseconds since isolate start — while the immediate `Logger` sets it from `Date.now()`.

9. **Context is write-only and wholesale.** `subject`, `profile`, and `billing` are setters that replace their value, so a second middleware cannot add to what a first one learned.

10. **Errors have no shape.** The middleware flattens a thrown error to `{ error: message, stack }`: no type, no code, no retriability. There are only two levels, `info` and `error`, so a recoverable problem must pick between being invisible and being an alarm.

11. **`console.info(identifier, output)`** puts the most useful filter — method, URL, status — into a message string rather than an indexed field.

12. **Event names use two conventions.** `token_issued` and `admin_client_not_found` alongside `job.check_http.duplicate` and `webhook.polar.subscription`.

13. **There is no outcome-aware lever on volume.** Every event is kept, and the only sampling available — Cloudflare's `head_sampling_rate` — drops a failed invocation at the same rate as a successful one, so it cannot be turned on for a worker whose failures are the point.

## Decision

Replace the three loggers with one **`Logger`**, configured once per worker and attached at the top of the router's middleware chain and on the job dispatcher, that opens one **`Log`** — a wide event — per invocation and emits it once. An invocation is a request, a cron trigger, a queue batch, a job run inside that batch, or a Durable Object alarm, and all of them share one shape, so one query spans a request and the job it enqueued.

The current log is reachable from anywhere inside the invocation through `AsyncLocalStorage`, which is what lets a service, an engine package, the job lifecycle, and the MCP handler all write into the same record without any of them being handed it.

### 1. `createLogger()` Is Configured Once, Attached Twice

```typescript
// bootstrap/logger.ts
import { createLogger } from "@sdxc/logger";

export const logger = createLogger({
	service: "uptime",
	environment: env.ENVIRONMENT,
	version: env.CF_VERSION_METADATA?.id,
});
```

```typescript
// bootstrap/app.tsx
let router = createRouter({ middleware: [headRequests(), asyncContext(), log(logger), …] });

// app/jobs/dispatcher.ts
export const dispatcher = createJobDispatcher({ logger, send: sendQueueBatch, middleware: [database()] });
```

The worker's exported handler does not change: `fetch` goes to the router, `scheduled` and `queue` go to the dispatcher, and those two are where the logger attaches, because they are the two things every invocation passes through and each knows what the entry point cannot — the router knows the route, the dispatcher knows the job. `service`, `environment`, `version`, and the sampler are stated in one file, and every log either opens inherits them.

| Opened by                      | Kind      | Records                                                                      |
| ------------------------------ | --------- | ---------------------------------------------------------------------------- |
| `log(logger)` in the router    | `request` | `route`, `http.method`, `http.status`, `duration_ms`, `fail()` on a throw    |
| `dispatcher.scheduled()`       | `cron`    | `cron.expression`, `cron.scheduled_at`, `jobs.enqueued`, `fail()` on a throw |
| `dispatcher.queue()`           | `queue`   | `queue.name`, `queue.batch_size`, the `jobs.*` counters, `fail()` on a throw |
| The job lifecycle, per message | `job`     | §9                                                                           |

A host with neither a router nor a dispatcher in front of it — a Durable Object's `fetch` or `alarm` — uses the primitive both are built on:

```typescript
override fetch(request: Request) {
	return logger.open("request", { tenant: { id: this.id } }).run(() => this.#provider.fetch(request));
}

override alarm() {
	return logger.open("alarm", { tenant: { id: this.id } }).run(() => this.#provider.cleanup());
}
```

### 2. `Log` Is The Wide Event

```typescript
export namespace Log {
	/** What kind of invocation produced this log. */
	export type Kind = "request" | "cron" | "queue" | "job" | "alarm";

	/** How the invocation ended. `ok` until `warn` or `fail` says otherwise. */
	export type Outcome = "ok" | "degraded" | "error";

	/** Field values are scalars. Structure lives in the key, not the value. */
	export type Value = string | number | boolean | null;

	/** One level of nesting is accepted for writing and flattened to dotted keys. */
	export type Fields = Record<string, Value | Record<string, Value>>;

	export interface Options {
		kind: Kind;
		service?: string;
		environment?: string;
		version?: string;
		sample?: Sample.Options;
		/** Where the record goes. Defaults to the console; a test collects records instead. */
		sink?: (record: Record<string, unknown>, outcome: Outcome) => void;
	}
}

export class Log {
	constructor(options: Log.Options, fields?: Log.Fields);

	/** Merges fields. Repeatable; a nested object flattens to dotted keys. */
	set(fields: Log.Fields): this;

	/** Adds to a counter, creating it at zero. */
	inc(field: string, by?: number): this;

	/** Runs `fn`, recording `${name}.count` and `${name}.duration_ms` either way. */
	time<T>(name: string, fn: () => T | Promise<T>): Promise<T>;

	/** Records a breadcrumb. */
	note(name: string, fields?: Record<string, Log.Value>): this;

	/** Records a breadcrumb and degrades the outcome. */
	warn(name: string, fields?: Record<string, Log.Value>): this;

	/** Records the error fields and sets the outcome to `error`. */
	fail(error: unknown, fields?: Record<string, Log.Value>): this;

	/** A log of another kind that shares this one's configuration and counts back into it. */
	child(kind: Log.Kind, fields?: Log.Fields): Log;

	/** Binds this log as the current one for `fn`, fails it on a throw, and emits it in `finally`. */
	run<T>(fn: (log: this) => T | Promise<T>): Promise<T>;

	/** Emits once, or drops the log per the sampler. Idempotent. */
	emit(): void;
}
```

The emitted shape, for a request:

```jsonc
{
	"service": "uptime",
	"environment": "production",
	"version": "5f2a…",
	"kind": "request",
	"route": "/app/:teamId/monitors",
	"http.method": "GET",
	"http.status": 200,
	"outcome": "ok",
	"duration_ms": 84,
	"user.id": "usr_…",
	"user.plan": "pro",
	"team.id": "team_…",
	"db.count": 6,
	"db.duration_ms": 31,
	"fetch.count": 1,
	"fetch.duration_ms": 40,
	"notes": [{ "at": 12, "level": "info", "name": "session.read" }],
}
```

Nothing about the request URL, the headers, the response headers, or the colo appears, because Cloudflare's invocation log has all of it and correlates it to this one. `http.method` stays because `route` alone does not name a handler.

### 3. The Current Log Is Ambient

```typescript
import { currentLog } from "@sdxc/logger";

currentLog()?.inc("cache.miss");
```

`Log#run()` stores the log in an `AsyncLocalStorage` for the duration of `fn`, and `currentLog()` reads it. Every integration below is built on this one accessor: whichever attachment point opened the log, whoever runs inside the invocation enriches it without being handed it.

The repository already depends on this primitive in three places — `@sdxc/service-container`, Remix's `asyncContext()` middleware in every app's router, and the uptime cost ledger — and every worker that logs runs with `nodejs_compat`. `currentLog()` returns `undefined` outside an invocation, so an enrichment call site is always `currentLog()?.…` and is a no-op in a test that did not open one.

### 4. Router Middleware Opens Or Joins The Log

```typescript
import { log } from "@sdxc/logger/middleware";

let router = createRouter({ middleware: [headRequests(), asyncContext(), log(logger), …] });

router.get("/app/:teamId/monitors", (ctx) => {
	ctx.log.set({ team: { id: ctx.params.teamId } });
	// …
});
```

`log()` publishes the current log as `ctx.log`. When nothing is current it opens a `request` log — configured by the `logger` it was given, bare when it was given none — and emits it in `finally`; when a log is already current it joins that one. Either way it records `route` and `http.method`, and `http.status` when it is the one that opened the log.

The `logger` argument is optional because of the two engine packages. `@sdxc/oidc-provider` and `@sdxc/blog-engine` build their routers internally and today construct a per-request `Logger` in their own `fetch`; with `log()` in their middleware stacks they construct nothing, and the Durable Object hosting them wraps its entry points as §1 shows, so the engine's logs inherit that host's `service` without the engine ever seeing a logger. A host that does not wrap still gets logs, carrying no `service`, which is the visible sign to wrap it.

`route` is the one field that must stay low-cardinality. `RequestContext` exposes `params` and `url` but not the pattern that matched, so the middleware reconstructs it by substituting each `ctx.params` value back out of the pathname — `/app/team_abc/monitors` with `{ teamId: "team_abc" }` becomes `/app/:teamId/monitors`. A handler overrides it with `set({ route })` where that inference is wrong.

The module carries the `declare module "remix/router"` augmentation for `ctx.log`, as every provider middleware in the repository does, and exports the `CurrentLog` context key for code that reads `ctx.get(CurrentLog)` generically.

### 5. Fields Are Flat And Scalar

`set()` accepts one level of nesting for ergonomics and flattens it — `{ user: { id } }` is stored as `user.id`. Values are scalars; arrays and deeper objects are rejected at the type level. This is the whole enforcement mechanism for issue 2: a route ID, a user ID, or a monitor ID can only ever be a value, so no call site can grow the index a field at a time.

### 6. Counters And Timers Replace Manual Timing

```typescript
let monitors = await ctx.log.time("db", () => Monitor.claimDue(ctx.database, Date.now()));
```

records `db.count: 1` and `db.duration_ms: 31`, accumulating across calls with the same name, and records them on the throwing path too before rethrowing. `inc()` and `time()` exist so the performance section of the log is a by-product of doing the work rather than something each call site remembers to measure.

### 7. Notes Are The Narrative, Not The Query Surface

`notes` is the one array in the log and the only place a free-form message lives. It is documented as the thing you read once a query has found the log, never the thing you query; anything worth filtering on is a field. This gives the ~490 existing `info`/`error` calls a mechanical destination while making the better destination obvious. `emit()` caps the array and records how many notes were dropped rather than letting Cloudflare truncate the log and lose the fields at its end.

### 8. Failure Is A Field

`fail(error)` sets `outcome: "error"` and a fixed error shape:

```jsonc
{
	"error.type": "PolarError",
	"error.code": "rate_limited",
	"error.message": "Too many requests",
	"error.retriable": true,
}
```

`error.code` and `error.retriable` are read off the error when it carries them, so provider errors keep their own codes. `error.stack` is attached only when the log survives sampling. `warn()` covers the middle that today has no home: recorded, outcome degraded, no alarm.

### 9. Jobs: One Log Per Run, Counted Into The Batch

`createJobDispatcher({ logger })` is the dispatcher's attachment point. `scheduled()` opens the `cron` log and records how many jobs it enqueued; `queue()` opens the `queue` log and runs every message inside it, and `runJob` opens a `job` child per message. A batch of eighty messages therefore emits one batch log and eighty job logs, each of which is the unit that carries `attempts` and an ending:

```jsonc
{
	"service": "uptime",
	"kind": "job",
	"outcome": "degraded",
	"job.name": "checkHttp",
	"job.id": "…",
	"job.attempts": 2,
	"job.batch_size": 80,
	"job.ending": "retry",
	"job.delay_s": 300,
	"team.id": "team_…",
	"monitor.id": "mon_…",
	"db.count": 3,
	"db.duration_ms": 12,
	"duration_ms": 412,
}
```

| Ending                             | `job.ending`  | Outcome    |
| ---------------------------------- | ------------- | ---------- |
| Returned, or `ctx.ack()`           | `done`        | `ok`       |
| `ctx.retry()`                      | `retry`       | `degraded` |
| `ctx.exit()`                       | `refuse`      | `error`    |
| `ctx.timeout()` or the deadline    | `timeout`     | `error`    |
| Anything else thrown               | `failed`      | `error`    |
| Refused before dispatch            | `refused`     | `error`    |
| Delivered on the dead-letter queue | `dead_letter` | `error`    |

`JobContext.logger` becomes `JobContext.log`, a `Log`, and `JobContextInit.logger` becomes `init.log` so a test hands a handler one it can read back. The lifecycle's `job.started` / `job.completed` / `job.retrying` events become `job.ending` and `outcome` — one field each — and `refuse()` and `recordDeadLetter()` open the same kind of `job` log as a run does, so "every job that did not end well today" is one query over `kind: "job"` and `outcome`.

The batch log gets the counters: `jobs.done`, `jobs.retried`, `jobs.refused`, `jobs.failed`, `jobs.timed_out`, `jobs.dead_lettered`, incremented by each child as it ends, and its outcome degrades when any child's does. Neither requires a job handler to change: the lifecycle owns all of it.

A dispatcher built without a `logger` opens bare logs, which is how a dispatcher under test runs unchanged. A handler called directly in a test, with no dispatcher at all, reads the `Log` its test handed it through `init.log`.

### 10. MCP: The Same Request Log, Enriched

The MCP route is an ordinary route, so `log()` has already opened the request log by the time `createHandler().fetch(ctx)` runs. The handler adds what only it knows:

| Method                  | Fields                                              |
| ----------------------- | --------------------------------------------------- |
| Every method            | `mcp.method`, `mcp.protocol_version`                |
| `tools/call`            | `mcp.tool`, and `mcp.is_error` on the result        |
| `resources/read`        | `mcp.resource` (the matched pattern), never the URI |
| An unexpected exception | `fail(error)`, in addition to `onError`             |

`mcp.resource` records the pattern rather than the URI for the same reason `route` records the pattern: the URI carries the slug. The package writes through `currentLog()` rather than a context key so the same enrichment reaches a bare-Worker host, and `onError` stays for an app that reports elsewhere.

### 11. Tail Sampling, Off By Default

Workers Logs bills per event written, and both Cloudflare's invocation log and ours are events. Cloudflare's is written whether or not we log, so on the request path ours makes two events where there was one, and on the queue path — where Cloudflare logs once per batch and we log once per job — ours are nearly all of them. The paid plan includes 20 million events a month and charges $0.60 per million after that. Width costs nothing: a log with two hundred fields is one event, the same as one with three.

At that price the default is to keep everything. `emit()` consults a sampler, and the sampler's default keeps every log:

```typescript
export namespace Sample {
	export interface Options {
		/** Fraction of `ok` logs kept. Defaults to 1: everything. */
		rate?: number;
		/** Always keep logs slower than this. */
		slowerThanMs?: number;
		/** Always keep when this returns true — VIP accounts, flags under rollout, whole kinds. */
		keep?: (fields: Record<string, Log.Value>) => boolean;
	}
}
```

`error` and `degraded` outcomes are always kept, unconditionally; `rate` applies to `ok` logs only. That is what makes this a lever Cloudflare's head sampling is not: it can shed successful job runs — the bulk of the volume, and the least interesting logs — while keeping every failure. Sampling drops only the enrichment; Cloudflare's invocation log still records that the invocation happened, so a dropped log never costs the fact of the request, only its detail.

A worker turns it on when the account's volume approaches the included 20 million, starting with the kind that produces the volume. `keep` is how it is scoped: `keep: ({ kind }) => kind !== "job"` exempts everything but job logs from `rate`, so a worker samples its successful job runs at five percent and keeps every request.

### 12. One Record, One Console Call

`emit()` writes the record as the single argument of one console call — `console.log` for `ok`, `console.warn` for `degraded`, `console.error` for `error` — so Cloudflare indexes every field and its level filter agrees with `outcome`. The `sink` option replaces the console for tests.

### 13. Naming

One convention, dotted lowercase: `namespace.metric` for fields (`db.duration_ms`, `trial.leads`), `namespace.thing_happened` for notes (`session.read`, `webhook.polar.received`). Units are suffixes: `_ms`, `_s`, `_bytes`. Shared namespaces — `user`, `team`, `tenant`, `db`, `fetch`, `cache`, `error`, `http`, `job`, `mcp` — mean the same thing in every worker, which is what makes a cross-service query possible at all.

### 14. Nothing Survives For The Out-Of-Band Case

The immediate `logger` singleton is deleted. Inside an invocation, `currentLog()` reaches the log from anywhere, which covers every present caller of the singleton — the uptime cost ledger flushes inside the invocation it accounts for. The remaining case, code with no invocation behind it, constructs a `Log` and emits it; module scope does no work in a Worker in any case.

### API Surface

| Export           | From                      | Kind        | Note                                                                                         |
| ---------------- | ------------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `createLogger()` | `@sdxc/logger`            | Function    | The worker's configuration: `service`, `environment`, `version`, `sample`, `sink`            |
| `Logger`         | `@sdxc/logger`            | Interface   | Accepted by `log()` and `createJobDispatcher()`; `open(kind, fields)` for any other host     |
| `Log`            | `@sdxc/logger`            | Class       | The wide event: `set`, `inc`, `time`, `note`, `warn`, `fail`, `child`, `run`, `emit`         |
| `currentLog()`   | `@sdxc/logger`            | Function    | The log bound to the running invocation, or `undefined`                                      |
| `log(logger?)`   | `@sdxc/logger/middleware` | Function    | Router middleware publishing `ctx.log`; opens a log when none is current, joins it otherwise |
| `CurrentLog`     | `@sdxc/logger/middleware` | Context key | `ctx.get(CurrentLog)` for code generic over the request context                              |

`RequestLogger`, `BatchedLogger`, the `logger` singleton, and the `/request` and `/batched` entry points are removed.

## Consequences

### Positive

- **Configured once, where everything else is** - `service`, `environment`, `version`, and the sampler are stated in one file per worker and handed to the router's middleware array and the dispatcher's options, the same two places every other provider in the stack is configured.
- **Every entry point is covered** - `fetch`, `scheduled`, `queue`, each job inside a batch, the MCP route, and a Durable Object's `fetch` and `alarm` all produce the same record, from two attachment points and one primitive.
- **Queries replace reading** - every field an investigation starts from is indexed and scalar, so "slow requests on the pro plan in the last hour" or "every retried job for this team today" is a filter rather than a scroll.
- **The index stops growing with the app** - adding a route, a middleware, or a job no longer adds field paths.
- **Packages stop constructing loggers** - the router middleware, both engine packages, and the three sites in the jobs dispatcher lose their constructors; enrichment reaches the current log from wherever it is.
- **Half the package is deleted** - header allowlists, `cf` extraction, request/response modelling, and two of the three classes go away with nothing lost.
- **Width is free** - Workers Logs bills per event, not per byte, so the wide event is the shape the pricing rewards: two hundred fields cost what three do, and a `note()` rides along where a `console.log` would have been an event of its own.
- **Failure is comparable** - a fixed error shape makes "which provider error codes spiked" answerable.

### Negative

- **Roughly 490 call sites move** - `apps/r3-auth` (160), `apps/uptime` (132), `apps/auth-saas` (70), `packages/oidc-provider` (63), and the rest. The change is shallow and mostly mechanical, but it is not small.
- **Ambient state** - `currentLog()` is `AsyncLocalStorage`, so a log reached that way is implicit in the call signature. The mitigation is that `ctx.log` on both request and job contexts stays explicit, and every ambient call site is a `?.` no-op outside an invocation.
- **The scoped API is gone** - `ctx.logger.middleware("auth")` has no replacement, by intent. Its callers pass a namespaced note name instead.
- **Sampling, once enabled, loses detail** - a successful job outside the sample keeps only what Cloudflare's batch-level invocation log says about its batch. It is off by default, and scoped to one kind when it is on, for that reason.
- **`route` is inferred** - param substitution is a heuristic, and a param whose value also appears literally elsewhere in the path will over-substitute.
- **A queue batch emits N+1 logs** - one per job plus the batch, where today it emits N. The batch log is what makes the batch view a query instead of a sum over its children.
- **A request that never reaches a router is unlogged by us** - an asset served from the worker, or a request forwarded to a Durable Object stub, has only Cloudflare's invocation log at the worker level. The Durable Object emits its own request log, and a worker that wants one for the forwarding step opens it with `logger.open()`.

### Neutral

- **ADR-004 is superseded** - its scoped, lifecycle-shaped design was correct for React Router, which no app runs any more.
- **ADR-044's lifecycle keeps its behavior** - what a job's ending does to its message, its monitor ping, and its dead-letter handling is unchanged; only what it writes about itself changes shape.
- **`apps/books` traces stay** - it has `traces` enabled at 10% head sampling. `time()` overlaps with spans but is cheaper and lands in the log already being queried; both can coexist.
- **No new dependency** - the package stays dependency-free beyond `remix`, which every consumer already has, and `node:async_hooks`, which every logging worker already enables.

## Implementation Plan

### Phase 1: The Package

1. Write the executable spec first: `Log` flattening and scalar rejection, counter accumulation, `time()` on the throwing path, outcome precedence across `warn`/`fail`, `child()` counting into its parent, `run()` binding `currentLog()` and emitting once, the notes cap, sampler keep rules, and the three console levels.
2. Create `packages/logger/src/log.ts`, `sample.ts`, `current.ts` (the `AsyncLocalStorage`), and `logger.ts` (`createLogger`, `open`).
3. Rewrite `middleware.ts` as `log(logger?)` with open-or-join, route inference, and the `ctx.log` augmentation.
4. Delete `batched-logger.ts`, `request-logger.ts`, `types.ts`, and the immediate `Logger`; reduce `package.json` exports to `.` and `./middleware`.
5. Rewrite the README against the new API, per [ADR-017](./ADR-017-readme-package-description-source-of-truth.md).

### Phase 2: The Packages That Log

1. `@sdxc/jobs`: the `logger` option, the `cron` log in `scheduled()`, the `queue` log in `queue()`, `ctx.log`, the per-run `job` child with `job.ending`, `refuse()` and `recordDeadLetter()` as `job` logs, and the batch counters. Its README's `ctx.logger` examples follow.
2. `@sdxc/mcp`: `mcp.method`, `mcp.protocol_version`, `mcp.tool`, `mcp.is_error`, `mcp.resource`, and `fail()` on an unexpected exception.
3. `@sdxc/oidc-provider` and `@sdxc/blog-engine`: `log()` in their middleware stacks, the per-request `Logger` and the `requestLogger` / `deps.logger` parameters deleted, `ctx.logger` call sites moved.

### Phase 3: The Apps

1. Each worker gains `bootstrap/logger.ts`; `log(logger)` replaces `logger` in its router's middleware stack, in the position it has today, and `logger` joins its dispatcher's options. `apps/blog-saas` and `apps/auth-saas` wrap their tenant Durable Object's `fetch` and `alarm` with `logger.open().run()`.
2. Call sites move, largest first: `r3-auth`, `uptime`, `auth-saas`, `books`, `blog-saas`, `pkmn`, `blog`. Each is independent once Phase 2 lands, so they parallelize.
3. The shared namespaces land in each app's own middleware — `user.*` where the session is read, `team.*` where the tenant is resolved — so most handlers stop setting context at all. `apps/uptime`'s `costLedger()` writes its totals to `ctx.log` as fields.
4. Sampling stays off. It is enabled per worker, `job` kind first, when the account's monthly log volume approaches the included 20 million.

## Alternatives Considered

### 1. Keep `RequestLogger` And Add Fields

Leave the scopes in place and add counters and business fields alongside them.

**Rejected because**: the scopes are the problem, not a neutral container. As long as events nest under route-keyed objects, the new fields inherit the same unqueryability, and the request/response duplication keeps consuming the log budget.

### 2. Use Remix's `logger-middleware`

`remix/middleware/logger` ships with the framework, and the house preference is to use what Remix provides before writing our own.

**Rejected because**: it is an access logger. It formats a string from tokens — `%method %path %status %duration` — in Apache combined-log style, with colorized TTY output. That is the exact practice being moved away from, and on Workers it produces a message Cloudflare must text-match rather than fields it can index. The preference for built-ins does not extend to a built-in that solves a different problem.

### 3. Pass The Log Explicitly Everywhere

No `AsyncLocalStorage`: the middleware hands the log to its handlers, the handlers to their services, the dispatcher to the lifecycle and on to the job.

**Rejected because**: a service written against `ctx.database` would grow a `log` parameter it never reads, purely so the thing it calls can enrich the record, and both engine packages and the MCP handler would need the same threading through signatures that exist for other reasons. The repository already reaches the request logger ambiently — `getContext().logger` through Remix's own `asyncContext()` — so the explicit form is not what the code does today either. What the ambient log buys is that a package can enrich the record without the app changing a signature to let it.

### 4. A Module-Level Default Logger

Have `createLogger()` register itself so a bare `log()` or a `Log` opened with no parent inherits its configuration without being handed it.

**Rejected because**: it is global registration, which ADR-044 removed from jobs for the reason that applies here — a process that logs into a configuration nobody wired up. Handing the logger to `log()` and to `createJobDispatcher()` makes those two calls the only places configuration can come from, and a log emitted with no `service` is the visible sign that a host was not wired.

### 5. A Wrapper Around The Exported Handler

`logger.handler({ fetch, scheduled, queue })` in `bootstrap/worker.ts`, opening a log per entry point before the router or the dispatcher runs, with the router middleware joining it.

**Rejected because**: it is a third place to configure, and the one that knows least — no route, no job — so the middleware and the dispatcher still have to write the fields that matter, through a join protocol the wrapper forces on them. What it alone would cover is a request that never reaches a router, which Cloudflare's invocation log already records. Attaching at the router and the dispatcher instead puts the configuration where every other provider's already is, and `logger.open()` remains for the host that has neither.

### 6. One Log Per Queue Batch

Record every job in the batch as fields or notes on the batch log rather than as logs of their own.

**Rejected because**: a job is the unit that has a name, an attempt count, and an ending, and eighty of them cannot be eighty sets of scalar fields on one record without putting the job name in key position — the failure this ADR exists to remove. The batch log keeps the counts, which is the question a batch-level query asks.

### 7. OpenTelemetry Spans Instead Of A Log

Instrument with OTel and let traces carry everything.

**Rejected because**: it answers a different question well. Traces show where time went in one request; wide events show what a million requests had in common. `apps/books` already has Cloudflare traces enabled and can keep them — the log is not a competitor to a span, and adopting OTel as the whole strategy is the anti-pattern the source material names directly.

### 8. Nested Objects Rather Than Dotted Keys

Emit `{ user: { id, plan } }` and rely on Cloudflare to index nested paths.

**Rejected because**: Cloudflare indexes both, but a nested value can be reshaped by a later merge and reads ambiguously in a query bar. A literal `user.id` key is one string, in one place, with one meaning. `set()` still accepts the nested form for writing.

## References

- [Logging Sucks — wide events and canonical log lines](https://loggingsucks.com)
- [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Cloudflare version metadata binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/)
- [Cloudflare Node.js compatibility: `AsyncLocalStorage`](https://developers.cloudflare.com/workers/runtime-apis/nodejs/asynclocalstorage/)
- [ADR-004: RequestLogger for React Router](./ADR-004-request-logger.md), superseded by this decision
- [ADR-017: README package description source of truth](./ADR-017-readme-package-description-source-of-truth.md)
- [ADR-036: Model Context Protocol Server Package](./ADR-036-model-context-protocol-server-package.md)
- [ADR-044: Function-Defined Jobs With Declarative Schedules](./ADR-044-function-defined-jobs-with-declarative-schedules.md)

## Current Progress

Nothing implemented. The package is as ADR-004 left it; ADR-044 landed `@sdxc/jobs` with `ctx.logger` as a `BatchedLogger` and its own loggers for refused and dead-lettered messages, which are the integration points Phase 2 replaces.

## Notes

- `environment` and `version` cannot be read from inside the package. `version` comes from the `version_metadata` binding, which no worker declares yet; the option is there for when one does. `environment` is whatever the bootstrap decides — a var, or the hostname test the workers already run for cookie security.
- A `request` log opens when the middleware runs and is emitted when the handler returns the `Response`, so `duration_ms` excludes anything the worker does before the router and, for a streamed HTML body, the time the body takes to finish. It is the time to headers, which is the number the sampler should be keyed to anyway; Cloudflare's invocation log has the wall time.
- Correlating a request with the job it enqueued relies on shared fields — `team.id`, `user.id` — rather than a propagated trace id. A trace id in the message body would need a reserved key in a wire format that reserves only `type`, and no query the apps run today needs it; it is deferred, not rejected.
- The cost of logging everything is bounded by the pricing model: per event, 20 million included a month, $0.60 per million after. The uptime app's own cost model ([ADR-001](./uptime/ADR-001-analytics-engine-migration.md)) projects 44.9 million pings a month at a hundred users; every ping is a job, so that is roughly 45 million job logs, 25 million over the allotment, about $15 a month against the revenue that model attaches to it. Today's volume is far below the model. When it is not, the queue worker's successful job runs are where the events are, and the only place sampling is worth turning on.
