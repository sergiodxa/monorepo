# ADR-019: Adapter-Based Rate Limiting Package

## Status

**Accepted** - 2026-07-29

## Background

Rate limiting exists in exactly one app, as an app module wrapping five named Cloudflare rate limiter bindings. Every other public surface in the monorepo (the OIDC provider engine, the public JSON APIs, the unauthenticated cron ping endpoint) has no limiter at all, and one app declares rate limiter bindings that no source file consumes.

Rate limiting is also not a single-backend concern: the Cloudflare binding is the right default on Workers, but per-tenant limits and limits that must survive a namespace change are better expressed over Workers KV or a data-table-backed counter.

## Context

### Current State

| Location                              | State                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/auth/app/modules/rate-limit.ts` | `checkRateLimit(limiter, key)` over five binding names plus a fixed 429 response |
| `apps/auth/wrangler.jsonc`            | Five `ratelimits` bindings with `simple: { limit, period }`                      |
| `apps/auth-saas/wrangler.jsonc`       | Three `ratelimits` bindings declared, no code consumes them                      |
| `packages/oidc-provider`              | Token, authorization, and credential endpoints with no limiter                   |
| `apps/r3-uptime` public API and ping  | Token-authenticated and unauthenticated endpoints with no limiter                |

### Issues Identified

| Issue                                                     | Impact                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| The limiter lives in an app, not a package                | The OIDC provider package cannot protect its own endpoints                        |
| The binding is the only backend                           | No option for per-tenant or persisted counters                                    |
| Response headers are incomplete                           | Only `Retry-After`, and hardcoded to 60 seconds regardless of the real reset time |
| `checkRateLimit` returns a boolean                        | The caller cannot report limit, remaining, or reset                               |
| Every protected route repeats the check-then-respond code | Easy to add a route and forget the limiter                                        |

## Decision

Create `@pkg/rate-limit`: an adapter interface with Cloudflare binding, Workers KV, and data-table implementations, plus a middleware factory that receives an adapter and emits standard rate limit response headers.

### 1. Decision And Adapter Contract

```ts
export interface RateLimitDecision {
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

export interface Adapter {
	readonly limit: number;
	readonly window: DurationInput;
	consume(key: string, cost?: number): Promise<Result<RateLimitDecision, RateLimitError>>;
	reset(key: string): Promise<Result<void, RateLimitError>>;
}
```

Windows are expressed with `@pkg/duration` (ADR-027) so `"10 seconds"` and `"1 minute"` are typed values rather than raw numbers.

### 2. Adapters

#### CloudflareAdapter

```ts
let adapter = new CloudflareAdapter(env.AUTH_RATE_LIMITER, { limit: 10, window: "10 seconds" });
```

The binding only answers `{ success }`, so `limit` and `window` are passed in as declared metadata mirroring `wrangler.jsonc`. That lets the adapter compute `reset` and `retryAfter` and report `limit`, while `remaining` stays `null` because the backend does not expose it. The middleware omits headers it cannot compute truthfully rather than inventing numbers.

#### KVAdapter

Fixed-window counters in Workers KV, keyed by `prefix:key:window-start`, written with a KV TTL equal to the window. Cheap, eventually consistent, and enough for coarse abuse protection where a binding namespace is not warranted.

#### DataTableAdapter

Sliding-window counters through `remix/data-table`, so it works on both D1 (`@pkg/data-table-d1`) and Durable Object storage (`@pkg/data-table-sqlstorage`). This is the adapter for limits that need accuracy, per-tenant configuration, or inspectability (an admin screen showing who is being limited).

#### MemoryAdapter

In-process counters for tests and local development.

### 3. Middleware

```ts
import { rateLimit } from "@pkg/rate-limit/middleware";

let limiter = rateLimit({
	adapter: new CloudflareAdapter(env.AUTH_RATE_LIMITER, { limit: 10, window: "10 seconds" }),
	key: (ctx) => getClientIp(ctx.request) ?? "unknown",
});
```

The factory returns a `Middleware` from `remix/router`. Default key derivation uses `@pkg/get-client-ip`; authenticated surfaces pass a client id, token id, or tenant id instead. Options also cover `cost`, a `skip(ctx)` predicate, and an `onLimit(ctx, decision)` hook for a custom response (an HTML page instead of JSON, for example).

### 4. Response Headers

Allowed responses carry the IETF draft fields; limited responses add `Retry-After`:

```http
HTTP/1.1 429 Too Many Requests
RateLimit: limit=10, remaining=0, reset=7
RateLimit-Policy: 10;w=10
Retry-After: 7
```

The default limited response is `429` JSON built with `@pkg/http/response/json`, matching the existing `too_many_requests` error body so the OAuth endpoints keep their current contract.

### 5. Direct Use

Not every protected path is a route. The adapter is usable directly for jobs, queue consumers, and outbound-call budgets:

```ts
let decision = await adapter.consume(`alerts:${teamId}`);
if (isSuccess(decision) && !decision.value.allowed) return skipDelivery();
```

## Consequences

### Positive

- **Packages can protect themselves** - the OIDC provider engine can ship its own limiter defaults instead of relying on each host app.
- **Truthful headers** - clients learn the real reset time instead of a hardcoded 60 seconds.
- **Backend choice per limit** - binding for cheap global limits, data-table for accurate per-tenant limits, KV in between.
- **One place to change policy** - limits move from scattered route code into middleware registration.
- **Testable without Cloudflare** - `MemoryAdapter` covers unit tests; the binding mock (ADR-024) covers integration tests.

### Negative

- **Adapters have different accuracy guarantees** - a limit that behaves one way on the binding can behave slightly differently on KV, so the choice must be deliberate per endpoint.
- **The data-table adapter costs a write per request** - not appropriate for the highest-traffic endpoints.
- **Declared binding metadata can drift** - `wrangler.jsonc` and the adapter arguments must be kept in sync, and only the headers are wrong when they are not.

### Neutral

- **The existing app module is retired, not rewritten in place** - its five named limiters become five middleware registrations.
- **No distributed exactness** - Workers rate limiting is per-location by nature; that limitation is inherited, not introduced.

## Implementation Plan

### Phase 1: Core

**Priority:** High
**Estimated Effort:** 3 hours

1. Implement `Adapter`, `RateLimitDecision`, `RateLimitError`, and `MemoryAdapter` with tests.
2. Implement header serialization for the `RateLimit`, `RateLimit-Policy`, and `Retry-After` fields.

### Phase 2: Adapters

**Priority:** High
**Estimated Effort:** 4 hours

1. `CloudflareAdapter` over the binding.
2. `KVAdapter` fixed window.
3. `DataTableAdapter` sliding window with a schema contribution documented for host apps.

### Phase 3: Middleware And Adoption

**Priority:** Medium
**Estimated Effort:** 4 hours

1. Implement the `rateLimit()` middleware factory.
2. Replace the app rate-limit module with middleware registrations.
3. Add limiters to the OIDC provider endpoints, the public JSON API, and the unauthenticated ping endpoint.
4. Write the package README and add it to the root README table (ADR-017).

## Alternatives Considered

### 1. Extract The App Module As-Is

Move `checkRateLimit` into a package unchanged.

**Rejected because**: it hardcodes the binding backend, returns a boolean, and cannot produce correct headers, so the extraction would preserve every current limitation.

### 2. Durable Object Limiter

Implement a dedicated Durable Object as the only backend.

**Rejected because**: `@pkg/data-table-sqlstorage` already gives Durable-Object-backed counters through the data-table adapter, so a bespoke DO protocol adds a second storage path for the same guarantee.

### 3. Legacy `X-RateLimit-*` Headers

Emit `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.

**Rejected because**: the IETF draft fields are the direction of travel; `Retry-After` already covers the interoperable case. The `onLimit` hook can add legacy headers for a specific client if one ever needs them.

## References

- [IETF draft: RateLimit header fields for HTTP](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/)
- [RFC 9110 - HTTP Semantics, 429 Too Many Requests](https://datatracker.ietf.org/doc/html/rfc6585#section-4)
- [ADR-011: OIDC Provider Engine Package](./ADR-011-oidc-provider-engine-package.md)
- [ADR-027: Duration Package](./ADR-027-duration-package.md)
- [ADR-024: Cloudflare Binding Mocks Package](./ADR-024-cloudflare-binding-mocks-package.md)

## Current Progress

- [x] Phase 1: Core
- [x] Phase 2: Adapters
- [ ] Phase 3: Middleware And Adoption

## Notes

- The `DataTableAdapter` needs a table in the host app's schema; the package ships the column contract and the queries, not a migration.
- Keys must never be raw user input alone; the middleware prefixes keys per registration so two limiters cannot collide in the same namespace.
- Fail-open versus fail-closed is a per-registration option. The default is fail-open on adapter errors so a storage outage cannot lock every user out, and the decision is logged.
