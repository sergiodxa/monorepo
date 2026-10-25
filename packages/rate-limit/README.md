# @sdxc/rate-limit

Adapter-based rate limiting with standard response headers.

An adapter counts attempts against a key and answers a decision; the middleware spends that
budget for each request and writes the decision into the `RateLimit` and `RateLimit-Policy`
fields of
[draft-ietf-httpapi-ratelimit-headers-11](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers-11).
The same limit runs on a Cloudflare rate limiter binding, Workers KV, a SQL table or in process,
chosen per endpoint.

## Installation

```sh
npm add @sdxc/rate-limit
```

Windows are [`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration) values, adapters
answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), and the
`./middleware` entry point mounts on a [`remix`](https://www.npmjs.com/package/remix) v3 router.

## Usage

### Count an attempt

An adapter needs no request, so a job, a queue consumer or an outbound-call budget uses it
directly.

```typescript
import { MemoryAdapter } from "@sdxc/rate-limit";
import { isSuccess } from "@sdxc/result";

let adapter = new MemoryAdapter({ limit: 100, window: "1 minute" });

async function sendAlert(teamId: string) {
	let result = await adapter.consume(`alerts:${teamId}`);
	if (isSuccess(result) && !result.data.allowed) return; // over budget until result.data.reset
	await deliverAlert(teamId);
}
```

### Limit a router

`rateLimit` counts every request in scope before the handler runs and writes the quota onto the
response. `key` says what one budget belongs to: an authenticated identity is the strongest
choice — a token id, a client id, a tenant.

```typescript
import { CloudflareAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [
		rateLimit({
			adapter: new CloudflareAdapter(env.API_RATE_LIMITER, { limit: 20, window: "1 minute" }),
			prefix: "api",
			key: (context) => context.request.headers.get("X-Client-Id") ?? "anonymous",
		}),
	],
});
```

A denied request never reaches the handler:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
RateLimit: "default";r=0;t=37
RateLimit-Policy: "default";q=20;w=60
Retry-After: 37

{"error":"too_many_requests","error_description":"Rate limit exceeded. Please try again later."}
```

### Key anonymous callers by address

An anonymous endpoint keys on the connecting address. `addressKey` keeps an IPv4 address whole
and widens an IPv6 address to its `/64`, since one IPv6 client holds a whole `/64`; a missing
address lands in one shared `"unknown"` bucket.

```typescript
import { getClientIP } from "@sdxc/get-client-ip";
import { addressKey, MemoryAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";

let limiter = rateLimit({
	adapter: new MemoryAdapter({ limit: 60, window: "1 minute" }),
	prefix: "public",
	key: (context) => addressKey(getClientIP(context.request)),
});
```

### Answer a denial yourself

Outside the middleware, `tooManyRequests` builds the `429` with the same quota fields, and
`applyRateLimitHeaders` writes them onto any other response.

```typescript
import { applyRateLimitHeaders, MemoryAdapter, tooManyRequests } from "@sdxc/rate-limit";
import { isFailure } from "@sdxc/result";

let adapter = new MemoryAdapter({ limit: 5, window: "10 seconds" });

async function handle(request: Request, clientId: string): Promise<Response> {
	let result = await adapter.consume(`export:${clientId}`);
	if (isFailure(result)) return runExport(request);
	if (!result.data.allowed) {
		return tooManyRequests(result.data, adapter, JSON.stringify({ error: "slow_down" }), {
			headers: { "Content-Type": "application/json" },
		});
	}
	return applyRateLimitHeaders(await runExport(request), result.data, adapter);
}
```

### Name the policy

Both fields are Lists of Items named after the policy, so a client tells limiters apart.
Each registration names its own with `policy`, and nested limiters each add their Item:

```typescript
let burst = rateLimit({ adapter: burstAdapter, key, policy: "burst" });
let daily = rateLimit({ adapter: dailyAdapter, key, policy: "daily" });
// RateLimit: "burst";r=9;t=7, "daily";r=999;t=43200
// RateLimit-Policy: "burst";q=10;w=10, "daily";q=1000;w=86400
```

Outside the middleware, spread the adapter into a policy, and answer the draft's
`quota-exceeded` problem with `quotaExceeded`:

```typescript
import { quotaExceeded } from "@sdxc/rate-limit";

if (!result.data.allowed) return quotaExceeded(result.data, { ...adapter, name: "export" });
// 429 application/problem+json
// {"type":"https://iana.org/assignments/http-problem-types#quota-exceeded",…,"violated-policies":["export"]}
```

## API

### `Adapter`

The contract every backend implements: `limit`, `window`, `consume(key, cost?)` and
`reset(key)`, both answering a `Result` with a `RateLimitError` failure.

`consume` spends `cost` units (default 1, raised to a whole number of at least 1) and answers a
`RateLimitDecision`. A denied attempt spends nothing, so a client hammering a limited key never
pushes its own reset further away. `reset` clears the key so its next attempt starts a fresh
budget.

### Adapters

| Adapter             | Counting                | Accuracy                          | Reports `remaining` | `reset` |
| ------------------- | ----------------------- | --------------------------------- | ------------------- | ------- |
| `CloudflareAdapter` | Platform binding        | Per location, platform-defined    | No                  | Fails   |
| `KVAdapter`         | Fixed window in KV      | Approximate under concurrency     | Yes                 | Yes     |
| `DataTableAdapter`  | Sliding window in SQL   | Exact except for in-flight writes | Yes                 | Yes     |
| `MemoryAdapter`     | Fixed window in process | Exact, per isolate                | Yes                 | Yes     |

A fixed window frees every client's budget at once; a sliding one frees it gradually.

#### `new MemoryAdapter({ limit, window })`

Counters in a `Map` held by the instance, for tests and local development. `clear()` drops every
counter.

#### `new CloudflareAdapter(binding, { limit, window })`

Counts through a Cloudflare rate limiter binding. `limit` and `window` must match the binding's
own `limit` and `period`: the adapter derives `reset` and `retryAfter` from them, so a mismatch
keeps limiting correct and makes every header wrong. A cost above 1 calls the binding once per
unit.

#### `new KVAdapter(kv, { limit, window, prefix? })`

Fixed-window counters in a Workers KV namespace under `prefix:key:window-start`, expiring by TTL
(at least KV's 60-second minimum). `prefix` defaults to `"rate-limit"`.

#### `new DataTableAdapter(db, { limit, window })`

Sliding-window counters as rows in `rate_limit_hits` through `remix/data-table`, one row per
counted attempt. Aged-out rows are deleted when their bucket is next consumed.

#### `rateLimitHits` and `RATE_LIMIT_HITS_SCHEMA_SQL`

The `table()` definition the adapter queries (`id`, `bucket`, `cost`, `created_at` in epoch
milliseconds), and the `create table` plus `(bucket, created_at)` index to paste into your own
migration.

### `rateLimit(options): Middleware`

From `@sdxc/rate-limit/middleware`. Counts the request before `next()`, refuses it when the
budget is gone, and writes the decision onto whatever response comes back.

- `adapter`: the backend that counts
- `key(context)`: what one budget belongs to; required
- `prefix?`: namespace prepended as `prefix:key`; defaults to a name from registration order, so
  pass one whenever keys are persisted or inspected
- `cost?`: units one request spends, a number or a function of the context; defaults to `1`
- `skip?(context)`: lets a request through uncounted
- `onLimit?(context, decision)`: builds the denial response; the rate limit headers are added to it
- `failurePolicy?`: `"open"` (default) lets a request through when the backend cannot answer,
  `"closed"` refuses it with a `429` carrying no rate limit headers
- `policy?`: the policy name the fields carry; defaults to `"default"`

It logs `rate_limit.exceeded` on a denial and `rate_limit.unavailable` on a backend failure
through [`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger); the key stays out of the
log.

### `rateLimitHeaders(decision, policy): [string, string][]`

The header pairs for a decision, in write order: `RateLimit` with `r` (remaining) and `t`
(seconds to reset), `RateLimit-Policy` with `q` (limit), `w` (window seconds) and, when the
policy sets them, `qu` and `pk`. `RateLimit` is left out when an allowed request's remaining
count is unknown (a denial reports `r=0`), and `Retry-After` appears only on a denial.

```typescript
rateLimitHeaders(decision, adapter);
// [["RateLimit", '"default";r=0;t=7'], ["RateLimit-Policy", '"default";q=10;w=10'], ["Retry-After", "7"]]
```

### `applyRateLimitHeaders(response, decision, policy): Response`

Writes those headers onto a response, keeping other policies' Items already there and the
longer `Retry-After`, and answering an equivalent copy when its headers are immutable.

### `tooManyRequests(decision, policy, body?, init?): Response`

A `429 Too Many Requests` with the decision's headers. The status always wins over `init`, and
the body keeps whatever `Content-Type` the caller set.

### `quotaExceeded(decision, policy, detail?, init?): Response`

A `429` `application/problem+json` of type `QUOTA_EXCEEDED_TYPE`, listing the policy name in
`violated-policies`, with the decision's headers.

### `addressKey(address): string`

The budget key for a parsed address: its `/32` (IPv4) or `/64` (IPv6) network in canonical text,
or `UNKNOWN_ADDRESS_KEY` (`"unknown"`) for `null` or `undefined`. Any value with
`network({ v4, v6 })`, such as the `IP` from
[`@sdxc/get-client-ip`](https://www.npmjs.com/package/@sdxc/get-client-ip) or
[`@sdxc/ip`](https://www.npmjs.com/package/@sdxc/ip), fits.

### `RateLimitError`

The failure an adapter answers when its backend cannot, with `backend` (`"memory"`,
`"cloudflare"`, `"kv"` or `"data-table"`), the prefixed `key` and the original error as `cause`.
It carries no decision: whether to let the request through is the caller's call.

### Types

- `RateLimitDecision`: `allowed`, `limit`, `remaining` (`null` when the backend cannot report it),
  `reset` (a `Date`) and `retryAfter` (seconds).
- `RateLimitPolicy`: `window`, plus optional `name` (`DEFAULT_POLICY_NAME`, `"default"`),
  `quotaUnit` and `partitionKey` (a `Uint8Array`). Every `Adapter` is one.
- `QuotaUnit`: `"requests" | "content-bytes" | "concurrent-requests"`.
- `FailurePolicy`: `"open" | "closed"`, from `./middleware`.
- `RateLimiterBinding` and `RateLimitKVNamespace`: the slice of a rate limiter binding and a KV
  namespace the adapters use, so a real binding or a test double fits.
- `RateLimitAddress`: what `addressKey` accepts. `RateLimitHitRow`: one loaded
  `rate_limit_hits` row. `RateLimitBackend`: the backend names.
- `MemoryAdapterOptions`, `CloudflareAdapterOptions`, `KVAdapterOptions`,
  `DataTableAdapterOptions`, `RateLimitErrorOptions` and, from `./middleware`,
  `RateLimitMiddlewareOptions`.

## Pattern: One Limiter Per Protected Surface

Each registration has its own prefix, so two limiters over one backend keep separate counters
even when they derive the same key.

```typescript
import { getClientIP } from "@sdxc/get-client-ip";
import { addressKey, CloudflareAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { createRouter } from "remix/router";

let tokenLimiter = rateLimit({
	adapter: new CloudflareAdapter(env.TOKEN_RATE_LIMITER, { limit: 20, window: "1 minute" }),
	prefix: "token",
	key: (context) => context.request.headers.get("X-Client-Id") ?? "anonymous",
});

let loginLimiter = rateLimit({
	adapter: new CloudflareAdapter(env.LOGIN_RATE_LIMITER, { limit: 10, window: "10 seconds" }),
	prefix: "login",
	key: (context) => addressKey(getClientIP(context.request)),
});

let router = createRouter();
router.map(routes.token, { middleware: [tokenLimiter], handler: issueToken });
router.map(routes.login, { middleware: [loginLimiter], handler: logIn });
```

## Pattern: Weighted Costs, Exemptions And An HTML Denial

`cost` charges expensive requests more, `skip` exempts trusted ones, and `onLimit` answers a page
instead of JSON while the middleware still adds the headers.

```typescript
import { KVAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";

let searchLimiter = rateLimit({
	adapter: new KVAdapter(env.RATE_LIMITS, { limit: 100, window: "1 hour", prefix: "search" }),
	prefix: "search",
	key: (context) => context.request.headers.get("X-Account-Id") ?? "anonymous",
	cost: (context) => (new URL(context.request.url).searchParams.has("export") ? 10 : 1),
	skip: (context) => context.request.headers.get("X-Health-Check") === "1",
	onLimit: (_context, decision) =>
		new Response(`<h1>Slow down</h1><p>Try again in ${decision.retryAfter} seconds.</p>`, {
			status: 429,
			headers: { "Content-Type": "text/html" },
		}),
});
```

## Pattern: Failing Closed

The default lets traffic through when the backend is down, so an outage never locks every
client out. A surface where an uncounted request is worse than a refused one flips it.

```typescript
import { getClientIP } from "@sdxc/get-client-ip";
import { addressKey, KVAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";

let passwordResetLimiter = rateLimit({
	adapter: new KVAdapter(env.RATE_LIMITS, { limit: 5, window: "15 minutes" }),
	prefix: "password-reset",
	key: (context) => addressKey(getClientIP(context.request)),
	failurePolicy: "closed",
});
```

The `rate_limit.unavailable` log entry names the backend and the policy applied, so the log
says whether traffic flowed.

## Pattern: A Sliding Window In SQL

`DataTableAdapter` runs on any database `remix/data-table` speaks, and its rows can be queried
to show who is being limited. Add the schema to a migration, and sweep buckets that went quiet,
since rows are pruned only when their bucket is consumed again.

```typescript
import { DataTableAdapter, RATE_LIMIT_HITS_SCHEMA_SQL, rateLimitHits } from "@sdxc/rate-limit";
import { eq, lt } from "remix/data-table";

// migrations/0007_rate_limit_hits.sql holds RATE_LIMIT_HITS_SCHEMA_SQL verbatim

let adapter = new DataTableAdapter(db, { limit: 30, window: "1 minute" });

let recent = await db.findMany(rateLimitHits, { where: eq("bucket", "login:203.0.113.42/32") });

await db.deleteMany(rateLimitHits, { where: lt("created_at", Date.now() - 60_000) });
```

## Pattern: Lifting A Limit After Success

`reset` clears a key, so a successful login can forgive the failed attempts before it.

```typescript
import { KVAdapter } from "@sdxc/rate-limit";
import { isSuccess } from "@sdxc/result";

let failedLogins = new KVAdapter(env.RATE_LIMITS, { limit: 5, window: "15 minutes" });

async function logIn(email: string, password: string): Promise<Response> {
	let key = `login:${email.toLowerCase()}`;
	let attempt = await failedLogins.consume(key);
	if (isSuccess(attempt) && !attempt.data.allowed) return new Response(null, { status: 429 });

	if (!(await verifyPassword(email, password))) return new Response(null, { status: 401 });

	await failedLogins.reset(key);
	return startSession(email);
}
```

## Pattern: Testing A Limited Route

`MemoryAdapter` counts exactly within one process, and `clear()` keeps one test's traffic
out of the next.

```typescript
import { MemoryAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { createRouter } from "remix/router";
import { afterEach, expect, test } from "vitest";

let adapter = new MemoryAdapter({ limit: 2, window: "1 minute" });
let router = createRouter({
	middleware: [rateLimit({ adapter, prefix: "test", key: () => "client" })],
});
router.get("/", () => new Response("ok"));

afterEach(() => adapter.clear());

test("the third request is refused", async () => {
	await router.fetch(new Request("https://example.com/"));
	await router.fetch(new Request("https://example.com/"));
	let response = await router.fetch(new Request("https://example.com/"));
	expect(response.status).toBe(429);
	expect(response.headers.get("RateLimit-Policy")).toBe('"default";q=2;w=60');
});
```

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
