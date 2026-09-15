---
name: sdxc-server-timing
description: "@sdxc/server-timing collects per-request `Server-Timing` measurements through a `TimingCollector` and renders them onto a response header. Use when you need to know which part of a slow response was slow, want database, cache or auth timings visible in a browser network panel, or are wrapping a handler so every request answers with a `Server-Timing` header."
---

# @sdxc/server-timing

When a response is slow, the interesting question is which part was slow. The
`Server-Timing` header answers it, and every browser's network panel shows the segments
alongside the transfer timings. A `TimingCollector` lives for one request, `measure` wraps
each operation worth timing and returns whatever it resolved to, `toString` renders the
header value, and `toHeaders` writes it onto a `Headers` object. The package has no
dependencies and runs on any runtime with `Headers`.

Full API, options and examples: [packages/server-timing/README.md](packages/server-timing/README.md)

## When to reach for it

- A response is slow and the breakdown between database, cache and upstream calls is not visible from the outside.
- A helper several layers down should attribute its own work in the same response header the handler stamps.
- A handler wrapper needs to annotate an existing response — including the immutable ones a redirect helper or an upstream `fetch` hands back.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/server-timing": "workspace:*" } }
```

```ts
import { TimingCollector } from "@sdxc/server-timing";

let collector = new TimingCollector();

let user = await collector.measure("db", "findUserById", async () => {
	return await findUserById(userId);
});

return new Response(JSON.stringify(user), { headers: collector.toHeaders() });
// Server-Timing: db;desc="findUserById";dur=12.34
```

## Suggestions

- Construct one collector per request and pass it down to the code that does the work, rather than sharing one — a shared collector reports one caller's timings in another caller's header.
- `name` is the grouping key a network panel is scanned by, so keep it short and stable (`db`, `cache`, `auth`) and put the varying part in `description`. Both halves reach every client that reads the response.
- `toHeaders` sets rather than appends, so the collector owns the header on whatever `Headers` it is given. For a response whose headers are immutable, copy into a new `Response` with `timing.toHeaders(new Headers(response.headers))`.
- A measurement is recorded whether the function resolves or rejects, and the rejection is re-thrown untouched. Some runtimes advance the clock only across I/O, so timing an I/O call is what produces a `dur` to read.
