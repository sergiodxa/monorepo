# @pkg/rate-limit

Adapter-based rate limiting: four counting backends behind one contract, plus a middleware that emits the standard response headers.

## Overview

Rate limiting has two parts that get tangled together: deciding whether a request fits inside a limit, and telling the client what happened. This package separates them. An `Adapter` counts attempts against a key and answers a `RateLimitDecision`; a middleware spends that budget for a request and serializes the decision into the IETF draft `RateLimit` fields. Because the counting is behind an interface, the same limit can run on a Cloudflare rate limiter binding, on Workers KV, on a SQL table through `remix/data-table`, or in process — chosen per endpoint rather than once for the whole system.

Windows are expressed with [`@pkg/duration`](/packages/duration), so `"10 seconds"` and `"1 minute"` are typed values instead of bare numbers whose unit you have to remember. Failures come back as a [`Result`](/packages/result) rather than an exception, because an unreachable counter store is an expected operational state, not a bug: the caller decides whether the request is allowed through (fail open, the default) or refused (fail closed).

The headers are only ever as truthful as the backend. A field the adapter cannot compute is left out entirely — a binding-backed limit advertises `limit` and `reset` and stays silent about `remaining`, rather than reporting a number nobody measured.

## Usage

### Protecting Routes

```typescript
import { CloudflareAdapter } from "@pkg/rate-limit";
import { rateLimit } from "@pkg/rate-limit/middleware";

router.use(
	rateLimit({
		adapter: new CloudflareAdapter(env.TOKEN_RATE_LIMITER, { limit: 20, window: "1 minute" }),
		prefix: "token",
	}),
);
```

Every request in scope is counted before the handler runs. An allowed response is annotated with the quota it saw; a denied request never reaches the handler and gets a `429`:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
RateLimit: limit=20, reset=37
RateLimit-Policy: 20;w=60
Retry-After: 37

{"error":"too_many_requests","error_description":"Rate limit exceeded. Please try again later."}
```

### Limiting By Something Other Than The Client Address

The default key is the client IP address. An authenticated surface should limit on the identity instead, so one client cannot spend another's budget by sharing an egress address:

```typescript
rateLimit({
	adapter: new KVAdapter(env.RATE_LIMIT_KV, { limit: 100, window: "1 minute" }),
	prefix: "introspect",
	key: (context) => context.get(ClientId),
});
```

### Using An Adapter Directly

Not every protected path is a route. The adapter needs no request, so jobs, queue consumers, and outbound-call budgets use it unchanged:

```typescript
import { isSuccess } from "@pkg/result";

let result = await adapter.consume(`alerts:${teamId}`);
if (isSuccess(result) && !result.data.allowed) return skipDelivery();
```

### Testing A Limited Route

`MemoryAdapter` counts in process, so a test needs no binding, no namespace, and no database:

```typescript
import { MemoryAdapter } from "@pkg/rate-limit";
import { rateLimit } from "@pkg/rate-limit/middleware";

let adapter = new MemoryAdapter({ limit: 1, window: "10 seconds" });
let middleware = rateLimit({ adapter, prefix: "test", key: () => "client" });

await middleware(context, handler); // 200
let response = await middleware(context, handler); // 429
expect(response.headers.get("Retry-After")).not.toBeNull();
```

Pin the clock with `setSystemTime` from `bun:test` when a case asserts an exact `reset` or `Retry-After`: both are measured from the window boundary, so they depend on when in the window the request landed.

## API

### `rateLimit(options: RateLimitMiddlewareOptions): Middleware`

Creates a middleware that counts the request, refuses it when the budget is gone, and annotates the response with the decision. Exported from `@pkg/rate-limit/middleware`.

**Parameters:**

- `options.adapter`: Backend that counts the attempts and owns the policy
- `options.key?`: Derives the identifier to limit on from the context; defaults to the client IP address, falling back to a shared `"unknown"` bucket
- `options.prefix?`: Namespace for this registration's keys; defaults to a name derived from registration order
- `options.cost?`: Budget units one request spends, as a number or a function of the context; defaults to `1`
- `options.skip?`: Predicate for requests to let through without counting
- `options.onLimit?`: Builds the response for a denied request, replacing the default JSON body
- `options.failurePolicy?`: `"open"` (default) or `"closed"`, applied when the backend cannot answer
- `options.logger?`: Resolves the logger for denied attempts and backend failures; defaults to `context.logger`

**Returns:**

- A `Middleware` from `remix/router`

**Example:**

```typescript
let limiter = rateLimit({
	adapter: new MemoryAdapter({ limit: 10, window: "10 seconds" }),
	skip: (context) => context.url.pathname === "/health",
	onLimit: (context, decision) => renderSlowDownPage(decision),
});
```

### `MemoryAdapter`

Fixed-window counters in a `Map` held by the instance. Counters are per process and per isolate, so this is for tests and local development, not for a deployed limit.

#### `new MemoryAdapter(options: MemoryAdapterOptions)`

**Parameters:**

- `options.limit`: Requests permitted per window
- `options.window`: Length of the counting window, as a `DurationInput`

#### `adapter.clear(): void`

Drops every counter, so one test's traffic cannot leak into the next when an instance is shared across cases.

### `CloudflareAdapter`

Wraps a Cloudflare rate limiter binding. The binding does the counting, which makes this the cheapest backend and the right default on Workers.

The binding answers only `{ success }`, so the limit and window are passed in as declared metadata mirroring the `simple: { limit, period }` block in `wrangler.jsonc`. From those the adapter computes `reset` and `retryAfter` and reports `limit`; `remaining` stays `null`, because the platform never exposes it. `reset()` always fails: the binding has no way to clear a key.

#### `new CloudflareAdapter(binding: RateLimiterBinding, options: CloudflareAdapterOptions)`

**Parameters:**

- `binding`: The rate limiter binding, e.g. `env.AUTH_RATE_LIMITER`
- `options.limit`: The binding's declared `limit`
- `options.window`: The binding's declared `period`, e.g. `"10 seconds"` for `period: 10`

**Example:**

```typescript
let adapter = new CloudflareAdapter(env.LOGIN_RATE_LIMITER, {
	limit: 10,
	window: "10 seconds",
});
```

### `KVAdapter`

Fixed-window counters in Workers KV, one entry per key and window, expiring through a KV TTL. Cheap and available without provisioning a limiter namespace, at the cost of exactness.

#### `new KVAdapter(kv: RateLimitKVNamespace, options: KVAdapterOptions)`

**Parameters:**

- `kv`: The KV namespace binding
- `options.limit`: Requests permitted per window
- `options.window`: Length of the counting window, also written as the entry's TTL
- `options.prefix?`: Namespace prefix for entry keys; defaults to `"rate-limit"`

Entries are keyed `prefix:key:window-start`, so a rollover needs no cleanup: the new window writes a different key and the old entry expires on its own. A window shorter than KV's own minimum TTL still writes with that minimum, which is harmless because the expired-but-present entry is never read again.

### `DataTableAdapter`

Sliding-window counters stored as rows through `remix/data-table`, so the same limiter runs on D1 and on Durable Object SQLite. This is the accurate option: the window slides with the clock, so there is no shared boundary for clients to stampede, and the rows are inspectable — an admin screen can show who is being limited and why. It costs a write per counted attempt, so it is not for the highest-traffic endpoints.

#### `new DataTableAdapter(db: Database, options: DataTableAdapterOptions)`

**Parameters:**

- `db`: A `remix/data-table` database whose schema includes the `rate_limit_hits` table
- `options.limit`: Requests permitted per window
- `options.window`: Length of the sliding window

### `rateLimitHits`

The `table()` definition `DataTableAdapter` queries: `id`, `bucket`, `cost`, and `created_at` (epoch milliseconds, so the window is integer arithmetic on every dialect). Exported so a host app can query the rows itself, for an admin screen or a sweep job.

### `RATE_LIMIT_HITS_SCHEMA_SQL`

The `create table` and `create index` statements the adapter needs, for a host app to paste into its own migration. The package ships the column contract and the queries; the migration belongs to the app.

```sql
create table rate_limit_hits (
	id text primary key,
	bucket text not null,
	cost integer not null,
	created_at integer not null
);

create index rate_limit_hits_bucket_created_at_idx on rate_limit_hits (bucket, created_at);
```

### `rateLimitHeaders(decision: RateLimitDecision, window: DurationInput): [string, string][]`

Serializes a decision into response header name and value pairs, omitting any field it cannot state truthfully.

**Parameters:**

- `decision`: The decision to describe
- `window`: The adapter's window, needed for the policy field's `w` parameter

**Returns:**

- Header pairs in the order they should be written, possibly empty

**Example:**

```typescript
rateLimitHeaders(decision, "10 seconds");
// [["RateLimit", "limit=10, remaining=0, reset=7"], ["RateLimit-Policy", "10;w=10"], ["Retry-After", "7"]]
```

### `applyRateLimitHeaders(response: Response, decision: RateLimitDecision, window: DurationInput): Response`

Writes those fields onto a response, falling back to an equivalent response when the original's headers reject mutation, as platform-produced responses do.

### `RateLimitError`

The failure value adapters report when their backend cannot answer. It carries `backend` and `key` so an outage is diagnosable from one log line, and the underlying error as `cause`.

A `RateLimitError` means "unknown", not "denied": it carries no decision, because whether an unavailable backend lets a request through is the caller's policy.

### Types

#### `RateLimitDecision`

```typescript
interface RateLimitDecision {
	allowed: boolean;
	/** Requests permitted per window, from adapter configuration. */
	limit: number;
	/** Requests left in the current window; `null` when the backend cannot report it. */
	remaining: number | null;
	/** When the current window resets. */
	reset: Date;
	/** Seconds until the window resets; used for `Retry-After`. */
	retryAfter: number;
}
```

#### `Adapter`

```typescript
interface Adapter {
	readonly limit: number;
	readonly window: DurationInput;
	consume(key: string, cost?: number): Promise<Result<RateLimitDecision, RateLimitError>>;
	reset(key: string): Promise<Result<void, RateLimitError>>;
}
```

#### `RateLimiterBinding`

The part of a Cloudflare rate limiter binding the adapter uses, declared structurally so a test can pass a double:

```typescript
interface RateLimiterBinding {
	limit(options: { key: string }): Promise<{ success: boolean }>;
}
```

#### `RateLimitKVNamespace`

The part of a KV namespace the adapter uses — `get`, `put` with `expirationTtl`, and `delete` — declared structurally for the same reason.

## Choosing A Backend

| Backend             | Counting                | Accuracy                          | Cost per request | Reports `remaining` |
| ------------------- | ----------------------- | --------------------------------- | ---------------- | ------------------- |
| `CloudflareAdapter` | Platform binding        | Per-location, platform-defined    | None             | No                  |
| `KVAdapter`         | Fixed window in KV      | Approximate under concurrency     | One read + write | Yes                 |
| `DataTableAdapter`  | Sliding window in SQL   | Exact except for in-flight writes | One write        | Yes                 |
| `MemoryAdapter`     | Fixed window in process | Exact, per isolate                | None             | Yes                 |

The choice must be deliberate per endpoint: a limit that behaves one way on the binding behaves slightly differently on KV, because a fixed window resets for every client at once while a sliding one frees budget gradually.

## Pattern: One Registration Per Protected Surface

Each limit is a registration, so the policy lives next to the routes it protects instead of inside them. Keys are prefixed per registration, so two limiters over the same backend keep independent counters even when they derive the same key.

```typescript
let tokenLimiter = rateLimit({
	adapter: new CloudflareAdapter(env.TOKEN_RATE_LIMITER, { limit: 20, window: "1 minute" }),
	prefix: "token",
	key: (context) => context.get(ClientId),
});

let loginLimiter = rateLimit({
	adapter: new CloudflareAdapter(env.LOGIN_RATE_LIMITER, { limit: 10, window: "10 seconds" }),
	prefix: "login",
});
```

Pass an explicit `prefix` whenever the keys are persisted or inspected. The default is derived from registration order, which is stable within a process but says nothing useful in a KV browser or a SQL query.

## Pattern: An HTML Page Instead Of JSON

The default limited response is the JSON error body an API client expects. A browser-facing surface overrides it, and the rate limit headers are still applied to whatever comes back:

```tsx
rateLimit({
	adapter,
	prefix: "signup",
	onLimit: (context, decision) =>
		render(<TooManyRequests retryAfter={decision.retryAfter} />, { status: 429 }),
});
```

## Pattern: Charging More For Expensive Work

`cost` spends more than one unit, so an expensive request consumes more of the same budget rather than needing its own limiter:

```typescript
rateLimit({
	adapter,
	prefix: "search",
	cost: (context) => (context.url.searchParams.has("deep") ? 5 : 1),
});
```

On `CloudflareAdapter` a cost above 1 issues that many binding calls, because the binding counts exactly one request per call. Keep costs small there, or use a backend that stores counts itself.

## Pattern: Failing Closed On A Surface That Must Not Leak

The default is fail open, so a storage outage cannot lock every client out. A surface where an uncounted request is worse than a refused one flips the policy per registration:

```typescript
rateLimit({ adapter, prefix: "credentials", failurePolicy: "closed" });
```

Either way the failure is logged — `rate_limit.unavailable`, with the backend and the policy that was applied — so the log says whether traffic was let through.

## Pattern: Sweeping A Sliding-Window Table

`DataTableAdapter` deletes a bucket's aged-out rows when that bucket is next consumed. A bucket that goes quiet keeps its last rows, so a table that accumulates many one-off keys wants a periodic sweep:

```typescript
import { rateLimitHits } from "@pkg/rate-limit";
import { lt } from "remix/data-table";

await db.deleteMany(rateLimitHits, { where: lt("created_at", Date.now() - toMs("1 hour")) });
```

## Related Packages

- [`@pkg/duration`](/packages/duration) - The `DurationInput` every window is expressed in
- [`@pkg/result`](/packages/result) - The `Result` adapters report failures with, and the `isSuccess`/`isFailure`/`unwrap` helpers for reading them
- [`@pkg/get-client-ip`](/packages/get-client-ip) - The default key derivation
- [`@pkg/http`](/packages/http) - Builds the `429` JSON response

## Tips

1. **Never limit on raw user input alone** - The middleware prefixes every key per registration; when you call an adapter directly, namespace the key yourself so two limits cannot share a counter.
2. **Pass an explicit `prefix` for persisted keys** - The generated default is stable within a process but meaningless to anyone reading KV entries or table rows later.
3. **Keep the declared binding metadata in step with `wrangler.jsonc`** - Drift does not break the limiting, but it makes every header wrong, which is worse than no header at all.
4. **Prefer an identity over an address on authenticated routes** - Clients behind one egress address share an IP, so an IP-keyed limit on an authenticated endpoint punishes the wrong tenant.
5. **Reach for `DataTableAdapter` when the limit must be explainable** - It is the only backend whose counters you can query, which is what an "am I being limited?" support question actually needs.
6. **Read the decision, not just the boolean** - `remaining` and `reset` are what let a well-behaved client back off before it is refused.
7. **Treat a `RateLimitError` as unknown, never as denied** - Fail open unless refusing is genuinely safer than letting an uncounted request through.
8. **Skip the limiter for traffic you control** - A health check counted against a shared bucket eats a real client's budget.
