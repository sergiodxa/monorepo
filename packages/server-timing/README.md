# @sdxc/server-timing

Server-Timing measurements collected per request and written to a response header.

The [`Server-Timing`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Server-Timing)
header shows which part of a response was slow, right in the browser's network panel. A
`TimingCollector` lives for one request, `measure` wraps each operation worth timing, and
`toHeaders` writes the header.

## Installation

```sh
npm add @sdxc/server-timing
```

## Usage

### Measure and report

```typescript
import { TimingCollector } from "@sdxc/server-timing";

let timing = new TimingCollector();

let user = await timing.measure("db", "findUserById", () => findUserById(userId));

return Response.json(user, { headers: timing.toHeaders() });
// Server-Timing: db;desc="findUserById";dur=12.34
```

### Time several operations

Each `measure` call adds one entry, in the order the calls finish. Keep the name short and
stable (`db`, `cache`, `auth`) and put the varying part in the description. Both reach every
client that reads the response.

```typescript
let timing = new TimingCollector();

await timing.measure("auth", "authorize", () => authorize(request));
await timing.measure("cache", "lookup", () => cache.get(key));
await timing.measure("db", "listPosts", () => listPosts());
await timing.measure("render", "", () => renderPage());

timing.toString();
// auth;desc="authorize";dur=4.10, cache;desc="lookup";dur=1.02, db;desc="listPosts";dur=8.77, render;dur=3.20
```

An empty description leaves `desc` out of the entry.

### Annotate an existing response

`toHeaders` writes into the `Headers` it receives and returns them:

```typescript
let response = new Response(html, { headers: { "Content-Type": "text/html" } });

timing.toHeaders(response.headers);

return response;
```

## API

### `new TimingCollector()`

An empty set of measurements for one request. Create one per request so each response
reports only its own timings.

### `collector.measure<T>(name: string, description: string, fn: () => Promise<T>): Promise<T>`

Times `fn` and returns what it resolves to. The entry is recorded whether `fn` resolves or
rejects, and a rejection is re-thrown unchanged.

### `collector.toString(): string`

The header value: every entry comma-separated, or an empty string when nothing was measured.
An entry is `name;desc="description";dur=ms`, with the description quoted and escaped, the
duration rounded to two decimals, and `dur` present once the duration is above zero. Some
server runtimes advance the clock only across I/O, so CPU-only work can read as zero there.

### `collector.toHeaders(headers?: Headers): Headers`

Sets `Server-Timing` on `headers` (a new `Headers` when omitted) and returns the same object.
It replaces any `Server-Timing` already present, so calling it twice leaves one copy.

## Pattern: Timing every request

A wrapper gives each request a collector and writes the header after the handler answers.
Copying into a new `Response` also covers responses with immutable headers, such as one
returned by `fetch` or `Response.redirect`.

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

export default {
	fetch: withTiming(async (request, timing) => {
		let posts = await timing.measure("db", "listPosts", () => listPosts());
		return Response.json(posts);
	}),
};
```

## Pattern: Measuring across layers

Pass the collector down so helpers add their own entries to the same header. A `measure`
around a helper adds an entry covering everything inside it, recorded after the inner ones.

```typescript
import { TimingCollector } from "@sdxc/server-timing";

async function loadDashboard(userId: string, timing: TimingCollector) {
	let user = await timing.measure("db", "findUserById", () => findUserById(userId));
	let feed = await timing.measure("cache", "feed", () => cache.get(`feed:${userId}`));
	return { user, feed };
}

let timing = new TimingCollector();
let data = await timing.measure("load", "dashboard", () => loadDashboard(userId, timing));

return Response.json(data, { headers: timing.toHeaders() });
// Server-Timing: db;desc="findUserById";dur=12.34, cache;desc="feed";dur=1.02, load;desc="dashboard";dur=13.51
```

## Pattern: Reporting a failed call

A rejected operation still produces its entry, so an error response can show how long the
failing call took before it gave up.

```typescript
import { TimingCollector } from "@sdxc/server-timing";

let timing = new TimingCollector();

try {
	let rates = await timing.measure("upstream", "rates", () =>
		fetch("https://api.example.com/rates").then((response) => response.json()),
	);
	return Response.json(rates, { headers: timing.toHeaders() });
} catch {
	return new Response("Upstream unavailable", {
		status: 502,
		headers: timing.toHeaders(),
	});
	// Server-Timing: upstream;desc="rates";dur=5000.12
}
```

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
