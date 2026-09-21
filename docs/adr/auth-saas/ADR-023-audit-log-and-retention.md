# ADR-023: Audit Log and Retention

## Status

**Proposed** - 2026-09-18

## Background

A tenant's directory changes all day: a member invites another, an administrator blocks a
subject, a client secret is rotated, a password is reset. The people accountable for that
directory get asked — routinely, and sometimes urgently — who did a particular thing and when.
Answering that needs a record written at the moment the change happened.

The platform's own request logs are a different artifact: keyed by infrastructure, carrying
cross-tenant detail, retained on whatever schedule suits debugging. They are the platform's
operational record and they stay that.

Audit log is a base capability, on every tier including Free, because a directory whose history
the customer cannot read is a directory they cannot be accountable for. The tier buys depth:
7 days on Free, 30 on Pro, 90 on Premium. Retention is a plan attribute, which is why this lands
beside the tiers.

## Context

### The log is tenant data, so it lives in tenant storage

Every row names a subject, a member, a client or a key belonging to exactly one tenant. Putting
those rows in the tenant's own Durable Object keeps [ADR-001](./ADR-001-auth-saas-on-per-tenant-durable-objects.md)'s
property intact: a query reaches one tenant's log because it can reach only one tenant's
database. It also puts the row in the same storage transaction as the change it describes.

### Finite per-object storage makes retention part of the schema

ADR-001 states that per-object storage is finite and that a table which grows without bound
needs a retention rule before it ships. The audit table is the clearest case in the product: it
grows with traffic, forever, and nothing in normal operation removes a row. The retention window
is therefore a column of the design rather than an operational afterthought, and the tier
windows above are what bound the table.

### A row write is the most expensive thing the platform does

Durable Object row writes dominate the cost model. At the modelled five audit rows per
active-user-day, audit writes are the single largest line in the per-tenant cost of goods —
larger than the directory's own writes, larger than Worker requests, larger than email. The
catalog is therefore a design decision with a price attached: the log records durable facts and
security decisions, and the event list below is closed rather than open to whatever a future call
site finds interesting.

### Two records, two audiences

The tenant audit log holds facts about one tenant's directory, is read by that tenant through the
dashboard and the management API, and is kept for the tier's window. The platform's operational
record holds structured request logs, traces, cost points and cross-tenant aggregates, is read by
the platform, and is kept on the platform's own schedule.

The two stay apart. The operational record names infrastructure and spans tenants, so it stays
inside; the audit log names only the tenant's own directory, so all of it is readable by that
tenant.

## Decision

An append-only `audit_events` table in each tenant object, written by the operation that caused
the event, read through one paging method, and bounded by a scheduled retention sweep.

### The row

| Column                     | Type    | Holds                                                                         |
| -------------------------- | ------- | ----------------------------------------------------------------------------- |
| `id`                       | TEXT    | Monotonic per-tenant identifier; the tiebreaker in the sort                   |
| `at`                       | INTEGER | UTC milliseconds — an integer, since a `Date` is not sent across the boundary |
| `action`                   | TEXT    | A catalog key, e.g. `subject.blocked`                                         |
| `actor_type`, `actor_id`   | TEXT    | Who acted: `subject`, `member`, `client` or `platform`, and which one         |
| `target_type`, `target_id` | TEXT    | What was acted on, and which one                                              |
| `outcome`                  | TEXT    | `succeeded`, `failed` or `denied`                                             |
| `context`                  | TEXT    | JSON: request id, client id, source address, user-agent family                |
| `detail`                   | TEXT    | JSON: a bounded, action-specific payload                                      |

Ordering is `(at, id)`, with secondary indexes on `(action, at, id)` and `(target_id, at, id)`.
Two secondary indexes is the budget, because each one is charged at the write.

### The catalog

Six categories, each a closed list of actions:

| Category              | Examples                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| Authentication        | `authentication.succeeded`, `authentication.failed`, `session.created`, `session.revoked`              |
| Credentials           | `password.changed`, `passkey.enrolled`, `passkey.removed`, `recovery_code.consumed`                    |
| Subject lifecycle     | `subject.created`, `subject.updated`, `subject.blocked`, `subject.deleted`                             |
| Client and protocol   | `client.created`, `client.secret.rotated`, `signing_key.rotated`, `consent.granted`, `consent.revoked` |
| Tenant administration | `member.invited`, `member.role_changed`, `settings.changed`, `domain.verified`                         |
| Plan                  | `subscription.changed`, `addon.enabled`, `addon.disabled`                                              |

A row is written when a durable fact about the directory changed, or when a security decision
was made about a subject. Reads write nothing, discovery and userinfo write nothing, and token
refresh writes nothing — the session that authorized it is already a row, and token volume is
what the daily-active-user meter is for.

### Writes have no method of their own

`revokeSession` writes its own row, as do `enrolPasskey`, `rotateClientSecret` and every other
operation in the catalog. There is no `recordAuditEvent`, because a method on the tenant object is
a complete operation and "write a log line" is a fragment of one. Keeping the write inside the
operation is also what makes a change without its row impossible: both land in one transaction.

### Methods this adds

- **`readAuditPage(input)`** — one page of the tenant's log, over a time window with optional
  `action`, `actor_id` and `target_id` filters. The object validates the window, the filters and
  the cursor itself, and answers rows with integer timestamps plus an opaque cursor minted from the
  `(at, id)` of the last row; both ordering columns stay in the projection so that cursor exists.
  The dashboard and the management API are one route over this method, one call per page.
- **`enforceAuditRetention(input)`** — deletes rows older than `before`, at most `limit` per call,
  answering `{ deleted, oldestRemaining }`, so one sweep cannot monopolize the object.
- **`drainAuditEvents(input)`** — rows after a durable position, for the streaming add-on, answering
  rows plus the next position.

### Retention

A scheduled Worker job walks tenants daily, reads each tenant's retention window from the
entitlement projection _Entitlements as Feature Flags_ publishes through `@sdxc/flags`, and calls
`enforceAuditRetention` with `now − window`, repeating while a call reports a full batch. The
window is a plan attribute, so a tier change takes effect on the next sweep.

### Immutability

The table has no update path and the only deletion is the retention cutoff. A correction is a new
row describing the correcting action. That is what makes the log usable as evidence of what
happened rather than a mutable summary of what someone later believed.

### Beyond the window

Continuous delivery to a customer's own sink, and export of rows older than the tier window, are
the **Audit streaming and export** add-on at $29 per tenant per month, gated by its entitlement
and specified by its own ADR. The base tiers keep a readable window; keeping a copy forever is a
different product with a different storage bill.

## Consequences

### Positive

- Cross-tenant leakage of audit rows is structurally impossible, on the same basis as the directory.
- A change and its audit row commit together, so the log cannot silently miss an operation.
- The table's size is bounded by a number the plan already states, so per-object storage stays
  predictable as a tenant grows.
- Every tier including Free gets a real log, which keeps accountability out of the upsell.

### Negative

- Audit writes are the largest single line in the cost of serving a tenant, so a careless new
  event type is a real expense repeated on every active-user day.
- A closed catalog means a genuinely new event needs an ADR-sized decision rather than a call site.
- A tenant that wants a year of history has to buy the add-on or stream the rows out; the window is
  a hard edge and a tier downgrade shortens it at the next sweep.

### Neutral

- Source addresses and user-agent families are personal data held for the tier's window, which
  makes the retention sweep part of the platform's data-protection story as well as its storage
  story.

## Alternatives Considered

**Audit rows in the D1 control plane.** One table, one place to query, easy cross-tenant reporting
for the platform. It also puts every tenant's history in one database behind a `tenant_id`
predicate, which is exactly the isolation model ADR-001 rejected for the directory. Rejected: the
log names the same subjects the directory does and deserves the same boundary.

**Audit rows as analytics data points.** Cheap writes, generous retention, no storage pressure on
the object. Analytics storage is sampled, unordered at fine granularity, and queried in aggregate;
a log a customer reads row by row and cites in an investigation needs exact, complete, ordered
rows. Rejected for the tenant-readable log, kept for the platform's own operational record.

**Log everything the Worker does.** The richest record, and the one that answers questions nobody
predicted. At the row-write rate it multiplies the largest line in the cost model by an unbounded
factor, and it buries the twenty actions a customer actually asks about. Rejected in favour of a
closed catalog.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the isolation boundary and the storage limit this respects
- [ADR-002: Rebuild Path and Implementation Order](./ADR-002-rebuild-path-and-implementation-order.md) — why retention lands with the tiers
- ADR-004: Tenant Object Schema and Migrations — where the table is registered
- ADR-020: Entitlements as Feature Flags — where the retention window is read from
- [ADR-024: Cost Ledger and Unit Economics](./ADR-024-cost-ledger-and-unit-economics.md) — what an audit row costs
