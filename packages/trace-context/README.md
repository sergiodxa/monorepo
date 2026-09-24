# @sdxc/trace-context

W3C Trace Context: traceparent and tracestate, one trace per invocation, propagated to jobs and outbound requests.

[W3C Trace Context](https://www.w3.org/TR/trace-context/) defines two headers every hop of a
distributed request agrees on: `traceparent` carries the trace id the whole request shares,
the id of the span that sent the call, and a flags byte; `tracestate` carries up to 32
vendor-owned entries beside it. OpenTelemetry, Cloudflare and the major APM vendors read and
write both, so a worker that honors them joins any trace its caller started.

This package parses and writes both headers to the letter of the specification (Level 1, plus
the Level 2 `random-trace-id` flag), and binds a `TraceContext` to the running invocation
through `AsyncLocalStorage`. One invocation is one span: the wide event `@sdxc/logger` emits
already records its duration and outcome, so the trace contributes four fields to it
(`trace_id`, `span_id`, `parent_span_id`, `trace_flags`) and every outbound call names the
invocation's span as its parent. `@sdxc/jobs` carries the trace in its envelope and
`@sdxc/api-client` injects it into every request, so propagation needs no call-site code.

## Usage

### Give Every Request A Trace

```typescript
import { log } from "@sdxc/logger/middleware";
import { trace } from "@sdxc/trace-context/middleware";

let router = createRouter({ middleware: [log(logger), trace()] });

router.get(routes.home, (ctx) => {
	return Response.json({ requestId: ctx.trace.traceId });
});
```

The request's log now carries `trace_id`, `span_id`, `trace_flags`, and `parent_span_id` when
the caller sent a valid `traceparent`.

### Propagate By Hand

```typescript
import { inject, withTrace } from "@sdxc/trace-context";

let headers = new Headers();
inject(headers); // writes the current trace, nothing outside one
await fetch(url, { headers });

let response = await stub.fetch(withTrace(request)); // forwarding to a Durable Object
```

### Read And Write The Headers

```typescript
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

#### `interface TraceContext`

`traceId` (32 hex digits), `spanId` (this invocation's span, 16 hex digits), `parentSpanId`
(the caller's span, `null` for a root), `sampled`, `random`, and `state` (a `TraceState`).

#### `startTrace(options?: TraceContext.StartOptions): TraceContext`

A new root with fresh random ids from `crypto.getRandomValues`, flagged `random`. `sampled`
defaults to `true`; `state` to the empty state.

#### `continueTrace(parent: TraceParent.Value, state?: TraceState): TraceContext`

The caller's trace id and flags, a new span id, and the caller's span as `parentSpanId`.

#### `extract(headers: Headers): TraceContext`

Continues the trace `headers` carry. A missing or invalid `traceparent` starts a new trace and
discards `tracestate` unread; an invalid `tracestate` beside a valid parent is dropped. Never
fails.

#### `inject(headers: Headers, trace?: TraceContext, propagation?: TraceContext.Propagation): void`

Writes `traceparent` naming `trace.spanId` as parent, and `tracestate` when the state has
entries. `trace` defaults to `currentTrace()`, and nothing is written without one. A header
already present is left alone, and a caller-set `traceparent` gets no `tracestate` added
beside it. `propagation` is `"all"` (default), `"traceparent"` or `"none"`.

#### `withTrace(request: Request, trace?: TraceContext): Request`

A copy of `request` whose trace headers are replaced by the current trace's, so a forwarded
request tells the callee this span is its parent. The body moves to the copy. Outside a
trace, the request itself is returned.

#### `toTraceParent(trace: TraceContext): string`

The `traceparent` value naming `trace.spanId` as parent, for carrying a trace as a Workers RPC
argument.

#### `currentTrace(): TraceContext | undefined` / `runWithTrace<T>(trace, fn: () => T): T`

The trace bound to the running invocation, and the binding itself. Nested bindings restore the
outer trace when they return.

#### `traceFields(trace: TraceContext): TraceFields`

`{ trace_id, span_id, parent_span_id, trace_flags }`, named as OpenTelemetry names them for
logs, ready for `log.set()`. `parent_span_id` is `undefined` for a root, which the log skips.

### `@sdxc/trace-context/traceparent`

#### `parse(value: string): Result<TraceParent.Value, TraceParentParseError>`

Reads `version-traceid-parentid-flags`. A version above `00` is read by the `00` rules and may
carry more after a `-`. The error's `code` is `"malformed"` (shape, length, uppercase hex),
`"invalid-version"` (`ff`), `"invalid-trace-id"` or `"invalid-parent-id"` (all zero).
`TraceParent.Value` exposes `flags` as the raw byte, and `sampled` (bit 0) and `random`
(bit 1) as booleans.

#### `stringify(value): string`

Writes version `00` with only the `sampled` and `random` bits.

### `@sdxc/trace-context/tracestate`

#### `class TraceState`

An immutable, ordered list; leftmost is the most recently updated. `TraceState.EMPTY`, `size`,
`get(key)`, `entries()`, `delete(key)`, and `set(key, value)`, which validates the entry,
refuses a 33rd key, and returns a new state with `key` first.

#### `parse(value: string): Result<TraceState, TraceStateParseError>`

Reads a comma-separated list, trimming optional whitespace and skipping empty members. The
error's `code` is `"malformed"`, `"invalid-key"`, `"invalid-value"`, `"duplicate-key"` or
`"too-many"` (over 32).

#### `stringify(state: TraceState, options?: { maxLength?: number }): string`

Writes the list, truncated to `maxLength` (default 512) by dropping entries over 128
characters first, then the rightmost entries. The empty state writes `""`.

### `@sdxc/trace-context/middleware`

#### `trace(options?: TraceMiddleware.Options): Middleware`

Continues or starts the request's trace, binds it for `currentTrace()`, publishes it as
`ctx.trace` (and under the `CurrentTrace` key), and stamps `traceFields()` on the current log.
A trace already current is joined. `accept(request)` returning `false` starts a new trace and
notes the dropped header as `trace.rejected` on the log.

## Patterns

### Join A Durable Object Called Over RPC

Workers RPC has no headers, so the trace travels as an argument:

```typescript
import { continueTrace, runWithTrace, toTraceParent } from "@sdxc/trace-context";
import { parse } from "@sdxc/trace-context/traceparent";

await stub.subscribe(subject, toTraceParent(ctx.trace));

async subscribe(subject: string, traceparent: string) {
	let parent = parse(traceparent);
	let trace = isSuccess(parent) ? continueTrace(parent.data) : startTrace();
	return runWithTrace(trace, () => this.#subscribe(subject));
}
```

### Keep Vendor State From A Third Party

An `APIClient` subclass narrows what it forwards:

```typescript
class Stripe extends APIClient {
	protected override readonly propagateTrace = "traceparent";
}
```

## Related Packages

- [`@sdxc/logger`](../logger/README.md) - the wide event the trace fields are stamped on
- [`@sdxc/jobs`](../jobs/README.md) - carries the trace in every envelope
- [`@sdxc/api-client`](../api-client/README.md) - injects the trace into every request

## Tips

- Mount `trace()` directly after `log(logger)`, so the log it stamps is the request's.
- A public worker that should not let callers choose their own `trace_id` passes `accept`.
- Raw `fetch` calls to third-party URLs stay untraced unless the call site writes `inject()`.
