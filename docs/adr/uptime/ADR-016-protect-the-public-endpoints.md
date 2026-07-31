# ADR-016: Cache the Status Page and Rate-Limit the Heartbeat Endpoint by Caller

## Status

**Accepted** — implemented 2026-07-30. Follows from
[ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§12 and §17 (low). Low cost per hit, attacker-reachable in volume.

## Context

Two routes are reachable without authentication. Both are deliberate; neither is bounded.

### The cron-job ping endpoint

`POST /api/v1/cron-jobs/:cronJobId/ping` is unauthenticated by design — the controller's
docblock is explicit that "a scheduled job's `curl` call is the entire integration" and that the
monitor's own id is the bearer secret. That is a reasonable design. What is missing is a limit on
the _caller_:

```ts
if (monitor.last_ping_at !== null && Date.now() - monitor.last_ping_at < RATE_LIMIT_MS) {
	return tooManyRequests({ error: "Rate limit exceeded. Max 1 ping per minute." });
}
```

The limit is enforced **per monitor**, from `last_ping_at`, and only _after_ the request has
already:

1. run the full global middleware stack — including `createInstance()` +
   `init({ resources })` on six locale bundles, ~614 KB, which ADR-002 §7 identifies as the
   largest single per-request CPU item in the app;
2. performed a D1 lookup (`CronJobMonitor.findById`).

So a caller who sends 1,000 requests/second to a valid monitor id gets 1,000 rejections — and
pays for 1,000 Worker requests, 1,000 × ~8 ms CPU, and 1,000 D1 lookups. Per rejected request
that is roughly $0.0000005, so a sustained 1,000/s costs ~$1.30/hour. Not ruinous, and not free.
For an invalid id it is the same cost minus nothing — the lookup still runs.

### The public status page

`GET /:slug` (`app/http/controllers/status-page.tsx`) is public and serves
`getTeamHttpSummaries(page.team_id)`, which is KV-cached with a 60-second TTL via
`queryAnalyticsCached`. So the expensive part is bounded already: at most one AE query per team
per minute. Each _view_ still costs a Worker request, the middleware stack, a D1 lookup for the
page and its monitor associations, and a KV read — ~$0.0000008. The response carries **no HTTP
cache headers**, so every viewer, and every refresh, is an origin hit.

`@pkg/http/cache` exists precisely for this and is unused here: `Policies`, `policy`, `etag`,
`conditional`, `lastModified` ([ADR-022](../ADR-022-http-cache-policies-and-conditional-responses.md)).

## Decision

### 1. Rate-limit the ping route by caller, before the expensive work

`@pkg/rate-limit` ships a `rateLimit` middleware whose `key` defaults to the client IP and whose
`failurePolicy` defaults to `"open"` — both correct here:

```ts
router.map(
	routes.api.cronJobPing,
	createAction(routes.api.cronJobPing, {
		middleware: [
			rateLimit({
				adapter: new CloudflareAdapter(env.RATE_LIMITER),
				prefix: "cron-ping",
				// key defaults to the client IP
			}),
		],
		handler: cronJobPing,
	}),
);
```

Keep the existing per-monitor `last_ping_at` check — it enforces the product rule ("max 1 ping
per minute" per monitor) and must stay. The new limiter enforces a _caller_ rule, which is the
one that bounds abuse. Two limits, two purposes.

Adapter choice matters: `KVAdapter` costs a KV read plus a write per counted request
(~$0.0000055), which is **more than the request it protects**. `CloudflareAdapter` over a
`RATE_LIMITER` binding is the right pick — it is designed for this and does not bill per
operation. Use `KVAdapter` only if the binding is unavailable, and then set a generous limit so
the common case is not counted.

Because the limiter is middleware, it runs before the i18n initialisation and the D1 lookup, so
a rejected request costs a fraction of one today.

### 2. Also skip i18n on the JSON API routes

The deeper fix for the ping endpoint's cost is that it should never have paid for six locale
bundles to return `{ wasOnTime }`. That is
[ADR-017](./ADR-017-one-i18next-instance-per-isolate.md)'s subject, and it helps every route
rather than just this one. Rate limiting bounds the blast radius; ADR-017 lowers the floor.

### 3. Give the status page an HTTP cache policy

```ts
// public, short-lived, revalidatable — `policy()` takes options and returns a
// `remix/headers` CacheControl, which the caller sets on the response itself
response.headers.set(
	"cache-control",
	String(policy({ visibility: "public", maxAge: 60, staleWhileRevalidate: 300 })),
);
```

Sixty seconds matches the KV cache TTL the underlying AE query already uses, so the page cannot
be staler than its own data source. `staleWhileRevalidate` means a burst of viewers during an
incident — exactly when a status page gets traffic — is served from cache while one request
refreshes. Add `etag` + `conditional` so a repeat viewer gets a 304 rather than a full body.

This turns the status page from "one origin hit per view" into "one origin hit per minute per
page, plus 304s", which is the shape a status page should have.

### 4. Do not gate the status page on subscription standing

Tempting, since a lapsed customer's status page still serves. Rejected: a status page going dark
is a worse failure than serving slightly stale uptime data, and it would put a subscription check
on an unauthenticated hot path — the one case
[ADR-005](./ADR-005-replicate-polar-subscriptions-into-d1.md) identifies as actually justifying
a KV read. Revisit only if abuse shows up.

## Consequences

- **Sustained abuse of the ping endpoint becomes bounded** at the limiter's window instead of at
  the caller's willingness to keep sending, and each rejected request costs a fraction of
  today's.
- **Status-page origin load drops to ~1 request per minute per page**, regardless of viewer
  count. During an incident — when traffic spikes and the origin is least able to absorb it —
  that is the difference that matters.
- **Adds a `RATE_LIMITER` binding** to `wrangler.jsonc`, or a KV fallback with a generous limit.
  Getting this wrong makes the protection cost more than the attack.
- **Legitimate callers behind shared NAT share an IP bucket.** A CI provider running many jobs
  from one egress IP could be limited as one caller. Set the limit well above plausible
  legitimate use (the per-monitor rule already caps useful throughput at 1/minute/monitor, so
  the caller limit only needs to stop abuse, not shape traffic), and consider keying on the
  monitor id _in addition to_ the IP so one noisy tenant cannot exhaust another's budget.
- **A cached status page can show stale state for up to 60 seconds.** Acceptable and already
  true — the KV-cached AE query has the same TTL — but it should be stated on the page rather
  than implied.
- **Both changes are independent** of ADR-003 through ADR-015 and of each other; either can ship
  alone.
- Neither is urgent at current traffic. This ADR exists so the exposure is a known, priced
  decision rather than a surprise line on a bill.
