# ADR-025: Usage Reporting for Lifetime Value

## Status

**Proposed** - 2026-09-18

## Background

Three numbers about one customer sit in three places. Revenue is in the billing provider:
subscriptions, orders, refunds, the dates a plan changed. Consumption is in the daily-active-user
meter. Cost is in the cost ledger's analytics dataset, priced per tenant per day.

A question as ordinary as "is this customer worth what we spend serving them" needs all three at
once, keyed to the same entity. Left in three stores it is a manual export and a spreadsheet join,
repeated every time anyone asks.

This ADR sends the two the platform owns — usage and cost — to the billing provider, which already
holds revenue. The join happens once, in the place that reports on customers for a living, and the
result is a margin and a lifetime value per customer rather than a quarterly reconstruction.

## Context

### Revenue and cost have to name the same customer

The billing provider is reached through the `Billing` contract in `@sdxc/billing`, with Polar
configured behind it. A customer created there carries `externalId`, the platform's own customer
id, and the platform treats it as immutable once set. That one field is the join key: every usage
event names the customer by `{ externalId }`, so a cost point and a subscription land on the same
record without a mapping table.

### A tenant is measured; a customer is billed

A tenant is the unit of isolation, of cost and of subscription — a customer with five tenants
holds five subscriptions and is served by five objects. Lifetime value is a property of the
customer, because that is who renews, churns and is sold to.

So measurement stays per tenant and reporting rolls up per customer, with the tenant named in each
event's metadata. That keeps both readings available: the provider aggregates by customer for
margin and lifetime value, and filters by tenant metadata for the per-tenant meter an overage line
is computed from.

### A retry must not bill twice

A scheduled job reporting usage gets retried, by the platform on failure and by an operator
re-running a day. `usage.ingest` counts a resent `externalId` once and excludes it from `accepted`,
so idempotency is a naming discipline: the key is derived from the row being reported, never from
the moment of sending.

### What may leave the platform

The billing provider is a processor for billing data. Counts, amounts, plan slugs and opaque
identifiers are billing data. A subject's identifier, email, address or session is not, and none
of it is needed to compute a margin.

## Decision

One scheduled job, run daily, reporting the previous complete UTC day as usage events against the
customer that owns each tenant.

### What is reported

| Event | One per | Carries |
| --- | --- | --- |
| `auth.dau` | tenant, UTC day | The day's distinct authenticating subjects, as the metered quantity |
| `infra.cost` | tenant, UTC day | The ledger's modelled cost for that tenant-day, as `cost` |

Both name the customer as `{ externalId: customerId }` and carry metadata `{ tenantId, tier }`.
`externalId` on the event is `${name}:${tenantId}:${day}`, so a retried delivery and a re-run of the
same day both collapse to one counted event.

`cost` is a `Cost`, whose amount is minor units as a plain decimal string at nine decimal places.
A per-tenant daily cost is a small fraction of a cent, which a JavaScript number formats in
exponential notation and a platform's parser rejects; the string keeps it exact and parseable.

### The day the job reports

The previous UTC day, once it is settled. The job needs a distinct-subject count that no longer
changes — *Daily Active User Metering and Quotas* owns producing that settled count per tenant per
UTC day, and this job reads it rather than recomputing it. Cost comes from one analytics query over
the ledger's dataset for the same day, grouped by tenant. Points recorded under more than one
rate-card version are priced under the card each was recorded with and then summed.

This job adds no method to the tenant object. Both inputs already exist outside it, and a daily
rollup has no business waking ten thousand objects.

### Sending

The job checks `supports(billing, "usage")`, builds the whole array, and hands it to
`usage.ingest` in one call — chunking to the platform's per-request limit happens inside the
provider. Every call answers a `Result`, so a failure is examined rather than caught: a
`BillingError` the provider marked `retryable` re-throws and the schedule retries it, and one that
is not is logged with the day it covered, so the day can be re-run once the cause is fixed. Because the keys are derived from the
data, a re-run costs nothing.

Tenant-days the ledger could not attribute to a tenant are held in the platform's own rollup
rather than sent, since an event with no customer has nowhere to land.

### How overage becomes an invoice line

The cap is a daily figure, so the billable quantity is the highest day in the period, and the
`auth.dau` meter aggregates by maximum over the billing period. The line is
`ceil(max(0, peakDau − cap) / 1000) × $10`, priced by the provider against the tenant's
subscription, with the meter filtered to that tenant's metadata. Free hard-caps rather than
overflows, so a Free tenant produces a meter reading and never an overage line.

Every rate the platform states prices usage as though there were no included allowance, which is
what keeps `line = max(0, units − included) × rate` computable from the reported quantity alone.
The platform recomputes the same figure from its own rollup each month, and a disagreement with
the provider's meter is an alert rather than a silent difference on an invoice.

### What this makes answerable

- **Lifetime value per customer** — revenue across every tenant subscription the customer holds,
  against the cost of serving all of them.
- **Gross margin per customer and per plan** — both sides already on the same record.
- **The cost of the free tier** — Free tenants report cost and no revenue, so the number is a sum
  rather than an estimate, and it is what sizes how generous the tier can be.
- **Outliers** — a tenant whose cost per active user sits far from the model, which is the abuse
  signal the ledger exists to surface.

### The privacy boundary

What leaves: the customer's own external id, an opaque tenant id, a UTC day, a plan slug, a count
of distinct subjects, and a modelled cost. What stays: subject identifiers, email addresses,
hostnames, source addresses, audit rows, sessions and tokens. The reported count is a cardinality,
so nothing about who was active crosses the boundary — only how many.

## Consequences

### Positive

- Revenue, usage and cost sit on one record, so margin and lifetime value are a report rather than
  an export and a join.
- One event per tenant-day keeps reporting volume proportional to tenants rather than to traffic.
- Retries and re-runs are free, so operating the job needs no reasoning about whether a day was
  already sent.
- The free tier stops being an unpriced unknown.

### Negative

- The invoice line depends on an aggregation the provider computes, so the platform's rollup and
  the provider's meter can disagree, and reconciling them is recurring work.
- Cost reaching the provider is modelled, so a figure an outside reader may treat as exact is an
  estimate to two lines of the model.
- A day is reported once, a day late; anything wanting live cost reads the ledger directly.
- A customer record has to exist before a tenant's usage can be reported, which makes customer
  creation a dependency of the reporting job rather than only of checkout.

### Neutral

- The provider becomes a store of per-tenant operational counts as well as billing data, which
  widens what a compromise there would expose to counts and plan names.
- Usage reporting is a base behaviour on every tier including Free, since the cost of the free tier
  is exactly what it exists to measure.

## Alternatives Considered

**Report per authentication, in real time.** The finest resolution, and the freshest dashboard. It
is hundreds of thousands of calls a month per busy tenant to answer questions asked monthly, and it
puts the billing provider on the authentication path. Rejected in favour of a daily rollup.

**Report per customer with no tenant metadata.** Fewer events, and enough for lifetime value. It
also makes the per-tenant overage line uncomputable and hides the outlier the ledger exists to
find, since one customer's five tenants become one number. Rejected.

**Make each tenant its own billing customer.** Per-tenant meters with no metadata filtering, and a
clean one-to-one with the subscription. It splits one payer across five customer records, so
lifetime value becomes a join the provider cannot do and a card change has to be made five times.
Rejected.

**Keep cost internal and send only usage.** Less data leaving the platform, smaller privacy
surface. Margin then lives in a spreadsheet rebuilt every time anyone asks, which is the state this
ADR exists to end. Rejected.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — why a tenant is the unit that gets measured
- ADR-018: Per-Tenant Subscriptions — the customer and subscription records this reports against
- ADR-022: Daily Active User Metering and Quotas — the settled daily count this sends
- [ADR-024: Cost Ledger and Unit Economics](./ADR-024-cost-ledger-and-unit-economics.md) — where the reported cost comes from
