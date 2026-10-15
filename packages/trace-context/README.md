# @sdxc/trace-context

W3C Trace Context, carried from each invocation to its jobs and requests.

[W3C Trace Context](https://www.w3.org/TR/trace-context/) defines the two headers every hop of a
distributed request shares: `traceparent` (trace id, the calling span's id, a flags byte) and
`tracestate` (up to 32 vendor entries). This package reads and writes both (Level 1, plus the
Level 2 `random` flag) and binds one trace to each invocation, so anything running inside it can
name the invocation's span as its parent without being handed the trace.

## Installation

```sh
npm add @sdxc/trace-context
```

The middleware runs on the [`remix`](https://www.npmjs.com/package/remix) router and stamps the
log from [`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger); parsers answer a `Result`
from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result). [`@sdxc/jobs`](https://www.npmjs.com/package/@sdxc/jobs)
carries the current trace into every job it enqueues, and
[`@sdxc/api-client`](https://www.npmjs.com/package/@sdxc/api-client) injects it into every request.
`@sdxc/trace-context/middleware/cli` runs on [`@sdxc/cli`](https://www.npmjs.com/package/@sdxc/cli).

## Usage

### Give every request a trace

```typescript
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { createRouter } from "remix/router";

let logger = createLogger({ service: "api" });
let router = createRouter({ middleware: [log(logger), trace()] });

router.get("/", (ctx) => Response.json({ traceId: ctx.trace.traceId }));
```

`trace()` continues the caller's `traceparent` or starts a new trace, publishes it as `ctx.trace`,
and sets `trace_id`, `span_id`, `trace_flags` and `parent_span_id` on the request's log. Mount it
directly after `log(logger)`.

### Give every command run a trace

```typescript
import { createCLI } from "@sdxc/cli";
import { log } from "@sdxc/logger/middleware/cli";
import { trace } from "@sdxc/trace-context/middleware/cli";

let cli = createCLI({ name: "app", commands, middleware: [log(logger), trace()] });
```

The command line's `trace()` continues the trace in the `TRACEPARENT` and `TRACESTATE`
environment variables, OpenTelemetry's carrier for processes, or starts one. Every child process
`ctx.exec` starts receives `TRACEPARENT` naming the run's span, so a script that calls another
traced command keeps one `trace_id`.

### Propagate it to outbound requests

```typescript
import { inject, withTrace } from "@sdxc/trace-context";

let headers = new Headers({ Accept: "application/json" });
inject(headers);
let items = await fetch("https://api.example.com/items", { headers });

let forwarded = await stub.fetch(withTrace(request));
```

Both read the current trace, so they work anywhere inside the request, however deep. `inject`
writes into headers you are building; `withTrace` copies a request you are forwarding and replaces
the trace headers it arrived with, so the callee sees this span as its parent.

### Bind a trace outside a router

```typescript
import { currentLog } from "@sdxc/logger";
import { inject, runWithTrace, startTrace, traceFields } from "@sdxc/trace-context";

let trace = startTrace();

await runWithTrace(trace, async () => {
	currentLog()?.set(traceFields(trace));

	let headers = new Headers();
	inject(headers);
	await fetch("https://api.example.com/sync", { headers });
});
```

`runWithTrace` makes a trace current for everything `fn` awaits; a nested call restores the outer
trace when it returns. `traceFields` names the trace as OpenTelemetry names it for logs.

### Read and write the headers

```typescript
import { isSuccess, unwrap } from "@sdxc/result";
import { parse, stringify } from "@sdxc/trace-context/traceparent";
import * as TraceStateHeader from "@sdxc/trace-context/tracestate";

let parent = parse("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
if (isSuccess(parent)) parent.data.sampled; // true

let state = unwrap(TraceStateHeader.parse("rojo=00f067aa0ba902b7,congo=t61rcWkgMzE"));
let updated = unwrap(state.set("congo", "new"));
TraceStateHeader.stringify(updated); // "congo=new,rojo=00f067aa0ba902b7"
```

## API

### `@sdxc/trace-context`

#### `startTrace(options?: TraceContext.StartOptions): TraceContext`

A new root trace with random ids, flagged `random`. `options.sampled` defaults to `true`,
`options.state` to `TraceState.EMPTY`.

#### `continueTrace(parent: TraceParent.Value, state?: TraceState): TraceContext`

The caller's trace id and flags, a new span id, and the caller's span as `parentSpanId`.

#### `extract(headers: Headers): TraceContext`

Continues the trace the headers carry and always answers one: a missing or invalid `traceparent`
starts a new trace, and an invalid `tracestate` beside a valid one is dropped.

#### `inject(headers: Headers, trace?: TraceContext, propagation?: TraceContext.Propagation): void`

Writes `traceparent` naming `trace.spanId` as parent, plus `tracestate` when the state has
entries. `trace` defaults to `currentTrace()`, and nothing is written without one. Headers already
present are kept. `propagation` is `"all"` (default), `"traceparent"` or `"none"`.

#### `withTrace(request: Request, trace?: TraceContext): Request`

A copy of `request` carrying `trace` (the current one by default) in place of its own trace
headers; the body moves to the copy. Without a trace, the request itself is returned.

#### `toTraceParent(trace: TraceContext): string`

The `traceparent` value naming `trace.spanId` as parent, for a channel without headers such as an
RPC argument.

#### `currentTrace(): TraceContext | undefined`

The trace bound to the running invocation, `undefined` outside one.

#### `runWithTrace<T>(trace: TraceContext, fn: () => T): T`

Runs `fn` with `trace` current and answers what it returns; the outer trace is current again once
it returns.

#### `traceFields(trace: TraceContext): TraceFields`

`{ trace_id, span_id, parent_span_id, trace_flags }` for a log; `parent_span_id` is `undefined`
for a root.

### `@sdxc/trace-context/middleware`

#### `trace(options?: TraceMiddleware.Options)`

Continues or starts the request's trace, binds it for `currentTrace()`, publishes it as
`ctx.trace` and sets `traceFields()` on the current log. A trace already current is joined.
`options.accept(request)` returning `false` starts a new trace and notes the refused header as
`trace.rejected` on the log.

#### `CurrentTrace`

The context key `trace()` sets, for reading the trace where the middleware chain's types are
unknown: `ctx.get(CurrentTrace)`.

### `@sdxc/trace-context/middleware/cli`

#### `trace()`

[`@sdxc/cli`](https://www.npmjs.com/package/@sdxc/cli) middleware continuing the trace in the
`TRACEPARENT` environment variable (with `TRACESTATE`), or starting one when it is missing or
invalid. It binds the trace for `currentTrace()`, publishes it as `ctx.trace` under `CurrentTrace`,
sets `traceFields()` on the current log, and sets `TRACEPARENT` (and `TRACESTATE`) on every child
`ctx.exec` starts unless the call passes its own `TRACEPARENT`. A trace already current is joined.

### `@sdxc/trace-context/traceparent`

#### `parse(value: string): Result<TraceParent.Value, TraceParentParseError>`

Reads `version-traceid-parentid-flags`. A version above `00` is read by the `00` rules and may
carry more fields after a `-`.

#### `stringify(value): string`

Writes version `00` from `traceId`, `parentId`, `sampled` and `random`; a parsed value is accepted
as is.

#### `TraceParentParseError`

Its `code` is `"malformed"`, `"invalid-version"` (`ff`), `"invalid-trace-id"` or
`"invalid-parent-id"` (all zero).

### `@sdxc/trace-context/tracestate`

#### `TraceState`

An immutable, ordered list of vendor entries, most recently updated first. `TraceState.EMPTY`,
`size`, `get(key)`, `entries()`, `delete(key)`, and `set(key, value)`, which answers a
`Result` with a new state holding `key` first, refusing an invalid entry or a 33rd key.

#### `parse(value: string): Result<TraceState, TraceStateParseError>`

Reads a comma-separated list, trimming whitespace around members and skipping empty ones.

#### `stringify(state: TraceState, options?: TraceState.StringifyOptions): string`

Writes the list within `options.maxLength` (default 512), dropping entries over 128 characters
first and then the rightmost entries. The empty state writes `""`.

#### `TraceStateParseError`

Its `code` is `"malformed"`, `"invalid-key"`, `"invalid-value"`, `"duplicate-key"` or
`"too-many"` (over 32 entries).

### Types

`TraceContext` holds `traceId` (32 hex digits), `spanId` (this invocation's span), `parentSpanId`
(the caller's span, `null` for a root), `sampled`, `random` and `state`.
`TraceContext.StartOptions` and `TraceContext.Propagation` type the options above. `TraceFields`
is what `traceFields` answers. `TraceParent.Value` is a parsed header: `version`, `traceId`,
`parentId`, the raw `flags` byte and the `sampled` and `random` bits. `TraceParent.ErrorCode`,
`TraceState.ErrorCode`, `TraceState.StringifyOptions` and `TraceMiddleware.Options` name the
codes and options above.

## Pattern: Join A Callee Reached Over RPC

An RPC call carries no headers, so the caller passes the trace as an argument and the callee
binds it for the work it does.

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

A public endpoint that continues any `traceparent` lets a caller pick the `trace_id` its requests
are logged under. Accept the header only from callers you trust; everyone else gets a new trace.

```typescript
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { createRouter } from "remix/router";

let logger = createLogger({ service: "public-api" });

let router = createRouter({
	middleware: [
		log(logger),
		trace({ accept: (request) => request.headers.has("X-Internal-Caller") }),
	],
});
```

## Pattern: Keep Vendor State From A Third Party

`tracestate` can carry upstream vendors' data. Send a third-party API only the `traceparent`, or no
trace at all.

```typescript
import { inject } from "@sdxc/trace-context";

let partner = new Headers({ "Content-Type": "application/json" });
inject(partner, undefined, "traceparent");
await fetch("https://partner.example.com/orders", { method: "POST", headers: partner, body });

let analytics = new Headers();
inject(analytics, undefined, "none");
```

Passing `undefined` as the trace keeps the default, the current trace.

## Pattern: Add Your Own Vendor Entry

A vendor updating its entry moves it to the front of `tracestate`. Start a trace with your entry
already set, or add it to a continued one before propagating.

```typescript
import { isSuccess, unwrap } from "@sdxc/result";
import { extract, inject, startTrace } from "@sdxc/trace-context";
import { TraceState } from "@sdxc/trace-context/tracestate";

let root = startTrace({ sampled: false, state: unwrap(TraceState.EMPTY.set("acme", "region:eu")) });

let incoming = extract(request.headers);
let set = incoming.state.set("acme", "region:eu");
let trace = isSuccess(set) ? { ...incoming, state: set.data } : incoming;

let headers = new Headers();
inject(headers, trace);
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written
`YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per
day.

Those numbers say when, not what: a later date means a later release and carries no compatibility
promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/trace-context": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release
in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
