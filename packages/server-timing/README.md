# @sdxc/server-timing

Server-Timing measurements collected per request and written to a response header.

When a response is slow, the interesting question is _which part_ was slow. The
[`Server-Timing`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Server-Timing)
header answers it, and every browser's network panel shows the segments alongside the
transfer timings. A `TimingCollector` lives for one request, `measure` wraps each operation
worth timing, and `toHeaders` renders what it collected into the header's syntax.

## Installation

```bash
npm add @sdxc/server-timing
```

## Usage

### Measure And Report

```typescript
import { TimingCollector } from "@sdxc/server-timing";

let collector = new TimingCollector();

let user = await collector.measure("db", "findUserById", async () => {
	return await findUserById(userId);
});

return new Response(JSON.stringify(user), { headers: collector.toHeaders() });
// Server-Timing: db;desc="findUserById";dur=12.34
```

### Time Several Operations

Every `measure` call adds one entry, in the order the calls completed. Reuse the `name` to
group related operations and vary the description to tell them apart:

```typescript
let collector = new TimingCollector();

let session = await collector.measure("auth", "authorize", () => authorize(request));
let cached = await collector.measure("cache", "lookup", () => cache.get(key));
let rows = await collector.measure("db", "listPosts", () => listPosts());

collector.toString();
// auth;desc="authorize";dur=4.10, cache;desc="lookup";dur=1.02, db;desc="listPosts";dur=8.77
```

The name is the grouping key you scan for in a network panel, so keep it short and stable
and put the varying part in the description. Both halves reach every client that reads the
response, which makes them names to choose as deliberately as any public API.

### Annotate A Response On The Way Out

`toHeaders` writes into an existing `Headers` object, so a response that already exists
picks up the measurements taken while it was produced:

```typescript
let response = await handle(request);

collector.toHeaders(response.headers);

return response;
```

## API

### `new TimingCollector()`

An empty, request-scoped set of measurements. Construct one per request, since a collector
shared between requests reports one caller's timings in another caller's header.

### `collector.measure<T>(name: string, description: string, fn: () => Promise<T>): Promise<T>`

Times `fn` and returns whatever it resolves to, unchanged. `name` groups the measurement
(`db`, `cache`, `auth`) and `description` says which particular operation it was.

```typescript
let user = await collector.measure("db", "findUserById", () => findUserById(id));
```

The measurement is recorded whether `fn` resolves or rejects, and a rejection is re-thrown
untouched — a call that failed slowly is exactly the one worth seeing in the header.

### `collector.toString(): string`

Renders every measurement as the header's value: the entries comma-separated, or an empty
string when nothing was measured.

```typescript
collector.toString(); // 'db;desc="findUserById";dur=12.34'
```

An entry carries `dur` once it has a duration above zero, and a duration is rounded to two
decimals. Some server runtimes advance the clock only across I/O, so timing an I/O call is
what produces a duration to read.

### `collector.toHeaders(headers?: Headers): Headers`

Writes the measurements onto a `Headers` object as a single `Server-Timing` header and
returns that same object, so the call reads as an expression. A fresh `Headers` is created
when none is given.

```typescript
return new Response(body, { headers: collector.toHeaders() });
```

It sets rather than appends, so the collector owns the header on whatever headers it is
given: a `Server-Timing` written upstream is replaced, and calling it twice on the same
object leaves one copy of the measurements.

## Pattern: Timing A Whole Request

A wrapper around the handler gives every request a collector and stamps the header once the
handler has answered, which is late enough to include the handler's own measurements:

```typescript
import { TimingCollector } from "@sdxc/server-timing";

export function withTiming(
	handler: (request: Request, timing: TimingCollector) => Promise<Response>,
) {
	return async (request: Request) => {
		let timing = new TimingCollector();

		let response = await handler(request, timing);

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: timing.toHeaders(new Headers(response.headers)),
		});
	};
}
```

Copying into a new `Response` keeps this working for the responses whose headers are
immutable, such as the one a redirect helper or an upstream `fetch` hands back. Where the
response is one you constructed yourself, `timing.toHeaders(response.headers)` is enough.

## Pattern: Measuring Inside The Code That Does The Work

Passing the collector down lets a helper contribute its own entries to the same header,
which is how a single response ends up attributing the work across the layers that did it:

```typescript
import { TimingCollector } from "@sdxc/server-timing";

async function loadDashboard(userId: string, timing: TimingCollector) {
	let user = await timing.measure("db", "findUserById", () => findUserById(userId));
	let feed = await timing.measure("cache", "feed", () => cache.get(`feed:${userId}`));

	return { user, feed };
}

let timing = new TimingCollector();
let data = await loadDashboard(userId, timing);

return Response.json(data, { headers: timing.toHeaders() });
// Server-Timing: db;desc="findUserById";dur=12.34, cache;desc="feed";dur=1.02
```

Timings nest the way the calls do: wrapping `loadDashboard` itself in a `measure` adds an
entry covering both, recorded after the two it contains.

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
		"@sdxc/server-timing": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
