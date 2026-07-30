# ADR-005: Replicate Polar Subscription State Into D1 via Webhooks

## Status

**Proposed** — 2026-07-30. Follows from [ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§17 (critical). Not a Cloudflare cost — a hard scaling wall and an availability bug.

## Context

The every-minute scheduler settles billing before enqueuing, so a queued check is always one
that is allowed to run. It does that by asking Polar, live, on every cron delivery:

```ts
let subscribed = await Customer.filterActiveSubscribers(polar, due.map((m) => m.ownerId));
let payable = due.filter((monitor) => subscribed.has(monitor.ownerId));
```

`filterActiveSubscribers` deduplicates owners, but still issues one `subscriptions.list`
request **per distinct owner per delivery**:

```ts
let results = await Promise.all(
  distinct.map(async (ownerId) => [ownerId, await Customer.hasActiveSubscription(polar, ownerId)] as const),
);
```

That is `43,200 × K` requests per owner per month. At K = 2 and 1,000 paying customers with a
monitor due, **86 million Polar API calls a month**, issued as a 1,000-wide `Promise.all` burst
every ~30 seconds. No API serves that, and Workers caps simultaneous outbound subrequests per
invocation regardless.

The failure mode is worse than the volume. `PolarClient.hasActiveSubscription` swallows every
error and returns `false`:

```ts
} catch {
  return false;
}
```

So the gate **fails closed**. A Polar outage, a rate-limit response, or an expired
`POLAR_ACCESS_TOKEN` makes every owner look unsubscribed, `payable` is empty, no messages are
enqueued, and **all monitoring silently stops** — for a product whose entire job is noticing
when things stop. Nothing alerts on it; the scheduler logs nothing on an empty `payable`.

Four call sites depend on this answer:

| Call site | Frequency | Latency-sensitive? |
|---|---|---|
| `bootstrap/worker.ts` scheduler, via `filterActiveSubscribers` | 43,200 × K / month | no — background |
| `app/http/controllers/app/team/monitor-card-usage.tsx:43` | every monitor-detail page view | yes — blocks a frame |
| `app/http/controllers/app/team/checkout.tsx:79` | on the checkout action | no — user-initiated |
| `app/data/monitor.ts:134` (`Monitor.ping`) | manual "run now" | mildly |

## Decision

**Polar stops being a read dependency. D1 becomes the source of truth for subscription state,
written by Polar webhooks.**

### 1. A `subscriptions` table

```sql
CREATE TABLE `subscriptions` (
  `id` text(36) PRIMARY KEY NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `external_customer_id` text NOT NULL,       -- the OIDC subject, = teams.owner_id
  `polar_subscription_id` text NOT NULL,
  `polar_product_id` text NOT NULL,
  `status` text NOT NULL,                     -- Polar's own status string
  `current_period_end` integer,
  `revoked_at` integer
);
CREATE UNIQUE INDEX `subscriptions_polar_subscription_idx` ON `subscriptions` (`polar_subscription_id`);
CREATE INDEX `subscriptions_customer_status_idx` ON `subscriptions` (`external_customer_id`, `status`);
```

Keyed on `external_customer_id` because that is what the app already uses as its own identity
(`Customer.findOrCreate` links the OIDC subject as Polar's `externalId`), and it equals
`teams.owner_id` — so no extra join hop. `polar_subscription_id` is unique so webhook
redelivery upserts rather than duplicates.

Per [ADR-010](./ADR-010-drop-redundant-duplicate-id-indexes.md), note there is deliberately no
`subscriptions_id_unique` index — the `PRIMARY KEY` already provides one.

### 2. A webhook route

`routes/web.ts` has no webhook entry today. Add `POST /webhooks/polar`, outside the
`requireUser`/`requireTeam` chain and outside the `cop` cross-origin protection (same treatment
`/api/` already gets via `insecureBypassPatterns`). `@pkg/polar` already ships verification:

```ts
let result = polar.parseWebhook(request, await request.text(), env.POLAR_WEBHOOK_SECRET);
```

`parseWebhook` returns a `Result` and fails closed on `WebhookVerificationError`, which is the
correct bias here — an unverified payload must never reach the upsert. Handle the subscription
lifecycle events (`subscription.created`, `.updated`, `.active`, `.canceled`, `.uncanceled`,
`.revoked`) with one upsert keyed by `polar_subscription_id`. Ignore everything else.

### 3. The scheduler stops checking at all

This is the part that removes the cost rather than moving it. Rather than filtering due
monitors by subscription every minute, **the webhook schedules and unschedules monitors
directly**, using the `next_due_at` column from
[ADR-003](./ADR-003-schedule-http-checks-from-next-due-at.md):

```sql
-- on subscription revoked/canceled: stop scheduling this owner's monitors
UPDATE monitors SET next_due_at = NULL, updated_at = ?
 WHERE team_id IN (SELECT id FROM teams WHERE owner_id = ?);

-- on subscription activated: resume immediately
UPDATE monitors SET next_due_at = ?, updated_at = ?
 WHERE team_id IN (SELECT id FROM teams WHERE owner_id = ?) AND enabled_at IS NOT NULL;
```

`next_due_at IS NULL` already means "not scheduled" in ADR-003, so subscription state is
enforced **at write time, once per billing event**, instead of at read time, 43,200 × K times a
month. ADR-003's claim query needs no subscription awareness, no join, and no extra rows read.

Polar API calls on the check path go from ~86 million a month to **zero**.

### 4. The remaining reads come from D1

`Customer.hasActiveSubscription(polar, ownerId)` becomes
`Subscription.isActive(db, ownerId, productId)` — one indexed lookup on
`subscriptions_customer_status_idx`, ≈2 rows read, $0.000000002. The three non-scheduler call
sites switch to it. `PolarClient.hasActiveSubscription` stays for reconciliation only.

### 5. A reconciliation job for missed webhooks

Webhooks get missed — a deploy mid-delivery, a 500, a signature-secret rotation. Add a daily
sweep that lists active subscriptions from Polar and repairs drift in both directions. This is
the "almost never" Polar query: one paginated list per day instead of 86 million point reads a
month. Log every repair at error level — a nonzero repair count means webhook delivery is
broken, which is exactly the thing that would otherwise be silent.

### 6. Fail open where the answer is still unknown

Split the two behaviours that currently share one return value. If the subscription state is
genuinely unknown — no row at all, and reconciliation has never run — treat it as **allowed**
and log it. Running a check for a lapsed customer costs $0.0000348; not running checks for
every paying customer costs the product's reason to exist. Keep the swallow-everything
behaviour in `Customer.cancelSubscriptions`, where team deletion must never be blocked by
Polar.

## KV as a read cache: evaluated, deferred

The dashboard does check this often, so KV is a fair question. On the numbers it loses to D1
here:

| Read path | Cost per read | Notes |
|---|---:|---|
| D1 indexed lookup (2 rows read) | **$0.000000002** | request already touches D1 via `requireTeam` |
| KV read | $0.000000500 | **250× more expensive** |

The one hot read is `monitor-card-usage.tsx`, and it is a fragment that already runs
`requireUser` + `requireTeam` — both of which hit D1 — and then calls
`Customer.getUsagePerMonthForMonitor`, a Polar **meter** request that dominates the frame's
latency by orders of magnitude. Making the subscription check 3 ms faster while a Polar API
call sits behind it buys nothing. `placement: { mode: "smart" }` is already set in
`wrangler.jsonc`, which co-locates the Worker with the D1 primary, so the D1 read is fast for
this app specifically.

**Recommendation: D1 only, for now.** Add KV in front of it when one of these becomes true:

- a subscription check is needed on a path that would otherwise touch D1 **zero** times (a
  public status page gating on account standing would qualify);
- read volume grows enough that D1 statement concurrency, not cost, is the constraint;
- the check needs to survive D1 being unavailable — KV is an independent failure domain, which
  is a real if narrow argument.

If it is added later, the webhook is already the single write point, so it becomes a
write-through: upsert D1, then `KV.put`. No read-path TTL guessing, no staleness window —
which is the property that makes this design better than caching Polar responses in the first
place.

## Consequences

- **The hard scaling wall goes away.** Polar call volume becomes a function of billing events
  plus one daily reconciliation, not of cron frequency. Growth past ~1,000 customers stops
  being blocked on a third party's rate limit.
- **A Polar outage no longer stops monitoring.** D1 holds the answer; Polar being down affects
  only new billing events, which reconciliation catches.
- **The 1,000-wide subrequest burst disappears** from the scheduler entirely.
- **No staleness window on the hot path.** Unlike a TTL cache, state changes the moment the
  webhook lands. The only staleness is a *missed* webhook, bounded by the reconciliation
  interval and detected by it.
- **New attack surface**: an unauthenticated public endpoint. It must verify signatures via
  `polar.parseWebhook` and reject on failure; `POLAR_WEBHOOK_SECRET` becomes a required secret
  (`wrangler secret put`, plus `.dev.vars` locally).
- **Subscription data now lives in two systems.** Polar remains authoritative for money; D1 is
  a projection for authorisation. Document that in the schema so nobody "fixes" a drift by
  editing D1.
- **Webhook handlers must be idempotent.** Polar retries, and events can arrive out of order.
  Upsert on `polar_subscription_id` and ignore an event whose payload is older than the stored
  `updated_at`.
- **Composes with ADR-003 and is best shipped after it.** Section 3 depends on `next_due_at`
  existing. Without ADR-003, this ADR still removes the API calls — the scheduler would filter
  `due` against a D1 subscription lookup instead — but the elegant version, where the scheduler
  does no subscription work at all, needs the column.
- Needs a test that the scheduler enqueues when subscription state is unknown, which is the
  behaviour this ADR inverts.
