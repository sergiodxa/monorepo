# ADR-081: Trace Context Package

## Status

**Accepted** - 2026-09-24

## Background

[W3C Trace Context](https://www.w3.org/TR/trace-context/) defines two HTTP headers that let
every hop of a distributed request agree on which request it is part of. `traceparent`
carries a 16-byte trace id shared by the whole request, the 8-byte id of the span that sent
the call, and a flags byte whose low bit says whether the caller is recording. `tracestate`
carries up to 32 vendor-owned `key=value` entries beside it. Level 2 adds a second flag bit
declaring that the trace id was generated randomly. OpenTelemetry, Cloudflare, every major
APM vendor and most cloud load balancers read and write these two headers, so a service that
honors them joins any trace a caller starts.

The repo records one wide event per invocation (ADR-033): a request, a cron tick, a queue
batch, each job. Those records have no field that links them. A request that enqueues a job
that calls another worker produces three records whose only connection is a timestamp and a
guess, and a call into a Durable Object or an outbound API leaves nothing in the caller's
record that the callee's record could be joined on. Nothing in `apps/` or `packages/` reads
or writes `traceparent` today.

## Context

### Current state

A search for `traceparent`, `tracestate`, `trace_id`, `traceId`, `span_id` and `cf-ray`
across `apps/` and `packages/` finds nothing. The pieces a trace would travel through:

| Location                                       | Role                                                                              | Trace-relevant fact                                                                         |
| ---------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/logger/src/middleware.ts` (117)      | `log(logger)` joins the current log or opens a `request` log, publishes `ctx.log` | the invocation's record, the natural place for `trace_id`                                   |
| `packages/logger/src/current.ts` (37)          | `currentLog()` over an `AsyncLocalStorage`                                        | the pattern `currentTrace()` copies                                                         |
| `packages/logger/src/log.ts` (328)             | `Log` flattens one level of nesting to dotted keys; `child()` for jobs            | fields are scalars, so a trace is four fields, never an object                              |
| `packages/jobs/src/jobs.ts` (185)              | `envelope()` writes `{ job, body }`; `readMessageBody()` ignores other members    | an extra envelope member reaches a consumer from the previous deploy harmlessly             |
| `packages/jobs/src/dispatcher.ts` (483)        | `enqueue`, `enqueueMany`, `tick`, `deliverBatch`                                  | enqueue runs inside the caller's invocation, so `currentTrace()` is readable there          |
| `packages/jobs/src/lifecycle.ts` (396)         | `runJob()` opens the job's log and runs the chain inside `log.run()`              | the one place a delivered trace is continued and bound                                      |
| `packages/api-client/src/api-client.ts` (122)  | `APIClient.fetch()` runs `before()`, global `fetch`, then `after()`               | every subclass funnels through one method; the class comment already names tracing as a use |
| `apps/blog-saas/bootstrap/worker.ts`           | `env.BLOG.getByName(id).fetch(request)` forwards the incoming request             | the DO receives the caller's caller's `traceparent`, not the forwarding span's              |
| `apps/reader/database/*-do.ts`, `registry.ts`  | `env.FEED.getByName(id).subscribe(subject)` — Workers RPC                         | an RPC call carries no headers; a trace crosses only as an argument                         |
| `apps/auth-saas/app/http/middleware/tenant.ts` | `env.TENANT.getByName(id)` published as `ctx.tenantStub`, called over RPC         | same as the reader: `ctx.tenantStub.resumeAuthorization(...)` carries no headers            |

`APIClient` subclasses today: `packages/billing` (Polar, Stripe, Mercado Pago),
`packages/hostname`, and `apps/sdxc/app/services/sponsors.ts`. Workers that mount
`log(logger)`: reader, r3-auth, sdxc, books, blog, blog-saas, auth-saas (three routers) and
uptime.

### What Remix provides

`remix/headers` (`@remix-run/headers` 0.21.1) gives `SuperHeaders` plain string accessors
named `traceparent` and `tracestate`. They read and write the raw value; nothing validates
the grammar, exposes the ids or flags, or orders the state entries. No Remix middleware
starts, continues or propagates a trace, and `remix/logger-middleware` writes an access log
line with no trace fields. The stringified values this package produces can be assigned to
those accessors by an app that already uses `SuperHeaders`.

### What the specification asks of an implementation

| Rule                                                                                      | Consequence for the package                                                                   |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `traceparent` is `version-traceid-parentid-flags`, lowercase hex, 2-32-16-2 digits        | its own grammar, parsed by hand; RFC 9651 structured fields (ADR-079) do not apply            |
| Version `ff` is invalid; an all-zero trace id or parent id is invalid                     | `parse` fails on each, with a code naming which                                               |
| A version above `00` is parsed by the `00` rules, and may carry more after a `-`          | forward-compatible parsing; `stringify` always writes `00`                                    |
| Flags: bit 0 `sampled` (Level 1), bit 1 `random-trace-id` (Level 2); others unused        | both exposed as booleans, unknown bits kept on read and zeroed on write                       |
| A missing or invalid `traceparent` starts a new trace, and `tracestate` is then discarded | `extract()` never fails; it continues or restarts, and only parses state after a valid parent |
| `tracestate`: comma-separated list-members, OWS around each, at most 32                   | a list parser, not a structured-field dictionary; more than 32 or a duplicate key is invalid  |
| Keys: `lcalpha` then up to 255 of `a-z0-9_-*/`, or `tenant@system` (241 + 14)             | key validation in `set()` and `parse()`, returning `Result`                                   |
| Values: up to 256 printable ASCII chars excluding `,` and `=`, no trailing space          | value validation in the same places                                                           |
| A vendor updating its entry moves it to the left; new entries go on the left              | `TraceState.set()` returns a new state with that key first                                    |
| Propagators may truncate to 512 chars, dropping entries over 128 chars first              | `stringify(state, { maxLength })` applies that order                                          |
| Multiple `tracestate` header fields combine as one comma-separated list                   | the value `Headers.get()` returns (already joined) is parsed as it comes                      |
| The parent id a callee receives is the id of the caller's span                            | every outbound call carries the current invocation's span id, never the id it arrived with    |
| Trace ids should be random; Level 2 flags that they are                                   | ids come from `crypto.getRandomValues`, and started traces set the `random` flag              |

### One span per invocation

The wide event already is the span: it opens when the invocation starts, closes when it
settles, and records its duration and outcome. So a trace here has exactly one span per
record. The span id is minted when the log's invocation starts, the parent id is whatever
the caller sent, and every outbound call during the invocation names the invocation's span
as its parent. Sub-spans for individual `fetch` calls are not recorded, because nothing would
store them; `log.time("stripe", ...)` already records how long they took.

## Decision

Add `@sdxc/trace-context`: parse and stringify both headers, a `TraceContext` value bound to
the running invocation, router middleware that continues or starts a trace per request, and
propagation through `@sdxc/jobs` envelopes and `APIClient` requests. It depends on no
OpenTelemetry package.

### Package name

| Name                   | Trade-off                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `@sdxc/trace-context`  | the specification's own name, covering both headers and the in-process value                        |
| `@sdxc/tracing`        | promises span recording, exporters and sampling this package leaves to the logger and to vendors    |
| `@sdxc/traceparent`    | names one of the two headers, and none of the propagation                                           |
| part of `@sdxc/logger` | makes `@sdxc/api-client` depend on a logger to add a header, and ties the header format to one sink |

`@sdxc/trace-context` wins because it says precisely what is implemented: the W3C
recommendation of that name, and the context value it defines. A reader who knows the spec
knows the scope from the name.

### Scope

The package includes:

- parsing and stringifying `traceparent` and `tracestate`, Level 1 and the Level 2 flag
- `TraceContext`: the invocation's trace id, span id, parent span id, flags and state
- `currentTrace()` / `runWithTrace()` over `AsyncLocalStorage`
- `extract()` from incoming headers, `inject()` / `withTrace()` into outgoing ones
- `trace()` router middleware publishing `ctx.trace`, and stamping the invocation's log
- `traceFields()`, the log fields every wide event carries

What stays out, and where it lives:

- The span record, its duration and outcome live in `@sdxc/logger`'s wide event
- Envelope propagation and continuation per delivery live in `@sdxc/jobs`, which depends on
  this package
- Default injection on outbound API calls lives in `@sdxc/api-client`, which depends on this
  package
- Exporting to an OpenTelemetry collector lives in whatever sink a worker gives
  `createLogger()`; the field names already match what an OTLP log exporter maps
- Head sampling decisions live with the caller that set the flag; this package propagates it

### Exports

#### `@sdxc/trace-context/traceparent`

```ts
import type { Result } from "@sdxc/result";

export namespace TraceParent {
	/** The parsed header: ids as lowercase hex, flags as the raw byte and as booleans. */
	export interface Value {
		version: number;
		traceId: string; // 32 hex digits, never all zero
		parentId: string; // 16 hex digits, never all zero
		flags: number;
		sampled: boolean; // bit 0
		random: boolean; // bit 1, Level 2
	}

	export type ErrorCode =
		| "malformed" // wrong shape or length, or uppercase hex
		| "invalid-version" // ff
		| "invalid-trace-id" // all zero
		| "invalid-parent-id"; // all zero
}

export class TraceParentParseError extends Error {
	override name = "TraceParentParseError";
	readonly code: TraceParent.ErrorCode;
}

/** Parses one `traceparent` value, accepting future versions by the version-00 rules. */
export function parse(value: string): Result<TraceParent.Value, TraceParentParseError>;

/** Writes version `00`, with only the flags this version defines. */
export function stringify(value: Omit<TraceParent.Value, "version" | "flags">): string;
```

#### `@sdxc/trace-context/tracestate`

```ts
import type { Result } from "@sdxc/result";

export namespace TraceState {
	export type ErrorCode =
		"malformed" | "invalid-key" | "invalid-value" | "duplicate-key" | "too-many";

	export interface StringifyOptions {
		/** @default 512 */
		maxLength?: number;
	}
}

export class TraceStateParseError extends Error {
	override name = "TraceStateParseError";
	readonly code: TraceState.ErrorCode;
}

/** An ordered, immutable list of vendor entries; the leftmost is the most recently updated. */
export class TraceState {
	static readonly EMPTY: TraceState;
	readonly size: number;
	get(key: string): string | undefined;
	/** A new state with `key` first, as a vendor updating its own entry must do. */
	set(key: string, value: string): Result<TraceState, TraceStateParseError>;
	delete(key: string): TraceState;
	entries(): IterableIterator<[key: string, value: string]>;
}

export function parse(value: string): Result<TraceState, TraceStateParseError>;

/** Writes the list, truncating to `maxLength` by dropping entries over 128 chars first. */
export function stringify(state: TraceState, options?: TraceState.StringifyOptions): string;
```

#### `@sdxc/trace-context`

```ts
import type { TraceParent } from "@sdxc/trace-context/traceparent";
import type { TraceState } from "@sdxc/trace-context/tracestate";

/** The trace the running invocation belongs to, and the span that invocation is. */
export interface TraceContext {
	traceId: string;
	/** This invocation's span, the parent id of every call it makes. */
	spanId: string;
	/** The caller's span, `null` for a trace this invocation started. */
	parentSpanId: string | null;
	sampled: boolean;
	random: boolean;
	state: TraceState;
}

export namespace TraceContext {
	export interface StartOptions {
		/** @default true */
		sampled?: boolean;
		state?: TraceState;
	}
	/** Which headers `inject` writes. */
	export type Propagation = "all" | "traceparent" | "none";
}

/** A new root trace with fresh random ids. */
export function startTrace(options?: TraceContext.StartOptions): TraceContext;

/** Continues a caller's trace: same trace id and flags, a new span id, the caller's as parent. */
export function continueTrace(parent: TraceParent.Value, state?: TraceState): TraceContext;

/**
 * Continues the trace `headers` carry, or starts one when `traceparent` is missing or
 * invalid, in which case `tracestate` is discarded unread. Never fails.
 */
export function extract(headers: Headers): TraceContext;

/**
 * Writes `traceparent` (this span as parent) and `tracestate` into `headers`, leaving a
 * header already present as it is. Outside an invocation with no `trace` it writes nothing.
 */
export function inject(
	headers: Headers,
	trace?: TraceContext | undefined, // defaults to currentTrace()
	propagation?: TraceContext.Propagation,
): void;

/** A copy of `request` carrying the current trace, for forwarding to a Durable Object stub. */
export function withTrace(request: Request, trace?: TraceContext): Request;

/** The `traceparent` value naming this span as parent, for carrying a trace across RPC. */
export function toTraceParent(trace: TraceContext): string;

export function currentTrace(): TraceContext | undefined;
export function runWithTrace<T>(trace: TraceContext, fn: () => T): T;

/** The fields every wide event carries, named as OpenTelemetry names them for logs. */
export function traceFields(trace: TraceContext): {
	trace_id: string;
	span_id: string;
	parent_span_id: string | undefined;
	trace_flags: string; // two hex digits
};
```

`traceFields` returns a plain object rather than calling the logger, so the root export has no
dependency beyond `@sdxc/result` and `@sdxc/crypto` (for `Hex` and `randomBytes`), which is
what lets `@sdxc/api-client` import it without pulling a logger or `remix`.

#### `@sdxc/trace-context/middleware`

```ts
import type { Middleware } from "remix/router";

declare module "remix/router" {
	interface RequestContext {
		/** The trace this request belongs to, continued from the caller or started here. */
		trace: TraceContext;
	}
}

export const CurrentTrace: { defaultValue?: TraceContext };

export namespace TraceMiddleware {
	export interface Options {
		/**
		 * Whether to continue the trace a request arrives with. A request this returns
		 * `false` for starts a new trace, and the dropped `traceparent` is noted on the log.
		 * @default () => true
		 */
		accept?: (request: Request) => boolean;
	}
}

/**
 * Continues or starts the request's trace, binds it for `currentTrace()`, publishes it as
 * `ctx.trace`, and sets `traceFields()` on the current log. When a trace is already
 * current (a host or a dispatcher bound one) it is joined, as `log()` joins a log.
 */
export function trace(
	options?: TraceMiddleware.Options,
): Middleware<{ key: typeof CurrentTrace; value: TraceContext; property: "trace" }>;
```

The middleware imports `currentLog` from `@sdxc/logger` and `remix` as an optional peer, the
same arrangement `@sdxc/logger/middleware` uses. It goes directly after `log(logger)`, so the
log it stamps is the request's.

### Propagation through jobs

`@sdxc/jobs` depends on `@sdxc/trace-context` and carries the trace in the envelope:

| Step                      | Behavior                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `enqueue`, `enqueueMany`  | `envelope()` writes `{ job, body, traceparent, tracestate }` from `currentTrace()`; outside an invocation both members are left out |
| `messageBody(job, input)` | the same, so an app sending through its own queue helper propagates too                                                             |
| `tick()`                  | the cron log starts a root trace; every message it enqueues carries it, so one tick's jobs share a trace id                         |
| `deliverBatch()`          | the `queue` log starts its own root trace, the batch being its own invocation                                                       |
| `runJob()`                | reads `traceparent` from the envelope, `continueTrace()`s it (or starts one), binds it around `log.run()`, and stamps the job log   |
| `JobContext`              | gains `readonly trace: TraceContext`, so a handler reads `ctx.trace` as a controller does                                           |

`readMessageBody()` already ignores members it does not know, so a consumer from the
previous deploy reads a traced envelope unchanged, and a traced consumer reads an untraced
one as a trace to start.

### Propagation through `APIClient`

The recommendation is option (a): `@sdxc/api-client` depends on the root export of
`@sdxc/trace-context`, and `APIClient.fetch()` injects the current trace into every request
by default.

```ts
export class APIClient {
	/**
	 * Which trace headers every request carries. A subclass talking to a service that should
	 * not learn the caller's upstream vendor state narrows it to `"traceparent"`.
	 */
	protected readonly propagateTrace: TraceContext.Propagation = "all";

	async fetch(path: string, init?: RequestInit): Promise<Response> {
		let request = new Request(new URL(path, this.baseURL), init);
		inject(request.headers, currentTrace(), this.propagateTrace);
		request = await this.before(request);
		return await this.after(request, await fetch(request));
	}
}
```

Injection runs before `before()`, so a subclass can still read, replace or delete the
headers, and a caller who set `traceparent` in `init` keeps it. The dependency points one
way: `@sdxc/api-client` imports `@sdxc/trace-context`, and `@sdxc/trace-context` knows
nothing of `APIClient`, so there is no cycle. The full graph is `logger` <- `trace-context`
<- `api-client`, `jobs`; `logger` imports neither.

Raw `fetch` calls stay raw. The uptime monitors and the reader's feed fetcher call arbitrary
third-party URLs, and those stay untraced unless a call site writes
`inject(init.headers)` on purpose.

### Durable Objects

- **`stub.fetch(request)`**: the caller forwards `withTrace(request)`, and the DO's router
  mounts `trace()`, which continues it. blog-saas has the one forwarding site.
- **Workers RPC** (`stub.subscribe(subject)`): there are no headers to carry it. A method that
  wants the caller's trace takes `traceparent: string` as its last argument and runs its body
  inside `runWithTrace(continueTrace(...))`. The reader's and auth-saas's DO methods adopt
  this when their logs need joining; this ADR does not change their signatures.

### Usage

```ts
// apps/uptime/bootstrap/app.tsx
import { log } from "@sdxc/logger/middleware";
import { trace } from "@sdxc/trace-context/middleware";

let globalMiddleware = [log(logger), trace() /* ... */];
```

```ts
// a controller: nothing to do for propagation; the IDs are on the log and the context
export default createAction(routes.api.monitors.create, async (ctx) => {
	await dispatcher.enqueue(jobs.checkHttp, { monitorId }); // envelope carries ctx.trace
	let customer = await ctx.billing.customers.get(id); // APIClient injects traceparent
	return json({ data, meta: { requestId: ctx.trace.traceId } });
});
```

```ts
// apps/blog-saas/bootstrap/worker.ts
import { withTrace } from "@sdxc/trace-context";

let response = await stub.fetch(withTrace(request));
```

A worker's emitted records then read, for one user action:

```text
{ "kind": "request", "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736", "span_id": "00f067aa0ba902b7", "trace_flags": "03" }
{ "kind": "job", "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736", "span_id": "b7ad6b7169203331", "parent_span_id": "00f067aa0ba902b7", "trace_flags": "03" }
```

## Consequences

### Positive

- **Records join on one field** - a request, the jobs it enqueued, the DO it called and the
  worker behind an API client share a `trace_id`, and `parent_span_id` orders them
- **Joins external traces** - a caller already tracing (a load balancer, an OpenTelemetry-
  instrumented client) sees its trace continue into these workers, and outbound calls to
  instrumented services continue out of them
- **Propagation is the default** - every `APIClient` subclass and every enqueued job carries
  the trace with no call-site change
- **OpenTelemetry-compatible without the SDK** - ids, flags and field names match what an
  OTLP log exporter or a collector expects, at no bundle cost
- **Spec-accurate parsing in one place** - version handling, all-zero ids, the 32-entry limit,
  key grammar and truncation order are tested once

### Negative

- **`@sdxc/api-client` gains its first dependency** - small, but the package was dependency-free,
  and every consumer now publishes with an exact pin on `@sdxc/trace-context`
- **Trace ids go to third parties by default** - Polar, Stripe and Mercado Pago receive a
  random `traceparent` and whatever `tracestate` arrived upstream until a subclass narrows
  `propagateTrace`; the ids identify nothing, but the upstream state is forwarded verbatim
- **A caller controls its own trace id** - a public client can send any valid `traceparent`
  and choose the `trace_id` its request is logged under; `accept` restricts that per worker
- **RPC needs a signature change** - Workers RPC has no header channel, so joining a DO's logs
  means adding a parameter to each method that should join
- **Four more fields on every record** - roughly 110 bytes per wide event

### Neutral

- **One span per invocation** - the model matches the wide event; per-call sub-spans would need
  a span store this repo does not run
- **The `sampled` flag is propagated, not acted on** - the logger's tail sampling still decides
  what is written; `Sample.keep` can read `trace_flags` if a worker wants to honor it
- **Envelope grows two optional members** - older consumers ignore them

## Implementation Plan

### Phase 1: Specify and build the package

**Priority:** High
**Estimated Effort:** 4 hours

1. Write the tests first from the specification's examples and test suite cases: each invalid
   `traceparent` form, a future version with trailing data, uppercase hex, the Level 2 flag,
   `tracestate` key grammar (both forms), 33 entries, duplicate keys, OWS, empty members,
   truncation order, `set()` moving an entry left
2. Implement `traceparent`, `tracestate`, then the root export and `./middleware`
3. Write the README, add the root README row

### Phase 2: Jobs

**Priority:** High
**Estimated Effort:** 2 hours

1. Extend `envelope()`, `messageBody()` and `JobMessage` with the two optional members
2. Start root traces in `tick()` and `deliverBatch()`; continue and bind in `runJob()`; add
   `JobContext.trace`
3. Add a regression test that an envelope written without trace members still dispatches

### Phase 3: API client

**Priority:** High
**Estimated Effort:** 1 hour

1. Add `propagateTrace` and the `inject` call to `APIClient.fetch()`, with tests that a subclass
   `before()` sees the header and that `init` headers win

### Phase 4: Adopt in the workers

**Priority:** Medium
**Estimated Effort:** 2 hours

| App                           | Change                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| uptime, reader, r3-auth, blog | `trace()` after `log(logger)` in `bootstrap/app.tsx`                                       |
| auth-saas                     | `trace()` in `bootstrap/app.ts`, `tenant-app.ts`, `management-app.ts`                      |
| blog-saas                     | `trace()` in `bootstrap/app.ts`; `stub.fetch(withTrace(request))` in `bootstrap/worker.ts` |
| sdxc, books                   | `trace()` after `log(logger)`                                                              |
| uptime                        | `meta.requestId` in `app/services/api-response.ts` becomes `ctx.trace.traceId`             |

uptime adopts first: it has the most jobs and the most outbound API calls, so it shows the
most joins.

### Phase 5: Publish

**Priority:** Low
**Estimated Effort:** 30 minutes

1. Remove `private: true`, add `description` and `LICENSE.md`
2. `bun run release:bootstrap @sdxc/trace-context`, then configure the trusted publisher;
   `@sdxc/api-client` and `@sdxc/jobs` republish with the new pin automatically

## Current Progress

- [x] Phase 1: `@sdxc/trace-context` with `./traceparent`, `./tracestate` and `./middleware`
- [x] Phase 2: Jobs
- [x] Phase 3: API client
- [ ] Phase 4: Adopt in the workers
  - [x] reader: `trace()` after `log(logger)`
- [ ] Phase 5: Publish

## Alternatives Considered

### 1. An opt-in mixin or helper for `APIClient`

A `Traced(APIClient)` mixin or a `traceHeaders()` call each subclass adds to its `before()`.

**Rejected because**: propagation that each client has to remember is propagation that is
missing from the one client somebody forgot, and the join fails silently. The opt-out
(`propagateTrace = "none"`) covers the rare client that should not carry it.

### 2. A `traceFetch` wrapper

A drop-in `fetch` that injects the current trace, used in place of the global.

**Rejected because**: it is a second fetch function every call site must choose, and the
repo's rule is to call the global `fetch`. `APIClient` covers structured API clients by
default, and `inject(headers)` covers the deliberate raw call.

### 3. `@sdxc/trace-context` exports an `APIClient` hook or subclass

Invert the dependency: the trace package imports `@sdxc/api-client` and ships `TracedAPIClient`.

**Rejected because**: it makes tracing opt-in again (alternative 1), and puts a class
hierarchy concern into a format package.

### 4. Put it in `@sdxc/logger`

**Rejected because**: `@sdxc/api-client` and `@sdxc/jobs` would depend on the logger to write
a header, and the header formats are useful to any consumer with no logger at all.

### 5. Adopt `@opentelemetry/api` and its W3C propagator

**Rejected because**: it brings a global context manager, a span API this repo would stub
out, and a context abstraction parallel to the one `@sdxc/logger` already binds. The two
headers are a small grammar; the value is in binding them to the existing wide event.

## References

- [W3C Trace Context (Level 1, Recommendation)](https://www.w3.org/TR/trace-context/)
- [W3C Trace Context Level 2](https://www.w3.org/TR/trace-context-2/)
- [OpenTelemetry: Trace Context in non-OTLP Log Formats](https://opentelemetry.io/docs/specs/otel/compatibility/logging_trace_context/)
- [ADR-033: Wide events as the logging contract](./ADR-033-wide-events-as-the-logging-contract.md)
- [ADR-054: Jobs package with queue adapters](./ADR-054-jobs-package-with-queue-adapters.md)
- [ADR-057: Request context instead of a service container](./ADR-057-request-context-instead-of-a-service-container.md)
- [ADR-079: Structured Field Values](./ADR-079-structured-field-values-package.md)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)

## Notes

- The `traceparent` example trace id in the Usage section is the specification's own.
- A `tracestate` entry this repo would write for itself is not proposed; the state is carried
  for callers and callees that use it.
- Implementation: `withTrace()` replaces both trace headers on the copy instead of leaving
  present ones, because a forwarded request always arrives with its caller's `traceparent`,
  and keeping it would hand the Durable Object the caller's caller as its parent. `inject()`
  keeps the leave-present-headers rule, and adds no `tracestate` beside a `traceparent` the
  caller set, since that state would belong to another trace.
- Implementation: `traceFields()` returns a named `TraceFields` interface with a string index
  signature, so the object is assignable to `Log.Fields` without a cast.
- Implementation: `remix` stays a regular dependency of the package as scaffolded; only
  `./middleware` imports it, so the root export used by `@sdxc/api-client` never loads it.
- Implementation: the W3C test suite is a harness that drives a live server, so its cases are
  encoded as table tests in `traceparent.test.ts` and `tracestate.test.ts` instead of vendored
  fixtures.
- Implementation: `JobMessage` gains no trace members. `envelope()` reads `currentTrace()`
  itself (with an optional `trace` argument), and both adapters call it inside `send()`, which
  runs in the enqueuing invocation's async context, so the dispatcher, `messageBody()` and the
  adapters propagate without a second place to thread the trace through.
- Implementation: a delivered body is read for its trace by `readMessageTrace()` beside
  `readMessageBody()`; `runJob()` continues it (or starts a root) and binds it outside
  `log.run()`, and `JobContextInit` gains an optional `trace` that defaults to the current
  trace, or a new root, for contexts built directly in tests.
- Implementation: no `@sdxc/logger` change was needed; the trace fields are ordinary
  `Log.set()` fields.
- Reader adoption: the router continues a caller's trace; the Durable Objects keep their RPC
  signatures and open their own logs untraced, the deferred join the Durable Objects section
  describes, since every one of their methods would take a `traceparent` argument for it.
