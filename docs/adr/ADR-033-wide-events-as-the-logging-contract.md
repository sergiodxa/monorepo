# ADR-033: Wide Events As The Logging Contract

## Status

**Proposed** - 2026-08-12

## Background

[ADR-004](./ADR-004-request-logger.md) introduced `RequestLogger`, a request-scoped logger that grouped events by React Router lifecycle phase — middleware, loaders, actions, render — and flushed them as one console entry carrying request, response, and Cloudflare metadata.

Two things have changed since. No app depends on `react-router` any more; all eight are on Remix v3 and its `fetch-router`, so the phases the logger organizes around no longer exist. And every worker now runs with `"observability": { "enabled": true }`, which means Cloudflare emits its own per-invocation log containing most of what `RequestLogger` was written to capture by hand.

## Context

### Current State

`@pkg/logger` exports three classes, all named `Logger`, distinguished by when they write:

| Export          | Writes                                        |
| --------------- | --------------------------------------------- |
| `logger`        | One console call per log, immediately         |
| `BatchedLogger` | One console call per unit of work, on `flush` |
| `RequestLogger` | One console call per request, on `flush`      |

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

Roughly 430 call sites across the apps and packages write into it.

### What Cloudflare Already Logs

With observability enabled, each invocation produces a log tagged `$cloudflare.$metadata.type = "cf-worker-event"` holding the Request, the Response, timing, and the colo/geo/network context — and every `console` call made during that invocation is correlated to it. Logs are JSON-indexed with unlimited field cardinality, capped at 256 KB per log.

So the request URL, method, headers, status, response headers, and the whole `cf` block are recorded twice: once by Cloudflare, once by us, inside a budget we would rather spend on things Cloudflare cannot know.

### Issues Identified

1. **Half the package restates Cloudflare.** `filterRequestHeaders`, `filterResponseHeaders`, `extractCfInfo`, `RequestInfo`, `ResponseInfo`, and their two header allowlists exist to reproduce fields already present on the invocation log.

2. **High-cardinality data sits in key position.** `loaders` and `middleware` are objects keyed by route ID and middleware name, so every route introduces a new field path in the index and its events land inside arrays of objects. "All requests where `tenants.loaded` reported a count above 100" is not expressible; the data is reachable only by reading one log at a time.

3. **The scope taxonomy is dead.** `middleware()` is called seven times across the monorepo; `loader()`, `action()`, and `render` are effectively unused. Everything else calls the unscoped `info`/`error`, which lands in a flat `events` array — the shape ADR-004 set out to replace.

4. **There is no measurable content.** No query counts, no outbound call counts or durations, no cache hit/miss, no feature flags, no outcome field. The entry records what the code did, not what happened to the request, so it answers "what was logged" and not "which requests were slow, and what did they have in common".

5. **`timestamp` means two different things.** `BatchedLogger` and `RequestLogger` set it from `performance.now()` — milliseconds since isolate start — while the immediate `Logger` sets it from `Date.now()`. One field name, two units, in one package.

6. **Context is write-only and wholesale.** `subject`, `profile`, and `billing` are setters that replace their value, so a second middleware cannot add to what a first one learned.

7. **Errors have no shape.** The middleware flattens a thrown error to `{ error: message, stack }`: no type, no code, no retriability, no provider code. There are only two levels, `info` and `error`, so a recoverable problem must pick between being invisible and being an alarm.

8. **`console.info(identifier, output)`** puts the most useful filter — method, URL, status — into a message string rather than an indexed field.

9. **Event names use two conventions.** `token_issued`, `rate_limit_exceeded`, and `admin_client_not_found` alongside `job.check_http.duplicate`, `webhook.polar.subscription`, and `trial_conversion.completed`.

10. **Everything is kept.** No sampling, so the cost of a wider event is paid on every request including the ones nobody will ever read.

## Decision

Replace the three loggers with one concept: a **wide event**, built up over an invocation and emitted once. An invocation is a request, a queue message, a cron run, or a workflow step — the same shape for all of them, so one query spans a request and the job it enqueued.

The package keeps its name and gains a single primary export, `Event`. `RequestLogger`, `BatchedLogger`, and the `/request` and `/batched` entry points are removed.

### 1. One Event Per Invocation

```ts
export namespace Event {
	/** What kind of invocation produced this event. */
	export type Kind = "request" | "job" | "cron" | "workflow";

	/** How the invocation ended. Set by `warn` and `fail`, `ok` otherwise. */
	export type Outcome = "ok" | "degraded" | "error";

	/** Field values are scalars. Structure lives in the key, not the value. */
	export type Value = string | number | boolean | null;

	/** A breadcrumb. Read, not queried. */
	export interface Note {
		at: number;
		level: "info" | "warn" | "error";
		name: string;
		[key: string]: Value | undefined;
	}

	export interface Options {
		/** Worker name, the same across every event it emits. */
		service: string;
		kind: Kind;
		/** Version metadata id, when the `version_metadata` binding is configured. */
		version?: string;
		sample?: Sample.Options;
	}
}

export class Event {
	constructor(options: Event.Options);

	/** Merges fields. Repeatable; a nested object flattens to dotted keys. */
	set(fields: Record<string, Event.Value | Record<string, Event.Value>>): this;

	/** Adds to a counter, creating it at zero. */
	inc(field: string, by?: number): this;

	/** Runs `fn`, recording `${name}.count` and `${name}.duration_ms` either way. */
	time<T>(name: string, fn: () => Promise<T>): Promise<T>;

	/** Records a breadcrumb. */
	note(name: string, fields?: Record<string, Event.Value>): this;

	/** Records a breadcrumb and degrades the outcome. */
	warn(name: string, fields?: Record<string, Event.Value>): this;

	/** Records the error fields and sets the outcome to `error`. */
	fail(error: unknown, fields?: Record<string, Event.Value>): this;

	/** Emits once, or drops the event per the sampler. Idempotent. */
	emit(): void;
}
```

The emitted shape:

```jsonc
{
	"service": "uptime",
	"env": "production",
	"version": "5f2a…",
	"kind": "request",
	"route": "/app/:teamId/monitors",
	"outcome": "ok",
	"duration_ms": 84,
	"user.id": "usr_…",
	"user.plan": "pro",
	"team.id": "team_…",
	"team.seats": 4,
	"db.count": 6,
	"db.duration_ms": 31,
	"fetch.count": 1,
	"fetch.duration_ms": 40,
	"cache.hit": 2,
	"cache.miss": 1,
	"notes": [{ "at": 12, "level": "info", "name": "session.read" }],
}
```

Nothing about the request, the response, or the colo appears, because Cloudflare's invocation log has all of it and correlates it to this one.

### 2. Fields Are Flat And Scalar

`set()` accepts one level of nesting for ergonomics and flattens it — `{ user: { id } }` is stored as `user.id`. Values are scalars; arrays and deeper objects are rejected at the type level. This is the whole enforcement mechanism for issue 2: a route ID, a user ID, or a monitor ID can only ever be a value, so no call site can grow the index a field at a time.

`route` is the one field that must stay low-cardinality. `fetch-router`'s `RequestContext` exposes `params`, `url`, and `router` but not the pattern that matched, so the middleware reconstructs it by substituting each `ctx.params` value back out of the pathname — `/app/team_abc/monitors` with `{ teamId: "team_abc" }` becomes `/app/:teamId/monitors`. A handler can override it with `set({ route })` where that inference is wrong.

### 3. Counters And Timers Replace Manual Timing

`inc()` and `time()` exist so the performance section of the event is a by-product of doing the work rather than something each call site remembers to measure:

```ts
let monitors = await ctx.event.time("db", () => db.query.monitors.findMany());
```

records `db.count: 1` and `db.duration_ms: 31`, accumulating across calls with the same name, and records them on the throwing path too before rethrowing.

### 4. Notes Are The Narrative, Not The Query Surface

`notes` is the one array in the event and the only place a free-form message lives. It is documented as the thing you read once a query has found the event, never the thing you query. Anything worth filtering on is a field. This gives the ~430 existing `info`/`error` calls a mechanical destination while making the better destination obvious.

### 5. Failure Is A Field

`fail(error)` sets `outcome: "error"` and a fixed error shape:

```jsonc
{
	"error.type": "PolarError",
	"error.code": "rate_limited",
	"error.message": "Too many requests",
	"error.retriable": true,
}
```

`error.code` and `error.retriable` are read off the error when it carries them, so `@pkg/result` failures and provider errors keep their own codes. `error.stack` is attached only when the event survives sampling. `warn()` covers the middle that today has no home: recorded, outcome degraded, no alarm.

### 6. Tail Sampling

`emit()` consults a sampler before writing:

```ts
export namespace Sample {
	export interface Options {
		/** Fraction of ordinary events kept. Default 1 in development, 0.05 in production. */
		rate?: number;
		/** Always keep events slower than this. */
		slowerThanMs?: number;
		/** Always keep when this returns true — VIP accounts, flags under rollout. */
		keep?: (fields: Record<string, Event.Value>) => boolean;
	}
}
```

Errors and degraded outcomes are always kept, unconditionally. Sampling drops only the enrichment: Cloudflare's invocation log still records that the request happened, its path, and its status, so a dropped event never costs the fact of the request — only its detail.

### 7. The Middleware

```ts
declare module "remix/router" {
	interface RequestContext {
		event: Event;
	}
}

export function events(options: Event.Options): Middleware;
```

It creates the event, infers `route`, records `duration_ms` and `http.status`, calls `fail()` on a thrown error, and emits in a `finally`. It takes options because `service` and the sampler are per-worker; the current middleware is a bare constant with nothing to configure.

### 8. Jobs, Cron And Queues Use The Same Event

`@pkg/jobs` builds `job.started` / `job.completed` / `job.retrying` / `job.failed` by hand around a `BatchedLogger`. Those become an `Event` with `kind: "job"`, `job` as a field, and `attempt`, `outcome`, and `duration_ms` alongside — which makes "every failed job for this team today" one query over the same fields a request uses.

### 9. Naming

One convention, dotted lowercase: `namespace.metric` for fields (`db.duration_ms`, `trial.leads`), `namespace.thing_happened` for notes (`session.read`, `webhook.polar.received`). Units are suffixes: `_ms`, `_bytes`, `_count`. Shared namespaces — `user`, `team`, `db`, `fetch`, `cache`, `error`, `http` — mean the same thing in every worker, which is what makes a cross-service query possible at all.

### 10. The Isolate Logger Survives, Smaller

`logger` stays as the export for the genuinely out-of-band case: an error in isolate scope with no invocation to attach to. It gains nothing and loses its `timestamp` ambiguity by using `Date.now()` consistently.

## Consequences

### Positive

- **Queries replace reading** - every field an investigation starts from is indexed and scalar, so "slow requests on the pro plan in the last hour" is a filter rather than a scroll.
- **The index stops growing with the app** - adding a route or a middleware no longer adds field paths.
- **One shape for requests and jobs** - a request and the job it enqueues carry the same `user.id` and `team.id` fields, so one query follows the work across both.
- **Half the package is deleted** - header allowlists, `cf` extraction, request/response modelling, and two of the three classes go away with nothing lost.
- **Wider events cost less** - sampling pays for the fields that were previously too expensive to consider.
- **Failure is comparable** - a fixed error shape makes "which provider error codes spiked" answerable.

### Negative

- **Roughly 430 call sites move** - `apps/r3-auth` (144), `apps/uptime` (122), `apps/auth-saas` (67), `packages/oidc-provider` (59), and the rest. The change is shallow and mostly mechanical, but it is not small.
- **The scoped API is gone** - `ctx.logger.middleware("auth")` has no replacement, by intent. Its callers pass a namespaced note name instead.
- **Sampling loses detail** - a fast successful request outside the sample keeps only its Cloudflare invocation log. The sampler's defaults are the thing to get wrong here.
- **`route` is inferred** - param substitution is a heuristic, and a param whose value also appears literally elsewhere in the path will over-substitute.

### Neutral

- **ADR-004 is superseded** - its scoped, lifecycle-shaped design was correct for React Router, which no app runs any more.
- **`apps/books` traces stay** - it has `traces` enabled at 10% head sampling. `time()` overlaps with spans but is cheaper and lands in the event already being queried; both can coexist.
- **No new dependency** - the package stays dependency-free, with `remix` a devDependency for the middleware's `import type`.

## Implementation Plan

### Phase 1: The Event

1. Create `packages/logger/src/event.ts` with `Event`, field flattening, counters, `time()`, notes, `fail()`, and `emit()`.
2. Create `packages/logger/src/sample.ts` with the tail sampler.
3. Write the spec first, per the house rule: `packages/logger/src/event.spec` covering flattening, counter accumulation, timer behaviour on the throwing path, outcome precedence, and sampler keep rules.
4. Trim `logger.ts` to the isolate case and delete `batched-logger.ts`, `request-logger.ts`, and `types.ts`.

### Phase 2: The Middleware

1. Rewrite `middleware.ts` as `events(options)`, with route inference and `finally` emit.
2. Update `package.json` exports to `.` and `./middleware` only.
3. Rewrite the README against the new API, per [ADR-017](./ADR-017-readme-package-description-source-of-truth.md).

### Phase 3: Adoption

1. `packages/jobs` first — it is the smallest consumer and settles the `kind: "job"` field names the apps will copy.
2. `packages/oidc-provider` and `packages/blog-engine`, since apps depend on their shape.
3. The apps, largest first: `r3-auth`, `uptime`, `auth-saas`, `books`, `blog`, `pkmn`. Each is independent once the packages land, so they parallelize.
4. Add the shared namespaces to each app's own middleware — `user.*` where the session is read, `team.*` where the tenant is resolved — so most handlers stop setting context at all.

## Alternatives Considered

### 1. Keep `RequestLogger` And Add Fields

Leave the scopes in place and add counters and business fields alongside them.

**Rejected because**: the scopes are the problem, not a neutral container. As long as events nest under route-keyed objects, the new fields inherit the same unqueryability, and the request/response duplication keeps consuming the log budget.

### 2. Use Remix's `logger-middleware`

`remix/middleware/logger` ships with the framework, and the house preference is to use what Remix provides before writing our own.

**Rejected because**: it is an access logger. It formats a string from tokens — `%method %path %status %duration` — in Apache combined-log style, with colorized TTY output. That is the exact practice being moved away from, and on Workers it produces a message Cloudflare must text-match rather than fields it can index. The preference for built-ins does not extend to a built-in that solves a different problem.

### 3. OpenTelemetry Spans Instead Of An Event

Instrument with OTel and let traces carry everything.

**Rejected because**: it answers a different question well. Traces show where time went in one request; wide events show what a million requests had in common. `apps/books` already has Cloudflare traces enabled and can keep them — the event is not a competitor to a span, and adopting OTel as the whole strategy is the anti-pattern the source material names directly.

### 4. Nested Objects Rather Than Dotted Keys

Emit `{ user: { id, plan } }` and rely on Cloudflare to index nested paths.

**Rejected because**: Cloudflare indexes both, but a nested value can be reshaped by a later merge and reads ambiguously in a query bar. A literal `user.id` key is one string, in one place, with one meaning. `set()` still accepts the nested form for writing.

### 5. Keep `BatchedLogger` For Jobs

Let requests get wide events and leave jobs on the batched logger.

**Rejected because**: the split is what prevents a query from following work across the boundary. A job enqueued by a request should carry the same `team.id` field, or the correlation has to be done by hand every time.

## References

- [Logging Sucks — wide events and canonical log lines](https://loggingsucks.com)
- [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Cloudflare version metadata binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/)
- [ADR-004: RequestLogger for React Router](./ADR-004-request-logger.md), superseded by this decision
- [ADR-017: README package description source of truth](./ADR-017-readme-package-description-source-of-truth.md)

## Current Progress

Nothing implemented. The package is as ADR-004 left it.

## Notes

- The 256 KB per-log cap is generous for a flat scalar event but not for `notes`. `emit()` should cap the array and record how many were dropped rather than letting Cloudflare truncate the log and lose the fields at the end.
- `env` and `version` cannot be read from inside the package — `version_metadata` is a binding. They are passed through `Event.Options` by each worker's bootstrap.
- Sampling is worth landing last, after the fields are in place. Turning it on before there is anything worth keeping only makes the current logs sparser.
