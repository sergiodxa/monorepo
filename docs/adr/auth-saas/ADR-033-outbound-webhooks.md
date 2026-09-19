# ADR-033: Outbound Webhooks

## Status

**Proposed** - 2026-09-18

## Background

A tenant's own systems need to know when its directory changes: a subject is created and a CRM
record should follow, a subject is blocked and a seat should be released. Polling the management
API for that is a schedule the tenant maintains and a bill of requests neither side wants.

An outbound webhook inverts it: the tenant registers an endpoint, the platform posts each event as
it happens, and the tenant's system reacts. The pieces are already in the repo — `@sdxc/webhooks`
implements Standard Webhooks in both directions on `@sdxc/crypto`, and `@sdxc/jobs` declares jobs
in one map and runs them over Cloudflare Queues with retries, a timeout and a dead-letter queue.

This is the **Outbound Webhooks** add-on at $19 per tenant per month, on top of any tier including
Free. Its feature slug is `outbound_webhooks`, evaluated as `entitlement.outbound-webhooks`
through `ctx.flags` in the Worker.

## Context

### The event catalog already exists

*Audit Log and Retention* fixes a closed catalog of actions, written by the operation that caused
each one, inside the same storage transaction as the change. Those are precisely the durable facts
a tenant would subscribe to, and a second list beside it would drift on the first feature that
remembered one and forgot the other. So the subscribable event types are the audit catalog's
action keys, and a new webhook event is the same ADR-sized decision a new audit action is.

### Ordering is not a property a fan-out delivery can have

Two events a millisecond apart are two queue messages delivered by two invocations over two
connections, and a retry of the first arrives after the second by construction. Any promise of
order would be a promise to serialize delivery per endpoint, which makes one slow receiver a queue
for that tenant's whole event stream. The design states the guarantee it has and gives the
receiver what it needs to order events itself.

## Decision

### The records

```sql
CREATE TABLE webhook_endpoints (
  id TEXT PRIMARY KEY,               -- whep_… TypeID
  url TEXT NOT NULL, description TEXT NOT NULL,
  event_types TEXT NOT NULL,         -- JSON array of action keys, or ["*"]
  sealed_secret TEXT NOT NULL,       -- current signing secret, sealed
  sealed_previous TEXT, previous_expires_at INTEGER,   -- the outgoing secret, during a rotation
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  disabled_at INTEGER, disabled_reason TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE webhook_deliveries (
  id TEXT PRIMARY KEY,               -- whdl_… TypeID; the `webhook-id` header value
  endpoint_id TEXT NOT NULL, event_type TEXT NOT NULL,
  sequence INTEGER NOT NULL,         -- monotonic per tenant, across every endpoint
  payload TEXT NOT NULL,             -- the exact body the signature covers
  status TEXT NOT NULL,              -- "pending" | "delivered" | "exhausted"
  attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER,
  last_status INTEGER, last_error TEXT, last_attempt_at INTEGER, delivered_at INTEGER,
  created_at INTEGER NOT NULL, replay_of TEXT
);
CREATE INDEX webhook_deliveries_due ON webhook_deliveries (next_attempt_at) WHERE status = 'pending';
CREATE INDEX webhook_deliveries_by_endpoint ON webhook_deliveries (endpoint_id, created_at DESC, id);
```

### Registration and secrets

A registered URL is `https`, has a public hostname rather than a literal address, carries no
userinfo, and uses the default port; the object validates that at write time. Registration mints a
signing secret with `randomToken({ bytes: 32, prefix: "whsec" })`, returns it once, and stores it
sealed with `seal` from `@sdxc/crypto` under a key the object imports from a binding, so key
material is an envelope in a column rather than a readable value.

`rotateEndpointSecret` mints the successor and keeps the incumbent as `sealed_previous` for seven
days. Deliveries in that window are signed under both, which is exactly the list `Webhooks.verify`
accepts through its `secrets` option, so a receiver updates its configuration on its own schedule
with no rejected deliveries on either side.

### The payload, and where it is signed

A payload is `{ type, timestamp, sequence, data }`, where `data` carries the ids the event names
and a bounded projection of the record. A webhook is a notification that something happened, and
the management API is where the receiver reads current state, so a delivery stays small and
carries no credential, hash or token.

Signing happens inside the tenant object: `Webhooks.sign(payload, { secret, id, timestamp })`
returns the headers and the exact body the signature covers, so the Worker receives something
ready to POST and the secret stays where the tenant's signing keys stay.

### Delivery

The operation that causes an event writes its delivery rows in the same transaction as the change
and the audit row, and answers how many it wrote; the Worker then enqueues one `webhooks.deliver`
message per delivery through `@sdxc/jobs`. A cron job sweeps `webhook_deliveries_due` for rows
past `next_attempt_at` and enqueues them, so the table is the source of truth and the queue is an
accelerator: an enqueue lost to a Worker failure heals on the next sweep.

The handler calls `prepareDelivery`, POSTs the signed request with a 10-second timeout, and calls
`settleDelivery` with what came back. A 2xx is delivered; a 4xx, a 5xx, a timeout and a TLS
failure are attempts, and `settleDelivery` decides what happens next. Eight attempts run at 15
seconds, 1 minute, 5 minutes, 30 minutes, 2 hours, 6 hours and 12 hours after the first, which
reaches about a day. Each delay carries up to 20% jitter, so a receiver coming back after an outage is not met by every
pending delivery at once. The schedule lives in the object: `settleDelivery` answers
`{ next: "retry", delay } | { next: "exhausted" }`, which the handler turns into `ctx.retry({
delay })` or `ctx.exit(...)`. One ceiling in one place, and the queue counts nothing of its own, so
the platform dead-letter queue holds only messages the handler could not settle at all.

An eighth failed attempt marks the row `exhausted` and increments `consecutive_failures`; twenty
consecutive exhausted deliveries disable the endpoint, record the reason, and mail the tenant's
owners, because an endpoint nobody is fixing otherwise costs a POST a day forever. A delivered
response resets the counter.

### Replay, inspection, and what is guaranteed

`replayDelivery` writes a **new** delivery row carrying the same payload with a new id, a new
sequence and `replay_of` naming the original. A retry reuses its delivery id so a receiver
de-duplicating on `webhook-id` collapses the attempts of one delivery; a replay is a deliberate
second delivery, and reusing the id there asks the receiver to drop what the tenant asked for.
`readDeliveryPage` answers the delivery log the dashboard and the management API render: status,
attempts, response status, a 512-byte snippet of the body, and timings. Rows keep the tenant's
audit retention window and go out on the same daily sweep, since a delivery row is larger than an
audit row.

Delivery is **at least once and unordered**. A receiver is idempotent on `webhook-id` and orders
events by `sequence`, which is monotonic per tenant across every endpoint, so it can also see that
it is missing one. The `webhook-timestamp` header bounds replay and a `ReplayStore` on the
receiving side closes the window, which is what `@sdxc/webhooks` documents for a receiver.

### RPC methods

- `registerWebhookEndpoint({ url, description, eventTypes })` — validates, mints, seals, returns
  the record and the one-time secret; with `updateWebhookEndpoint`, `rotateEndpointSecret` and
  `deleteWebhookEndpoint` beside it.
- `prepareDelivery({ deliveryId, now })` — leases the row for this attempt, signs under every live
  secret, and answers `{ url, headers, body, attempt }`.
- `settleDelivery({ deliveryId, outcome, status, snippet, durationMs, now })` — records the
  attempt, schedules the next or exhausts the row, and disables the endpoint on a run of failures.
- `claimDueDeliveries({ before, limit })` — the ids the sweep enqueues; with
  `replayDelivery({ deliveryId, actor })`, `readDeliveryPage(input)` and
  `sweepWebhookDeliveries({ before, limit })` beside it.

Emitting an event is not among them: every operation in the catalog writes its own delivery rows,
for the reason the audit log has no `recordAuditEvent` — a method is a complete operation, and
"queue a notification" is a fragment of one.

`entitlement.outbound-webhooks` is evaluated where an endpoint is registered or updated, so a
lapsed subscription stops new endpoints while deliveries for those already registered keep
flowing.

## Consequences

### Positive

- The subscribable events and the audit catalog are one list, so neither can drift from the other.

### Negative

- Delivery costs two round trips to the object per attempt, so a busy tenant's deliveries compete
  with its own sign-ins for a single-threaded object.
- Ordering is the receiver's problem, and one that ignores `sequence` processes an update before
  the creation it describes.
- URL validation stops literal addresses and non-public hostnames at write time; a hostname that
  resolves inward later is not something a Worker sees.

### Neutral

- An endpoint disabled for repeated failure is re-enabled by the tenant, so recovery is explicit
  rather than a silent resumption weeks later.

## Alternatives Considered

**POST inline from the operation that caused the event.** No queue, no delivery table, no sweep,
and the receiver hears about it immediately. It puts a third party's availability inside the tenant
object's single thread, so a slow endpoint delays that tenant's sign-ins. Rejected.

**Ordered delivery, serialized per endpoint.** It is what a receiver wants, and it removes the
`sequence` field and the idempotency requirement. One slow receiver then stalls every later event
for that tenant, and the first retry reintroduces the problem anyway. Rejected in favour of
stating the guarantee honestly.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — whole operations, key material stays inside, bounded tables need retention
- [ADR-023: Audit Log and Retention](./ADR-023-audit-log-and-retention.md) — the closed catalog this subscribes to, and the retention window it shares
- [ADR-019: Plan Catalog and Feature Split](./ADR-019-plan-catalog-and-feature-split.md) — the `outbound_webhooks` slug and its price
- [ADR-020: Entitlements as Feature Flags](./ADR-020-entitlements-as-feature-flags.md) — how the gate is evaluated
- [root ADR-026: Standard Webhooks Parsing Package](../ADR-026-standard-webhooks-parsing-package.md) — `sign`, `verify` and the rotation shape used here
- [root ADR-054: Jobs Package with Queue Adapters](../ADR-054-jobs-package-with-queue-adapters.md) — the dispatcher, the queue adapter and the dead-letter path
