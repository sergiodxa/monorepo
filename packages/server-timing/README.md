# @sdxc/server-timing

Server-Timing measurements collected per request and written to a response header.

## Overview

When a response is slow, the interesting question is _which part_ was slow. The
[`Server-Timing`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing)
header answers it: the server reports named, timed segments of its own work, and every
browser's network panel shows them alongside the transfer timings. No agent, no tracing
backend, no sampling — the measurements ride along on the response that produced them.

This package is the small amount of bookkeeping that makes the header practical. A
`TimingCollector` lives for one request, `measure` wraps each operation worth timing, and
`toHeaders` renders everything collected into the header's syntax. Getting that syntax
right by hand is fiddly — quoting descriptions, dropping empty fields, joining entries —
and getting it wrong makes the whole header unparseable, so it is done once here.

Nothing in the package can fail: a measurement either completes or it does not, and an
operation's own rejection passes straight through. There is no `Result`, no error type,
and no runtime dependency of any kind.

## Usage

### Measure And Report

```typescript
import { TimingCollector } from "@sdxc/server-timing";

let collector = new TimingCollector();

let user = await collector.measure("db", "findUserById", async () => {
	return await User.findById(db, userId);
});

return new Response(JSON.stringify(user), { headers: collector.toHeaders() });
// Server-Timing: db;desc="findUserById";dur=12.34
```

### Time Several Operations

Every `measure` call adds one entry, in the order the calls completed. Reuse the `name`
to group related operations and vary the description to tell them apart.

```typescript
let collector = new TimingCollector();

let session = await collector.measure("auth", "authorize", () => authorize(request));
let cached = await collector.measure("cache", "lookup", () => kv.get(key, "json"));
let rows = await collector.measure("db", "listPosts", () => Post.list(db));

collector.toString();
// auth;desc="authorize";dur=4.10, cache;desc="lookup";dur=1.02, db;desc="listPosts";dur=8.77
```

### Annotate A Response On The Way Out

Because `toHeaders` writes into an existing `Headers` object, a middleware can collect
timings for the whole request and stamp them on whatever response comes back — including
the one it produces itself when it refuses the request.

```typescript
let collector = new TimingCollector();

let response = await next();
collector.toHeaders(response.headers);

return response;
```

## API

### `TimingCollector`

A request-scoped set of measurements. Construct one per request: sharing a collector
across requests mixes one caller's timings into another's header.

#### `new TimingCollector()`

Creates an empty collector. Takes no arguments.

#### `collector.measure<T>(name: string, description: string, fn: () => Promise<T>): Promise<T>`

Times an async operation and records the result.

**Parameters:**

- `name`: Metric name, grouping the measurement (`db`, `cache`, `auth`)
- `description`: Detail about this particular measurement, usually the operation
- `fn`: The operation to time

**Returns:**

- Whatever `fn` resolves to, unchanged.

The measurement is recorded whether `fn` resolves or rejects, and a rejection is re-thrown
untouched — a call that failed slowly is exactly the one worth seeing in the header.

**Example:**

```typescript
let user = await collector.measure("db", "findUserById", () => User.findById(db, id));
```

#### `collector.toString(): string`

Renders every measurement as the header's value.

**Returns:**

- The comma-separated entries, or an empty string if nothing was measured.

**Example:**

```typescript
collector.toString(); // 'db;desc="findUserById";dur=12.34'
```

#### `collector.toHeaders(headers?: Headers): Headers`

Writes the measurements onto a `Headers` object as a single `Server-Timing` header.

**Parameters:**

- `headers`: Headers to write to. A fresh `Headers` is created when omitted

**Returns:**

- The same `Headers` object, so the call can be used as an expression.

It sets rather than appends, so the collector owns the header on whatever response it is
given: a `Server-Timing` set upstream is overwritten, not merged. Calling it twice on the
same headers replaces the previous value rather than emitting the measurements twice.

**Example:**

```typescript
return new Response(body, { headers: collector.toHeaders() });
```

## Pattern: A Timed Request Middleware

Publish the collector on the request context so handlers can add their own measurements to
the same header, then write it after the handler has answered.

```typescript
declare module "remix/router" {
	interface RequestContext {
		timing: TimingCollector;
	}
}

export function withTiming(): Middleware {
	return async (ctx, next) => {
		ctx.timing = new TimingCollector();

		// Written after the handler has answered, so its own measurements are included.
		let response = await next();
		ctx.timing.toHeaders(response.headers);

		return response;
	};
}
```

Note that a response the handler did not construct itself may have immutable headers. Wrap
it in a new `Response` first if that is a possibility.

## Related Packages

- [`@sdxc/logger`](/packages/logger) - Request-scoped logging, which also reports `server-timing` when it is present on a response

## Tips

1. **One collector per request** - The collector is mutable request state, not a singleton; a shared one leaks timings between callers.
2. **Measure I/O, not computation** - Some server runtimes freeze `performance.now()` between I/O operations, so a measurement around pure computation can legitimately read as `0`.
3. **Keep names short and stable** - The name is the grouping key you will scan for in a network panel; put the varying part in the description.
4. **Avoid quotes in descriptions** - Descriptions are emitted inside double quotes, so keep them to plain identifiers and prose rather than embedding punctuation the header's grammar cares about.
5. **The header is public** - Anything measured is visible to every client, so name internal systems no more precisely than you would in a public API.
