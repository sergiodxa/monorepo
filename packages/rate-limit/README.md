# @sdxc/rate-limit

Adapter-based rate limiting with standard response headers.

An `Adapter` counts attempts against a key and answers a decision; the middleware spends that budget for a request and serializes the decision into the IETF draft `RateLimit` fields. Because the counting sits behind one interface, the same limit runs on a platform binding, on a key-value store, on a SQL table, or in process — chosen per endpoint.

## Installation

```bash
npm add @sdxc/rate-limit
```

The middleware mounts on a [`remix`](https://www.npmjs.com/package/remix) (v3) fetch router, which installs alongside this package, together with [`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration), [`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger) and [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).

Two entry points:

- `@sdxc/rate-limit` — the `Adapter` contract, the four backends, `RateLimitError`, header serialization, and the `429` builder. No router dependency.
- `@sdxc/rate-limit/middleware` — the `rateLimit` middleware for `remix/router`.

## Usage

### Counting An Attempt

An adapter needs no request, so jobs, queue consumers, and outbound-call budgets use it directly. Windows are [`DurationInput`](https://www.npmjs.com/package/@sdxc/duration) values, and failures come back as a [`Result`](https://www.npmjs.com/package/@sdxc/result) rather than an exception.

```typescript
import { MemoryAdapter } from "@sdxc/rate-limit";
import { isSuccess } from "@sdxc/result";

let adapter = new MemoryAdapter({ limit: 100, window: "1 minute" });

let result = await adapter.consume(`alerts:${teamId}`);
if (isSuccess(result) && !result.data.allowed) return skipDelivery();
```

### Limiting Routes

Every request in scope is counted before the handler runs, and the response carries the quota it saw.

```typescript
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

A denied request never reaches the handler:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
RateLimit: limit=20, reset=37
RateLimit-Policy: 20;w=60
Retry-After: 37

{"error":"too_many_requests","error_description":"Rate limit exceeded. Please try again later."}
```

`key` says what one budget belongs to, and every registration states it. There is no default,
because the wrong answer is expensive in both directions: too broad a key lets one caller
spend another's budget, and a key the caller controls lets it mint fresh budgets. An identity
the request already authenticated is the strongest choice — a token id, a client id, a tenant.
An anonymous endpoint has the connecting address, which the platform reports in a header of
its own:

```typescript
rateLimit({
	adapter,
	prefix: "public",
	key: (context) => context.request.headers.get("CF-Connecting-IP") ?? "unknown",
});
```

Return one shared bucket rather than skipping the limit for a request you cannot identify, so
an unidentified caller still spends something. Callers sharing an egress address then share a
budget, which is the cost of keying on an address at all.

## API

### `Adapter`

The contract every backend implements, and the type a call site programs against. Nothing in it knows about HTTP.

```typescript
interface Adapter {
	readonly limit: number;
	readonly window: DurationInput;
	consume(key: string, cost?: number): Promise<Result<RateLimitDecision, RateLimitError>>;
	reset(key: string): Promise<Result<void, RateLimitError>>;
}
```

`consume` spends `cost` units of the key's budget, defaulting to 1; a cost below 1 or fractional is raised to a whole 1. A denied attempt spends nothing, so a client that keeps hammering a limited key cannot push its own reset further away. Keys are namespaced by the caller, never raw user input alone.

### `RateLimitDecision`

What one `consume` call answers. Every field except `remaining` is always populated, so a caller can report a limit and a reset without knowing which storage produced them.

```typescript
interface RateLimitDecision {
	allowed: boolean;
	limit: number;
	/** `null` when the backend cannot report it. */
	remaining: number | null;
	reset: Date;
	/** Seconds until the window resets; used for `Retry-After`. */
	retryAfter: number;
}
```

### Adapters

| Adapter             | Counting                | Accuracy                          | Cost per request | Reports `remaining` |
| ------------------- | ----------------------- | --------------------------------- | ---------------- | ------------------- |
| `CloudflareAdapter` | Platform binding        | Per-location, platform-defined    | None             | No                  |
| `KVAdapter`         | Fixed window in KV      | Approximate under concurrency     | One read + write | Yes                 |
| `DataTableAdapter`  | Sliding window in SQL   | Exact except for in-flight writes | One write        | Yes                 |
| `MemoryAdapter`     | Fixed window in process | Exact, per isolate                | None             | Yes                 |

The choice belongs per endpoint: a fixed window frees every client's budget at once, while a sliding one frees it gradually, so the same limit behaves differently on each.

#### `new MemoryAdapter({ limit, window })`

Fixed-window counters in a `Map` held by the instance. Counters are per process and per isolate, so this is for tests and local development, not for a deployed limit. `adapter.clear()` drops every counter, keeping one test's traffic out of the next.

#### `new CloudflareAdapter(binding, { limit, window })`

Wraps a Cloudflare rate limiter binding, which does the counting. The binding answers only `{ success }`, so `limit` and `window` are declared metadata mirroring the binding's own `limit` and `period`: from them the adapter computes `reset` and `retryAfter`, `remaining` stays `null`, and `reset()` always fails because the binding cannot clear a key. Drift between the declared metadata and the binding leaves limiting correct and every header wrong.

A cost above 1 issues that many binding calls and stops at the first refusal, since the binding counts exactly one request per call.

#### `new KVAdapter(kv, { limit, window, prefix? })`

Fixed-window counters in a Workers KV namespace, keyed `prefix:key:window-start` and expiring through a TTL. `prefix` defaults to `"rate-limit"`, so unrelated limiters can share one namespace. A rollover needs no cleanup: the new window writes a different key and the old entry expires on its own. The counter is read, incremented, and written back, so concurrent requests can double-count. A window shorter than KV's minimum TTL still writes with that minimum, which is harmless because the expired-but-present entry is never read again.

#### `new DataTableAdapter(db, { limit, window })`

Sliding-window counters stored as rows through `remix/data-table`, so the same limiter runs on any dialect the query layer speaks. The window slides with the clock, so there is no shared boundary to stampede, and the rows are inspectable — an admin screen can show who is being limited and why. It costs a write per counted attempt. `db` is a database whose schema includes the `rate_limit_hits` table. Aged-out rows are deleted when their bucket is next consumed, so a bucket that goes quiet keeps its last rows until a periodic sweep removes them.

#### `rateLimitHits`

The `table()` definition `DataTableAdapter` queries — `id`, `bucket`, `cost` and `created_at` (epoch milliseconds, so the window is integer arithmetic on every dialect). Exported so a host app can query the rows itself. `RateLimitHitRow` is one loaded row.

#### `RATE_LIMIT_HITS_SCHEMA_SQL`

The `create table` statement for those columns, plus a `create index` over `(bucket, created_at)` in query order, as a string for a host app to paste into its own migration. The package ships the column contract and the queries; the migration belongs to the app.

### `rateLimitHeaders(decision, window): [string, string][]`

Serializes a decision into header name and value pairs, in the order they should be written.

```typescript
rateLimitHeaders(decision, "10 seconds");
// [["RateLimit", "limit=10, remaining=0, reset=7"], ["RateLimit-Policy", "10;w=10"], ["Retry-After", "7"]]
```

A field the adapter cannot compute is left out entirely, so every number that ships is one the backend measured: `remaining` is absent when the decision reports `null`, `RateLimit-Policy` needs a finite limit and a positive window, and `Retry-After` appears only on a denied attempt, since that is the only time "try again" applies. The result may be empty.

### `applyRateLimitHeaders(response, decision, window): Response`

Writes those fields onto a response, falling back to an equivalent response when the original's headers reject mutation, as platform-produced responses do.

### `tooManyRequests(decision, window, body?, init?): Response`

Builds the `429` a denied request answers with, carrying the quota fields the decision
supports. The decision travels with the response because those fields are what a client
reads to back off, so no denial this builds can omit them. The status holds against an `init`
that disagrees, and no media type is added, so the body arrives labelled the way the caller
labelled it — which is what lets a limited page answer HTML where a limited API answers JSON.

```typescript
tooManyRequests(decision, adapter.window, JSON.stringify({ error: "too_many_requests" }), {
	headers: { "Content-Type": "application/json" },
});

tooManyRequests(decision, adapter.window, "<h1>Slow down</h1>", {
	headers: { "Content-Type": "text/html" },
});
```

The fields it writes are the ones `rateLimitHeaders` would: a number the backend cannot
report stays absent rather than being invented.

### `RateLimitError`

The failure value adapters report when their backend cannot answer. It carries `backend` (`"memory"`, `"cloudflare"`, `"kv"` or `"data-table"`) and `key` so an outage is diagnosable from one log line, plus the underlying error as `cause`.

It means "unknown", not "denied": it carries no decision, because whether an unavailable backend lets a request through is the caller's policy.

### `RateLimiterBinding` and `RateLimitKVNamespace`

The parts of a rate limiter binding (`limit({ key })`, answering `{ success }`) and of a KV namespace (`get`, `put` with `expirationTtl`, `delete`) the adapters use, declared structurally so a test can pass a double and importing this package needs no platform types.

### `rateLimit(options): Middleware`

From `@sdxc/rate-limit/middleware`. Counts the request before `next()`, refuses it when the budget is gone, and annotates whatever response comes back with the decision.

- `adapter`: Backend that counts the attempts and owns the policy
- `key`: Derives the identifier to limit on from the context. Required
- `prefix?`: Namespace for this registration's keys, prepended as `prefix:key`; defaults to a name derived from registration order
- `cost?`: Budget units one request spends, as a number or a function of the context; defaults to `1`
- `skip?`: Predicate for requests to let through without counting
- `onLimit?`: Builds the response for a denied request, replacing the default JSON body and its media type; the headers are applied to it either way
- `failurePolicy?`: `"open"` (default) or `"closed"`, applied when the backend cannot answer

The limited key stays out of the log, since it may carry a token or a client identifier; the limit, the remaining budget, and a `rate_limit.exceeded` warning are recorded.

### `FailurePolicy`

`"open" | "closed"` — what happens when the backend cannot answer.

### Option Types

Each constructor's options ship as a named type — `MemoryAdapterOptions`, `CloudflareAdapterOptions`, `KVAdapterOptions`, `DataTableAdapterOptions`, `RateLimitMiddlewareOptions` from `./middleware` — alongside `RateLimitErrorOptions` and `RateLimitBackend`, the closed union of backend names a `RateLimitError` reports.

## Pattern: One Registration Per Protected Surface

Each limit is a registration, so the policy lives next to the routes it protects instead of inside them. Keys are prefixed per registration, so two limiters over one backend keep independent counters even when they derive the same key.

```typescript
import { CloudflareAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";

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

## Pattern: Failing Closed On A Surface That Must Not Leak

The default is fail open, so a storage outage cannot lock every client out. A surface where an uncounted request is worse than a refused one flips the policy per registration.

```typescript
import { rateLimit } from "@sdxc/rate-limit/middleware";

rateLimit({ adapter, prefix: "credentials", failurePolicy: "closed" });
```

Either way the outage is logged as `rate_limit.unavailable` with the backend and the policy that was applied, so the log says whether traffic was let through. A fail-closed refusal carries no rate limit headers, because there is no decision to describe.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/rate-limit": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
