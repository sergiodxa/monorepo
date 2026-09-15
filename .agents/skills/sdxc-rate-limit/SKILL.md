---
name: sdxc-rate-limit
description: "@sdxc/rate-limit counts attempts behind one `Adapter` interface — `MemoryAdapter`, `CloudflareAdapter`, `KVAdapter`, `DataTableAdapter` — and serializes each decision into the IETF draft `RateLimit`, `RateLimit-Policy` and `Retry-After` fields. Use when limiting routes with the `rateLimit` middleware on a `remix/router`, budgeting a job or an outbound call with `adapter.consume()`, building a `429` with `tooManyRequests()`, or choosing a fixed-window vs sliding-window backend."
---

# @sdxc/rate-limit

An `Adapter` counts attempts against a key and answers a `RateLimitDecision`; the middleware
spends that budget for a request and serializes the decision into standard response headers.
Because the counting sits behind one interface, the same limit runs on a platform binding, on a
key-value store, on a SQL table, or in process, chosen per endpoint. The root entry ships the
contract, the four backends, `rateLimitHeaders` / `applyRateLimitHeaders`, `tooManyRequests` and
`RateLimitError`; the `/middleware` entry ships `rateLimit` for a `remix/router`. Adapters need no
request, so jobs and queue consumers use them directly, and failures come back as a `Result`
rather than an exception.

Full API, options and examples: [packages/rate-limit/README.md](packages/rate-limit/README.md)

## When to reach for it

- A route has to refuse a caller who is over quota, before the handler runs
- A response should carry `RateLimit`, `RateLimit-Policy` and `Retry-After` so clients can back off
- A background job or an outbound-call budget needs counting with no HTTP request in sight
- The counters must be inspectable, or must survive a restart, so an in-process `Map` will not do
- A surface must fail closed when the counting backend is unavailable, rather than letting traffic through

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/rate-limit": "workspace:*" } }
```

```ts
import { CloudflareAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";

router.use(
	rateLimit({
		adapter: new CloudflareAdapter(env.TOKEN_RATE_LIMITER, { limit: 20, window: "1 minute" }),
		prefix: "token",
		key: (context) => context.request.headers.get("X-Client-Id") ?? "anonymous",
	}),
);
```

Counting on its own, with no request:

```ts
import { MemoryAdapter } from "@sdxc/rate-limit";
import { isSuccess } from "@sdxc/result";

let adapter = new MemoryAdapter({ limit: 100, window: "1 minute" });

let result = await adapter.consume(`alerts:${teamId}`);
if (isSuccess(result) && !result.data.allowed) return skipDelivery();
```

### Entry points

- `@sdxc/rate-limit` — the `Adapter` contract, the four backends, `RateLimitError`, header serialization, and the `429` builder. No router dependency.
- `@sdxc/rate-limit/middleware` — the `rateLimit` middleware for `remix/router`.

## Suggestions

- `key` is required and has no default: too broad a key lets one caller spend another's budget, and a key the caller controls lets it mint fresh budgets. Prefer an identity the request already authenticated; for an anonymous endpoint use the connecting address and return one shared bucket rather than skipping the limit.
- Pass an explicit `prefix` whenever keys are persisted or inspected. The default is derived from registration order, which is stable within a process but meaningless in a KV browser or a SQL query.
- `MemoryAdapter` counts per process and per isolate, so it is for tests and local development, not a deployed limit. `adapter.clear()` keeps one test's traffic out of the next.
- `CloudflareAdapter` needs a rate limiter binding, and its `limit` / `window` are declared metadata that must mirror the binding's own `limit` and `period` — drift leaves limiting correct and every header wrong. `remaining` is always `null` and `reset()` always fails, because the binding cannot report or clear a key.
- `DataTableAdapter` queries a `rate_limit_hits` table. The package exports the `rateLimitHits` table definition and `RATE_LIMIT_HITS_SCHEMA_SQL`, but the migration belongs to the consuming app.
- `failurePolicy` defaults to `"open"` so a storage outage cannot lock every client out; flip it to `"closed"` per registration on a surface where an uncounted request is worse than a refused one. Either way the outage is logged as `rate_limit.unavailable`.

## Related

- `@sdxc/duration` — `window` is one of its `DurationInput` values; skill `sdxc-duration`
- `@sdxc/result` — `consume` and `reset` answer with its `Result`; skill `sdxc-result`
- `@sdxc/logger` — where the limit, the remaining budget and the `rate_limit.exceeded` warning are recorded; skill `sdxc-logger`
