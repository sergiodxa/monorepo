# @sdxc/trace-context

W3C Trace Context: traceparent and tracestate, one trace per invocation, propagated to jobs and outbound requests.

## Installation

```bash
npm add @sdxc/trace-context
```

The middleware runs on the [`remix`](https://www.npmjs.com/package/remix) router and stamps the
trace on the [`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger) wide event; parsers
return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values. All three install
alongside this package.

[W3C Trace Context](https://www.w3.org/TR/trace-context/) defines two headers every hop of a
distributed request agrees on: `traceparent` carries the trace id, the id of the calling span
and a flags byte; `tracestate` carries up to 32 vendor-owned entries beside it. This package
reads and writes both to the letter of the specification (Level 1, plus the Level 2
`random-trace-id` flag) and binds one trace to each invocation through `AsyncLocalStorage`.
[`@sdxc/jobs`](https://www.npmjs.com/package/@sdxc/jobs) carries the trace in its envelope and
[`@sdxc/api-client`](https://www.npmjs.com/package/@sdxc/api-client) injects it into every
request.

## Usage

### Give Every Request A Trace

```typescript
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { createRouter } from "remix/router";

let logger = createLogger({ service: "api" });
let router = createRouter({ middleware: [log(logger), trace()] });

router.get("/", (ctx) => Response.json({ traceId: ctx.trace.traceId }));
```

The request's log now carries `trace_id`, `span_id`, `trace_flags`, and `parent_span_id` when
the caller sent a valid `traceparent`.

### Propagate By Hand

```typescript
import { inject, withTrace } from "@sdxc/trace-context";

let headers = new Headers();
inject(headers); // writes the current trace; nothing outside one
await fetch("https://api.example.com/items", { headers });

let response = await stub.fetch(withTrace(request)); // forwarding a request
```

### Read And Write The Headers

```typescript
import { isSuccess, unwrap } from "@sdxc/result";
import { parse, stringify } from "@sdxc/trace-context/traceparent";
import * as TraceStateHeader from "@sdxc/trace-context/tracestate";

let parent = parse("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
if (isSuccess(parent)) parent.data.sampled; // true

let state = unwrap(TraceStateHeader.parse("rojo=00f067aa0ba902b7,congo=t61rcWkgMzE"));
let updated = unwrap(state.set("congo", "new")); // "congo=new,rojo=00f067aa0ba902b7"
TraceStateHeader.stringify(updated, { maxLength: 512 });
```

## API

### `@sdxc/trace-context`

#### `TraceContext`

`traceId` (32 hex digits), `spanId` (this invocation's span, 16 hex digits), `parentSpanId`
(the caller's span, `null` for a root), `sampled`, `random`, and `state` (a `TraceState`).
`TraceContext.StartOptions` and `TraceContext.Propagation` type the options below.

#### `startTrace(options?)`

A new root with fresh random ids from `crypto.getRandomValues`, flagged `random`. `sampled`
defaults to `true`; `state` to the empty state.

#### `continueTrace(parent, state?)`

The caller's trace id and flags, a new span id, and the caller's span as `parentSpanId`.

#### `extract(headers)`

Continues the trace `headers` carry. A missing or invalid `traceparent` starts a new trace and
discards `tracestate` unread; an invalid `tracestate` beside a valid parent is dropped. It
always returns a trace.

#### `inject(headers, trace?, propagation?)`

Writes `traceparent` naming `trace.spanId` as parent, and `tracestate` when the state has
entries. `trace` defaults to `currentTrace()`, and nothing is written without one. A header
already present is kept, and a caller-set `traceparent` gets no `tracestate` beside it.
`propagation` is `"all"` (default), `"traceparent"` or `"none"`.

#### `withTrace(request, trace?)`

A copy of `request` whose trace headers name the current span as parent; the body moves to the
copy. Outside a trace, the request itself is returned.

#### `toTraceParent(trace)`

The `traceparent` value naming `trace.spanId` as parent, for carrying a trace as an RPC
argument.

#### `currentTrace()` and `runWithTrace(trace, fn)`

The trace bound to the running invocation, and the binding itself. A nested binding restores
the outer trace when it returns.

#### `traceFields(trace)`

`{ trace_id, span_id, parent_span_id, trace_flags }`, named as OpenTelemetry names them for
logs, ready for `log.set()`. `parent_span_id` is `undefined` for a root. `TraceFields` is its
type.

### `@sdxc/trace-context/traceparent`

#### `parse(value)`

Reads `version-traceid-parentid-flags` into a `Result<TraceParent.Value,
TraceParentParseError>`. A version above `00` is read by the `00` rules and may carry more
after a `-`. `TraceParent.Value` exposes `flags` as the raw byte, and `sampled` (bit 0) and
`random` (bit 1) as booleans.

#### `stringify(value)`

Writes version `00` with only the `sampled` and `random` bits.

#### `TraceParentParseError`

Its `code` (`TraceParent.ErrorCode`) is `"malformed"` (shape, length, uppercase hex),
`"invalid-version"` (`ff`), `"invalid-trace-id"` or `"invalid-parent-id"` (all zero).

### `@sdxc/trace-context/tracestate`

#### `TraceState`

An immutable, ordered list; leftmost is the most recently updated. `TraceState.EMPTY`, `size`,
`get(key)`, `entries()`, `delete(key)`, and `set(key, value)`, which validates the entry,
refuses a 33rd key, and returns a new state with `key` first.

#### `parse(value)`

Reads a comma-separated list into a `Result<TraceState, TraceStateParseError>`, trimming
optional whitespace and skipping empty members.

#### `stringify(state, options?)`

Writes the list, truncated to `maxLength` (default 512) by dropping entries over 128
characters first, then the rightmost entries. The empty state writes `""`.

#### `TraceStateParseError`

Its `code` (`TraceState.ErrorCode`) is `"malformed"`, `"invalid-key"`, `"invalid-value"`,
`"duplicate-key"` or `"too-many"` (over 32).

### `@sdxc/trace-context/middleware`

#### `trace(options?)`

Continues or starts the request's trace, binds it for `currentTrace()`, publishes it as
`ctx.trace`, and stamps `traceFields()` on the current log. A trace already current is joined.
`options.accept(request)` returning `false` starts a new trace and notes the dropped header as
`trace.rejected` on the log. `TraceMiddleware.Options` is its options type.

#### `CurrentTrace`

The context key the middleware sets, for reading the trace where the middleware chain's types
are unknown: `ctx.get(CurrentTrace)`.

## Pattern: Join A Callee Reached Over RPC

An RPC call carries no headers, so the trace travels as an argument and the callee binds it:

```typescript
import { isSuccess } from "@sdxc/result";
import { continueTrace, runWithTrace, startTrace, toTraceParent } from "@sdxc/trace-context";
import { parse } from "@sdxc/trace-context/traceparent";

await stub.subscribe(subject, toTraceParent(ctx.trace));

export class Subscriptions {
	async subscribe(subject: string, traceparent: string) {
		let parent = parse(traceparent);
		let trace = isSuccess(parent) ? continueTrace(parent.data) : startTrace();
		return runWithTrace(trace, () => this.store(subject));
	}
}
```

## Pattern: Refuse Caller-Chosen Traces On A Public Endpoint

```typescript
import { trace } from "@sdxc/trace-context/middleware";

let internal = (request: Request) => request.headers.has("X-Internal-Caller");

let router = createRouter({ middleware: [log(logger), trace({ accept: internal })] });
```

Mount `trace()` directly after `log(logger)`, so the log it stamps is the request's.

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
		"@sdxc/trace-context": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
