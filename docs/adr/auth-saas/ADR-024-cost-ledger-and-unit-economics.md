# ADR-024: Cost Ledger and Unit Economics

## Status

**Proposed** - 2026-09-18

## Background

The tiers are priced and the meter is defined. The other half of the same question is what one
tenant costs to serve. The infrastructure bill arrives monthly as a handful of totals per
product — requests, rows, storage, messages — with no tenant anywhere on it.

That total is enough to stay solvent and useless for everything else: it cannot say which
customer is worth keeping, what the free tier costs, whether a tenant's usage matches the shape
its tier describes, or what gross margin a plan earns.

This ADR builds the ledger that attributes consumption to the tenant that caused it, prices it,
and stores the result where it joins to revenue. It is the input to *Usage Reporting for Lifetime
Value*.

## Context

### Quantities are durable; prices are not

A rate changes, and a rate misread when it was written stays misread in every stored number if
what was stored was money. Storing the quantities consumed and pricing them with a pure function
makes a correction retroactive: fix the rate, re-run the function, every historical figure is
right. Every measurement carries the version of the rate card it was recorded under, so a price
change adds a version rather than rewriting history, and a period spanning two versions prices
each group under the card that applies.

Prices are held in **cents per unit**, since per-unit infrastructure costs sit far below a cent
and converting dollars at the reporting boundary is a 100× error that is easy to make and hard to
see.

### Two quantities the runtime will not report

Most consumption is observable as it happens: a request handled, a row read or written, a key
read, a data point emitted, a message sent. Two are not. **Worker CPU per request** has no API by
which a request reads its own CPU time, so it is modelled as a constant per handler class —
`fetch`, `queue`, `scheduled` — calibrated monthly against the CPU figure the infrastructure bill
does report. **Storage bytes per tenant** is billed per database and per namespace, so no
per-tenant figure exists to read; it is modelled from counted rows and a mean row size including
indexes, converted to GB-days by a daily sweep. Both are marked as modelled where they are
defined, so a reader knows which part of a number is measured and which part is estimated.

### The tenant is the unit of attribution

A request resolves its tenant before doing any work worth counting, so almost every unit of work
has exactly one tenant to charge. Scheduled work serving no particular tenant is attributed to a
`platform` bucket rather than divided, because knowing how much spend is unattributed is worth
more than spreading it thin.

### What the number is for

Infrastructure cost is immaterial against these prices: a Premium tenant at its cap costs about
$5.60 a month against a $99 subscription, a Pro tenant about $1.30 against $29. This ledger
protects no margin, because margin is not under threat from consumption at any usage a tier
permits. It exists so the platform can compute lifetime value and cost of goods per customer,
price a future plan from evidence, and notice a tenant whose consumption per active user is an
order of magnitude away from the model — an abuse signal rather than a billing one. Pricing is
value-based; the cost model is instrumentation.

## Decision

A rate-card module, an async-local ledger per unit of work, and one analytics data point per
tenant per unit of work.

### The rate card

`app/lib/cost-rates.ts` states `RATES`, cents per unit for Worker requests and CPU milliseconds,
Durable Object requests, duration and SQLite rows read, written and stored, D1 rows and storage,
KV reads, mutations and storage, analytics points and queries, queue operations, and email sent.
Beside it: `RATE_CARD_VERSION`, the dated string every measurement carries; `COST_RESOURCES`, the
resource order recorded points position their fields by, appended to and never reordered;
`createCostQuantities()`, a zeroed record so pricing is a plain sum; and
`priceCostQuantities(quantities)`, the pure function from quantities to cents. The modelled
constants live in the same module: CPU milliseconds per handler class, and mean row bytes for the
directory and audit tables.

Every rate prices consumption as though the account had no included free allowance, which stays
true as the platform grows and keeps `line = max(0, units − included) × rate` computable.

### The ledger

One `CostLedger` per unit of work — a `fetch` request, a queue message, a scheduled job — held in
an async-local store, so concurrent jobs in one invocation each get their own with no crosstalk.
Call sites record through a free function that is a no-op outside a ledger, so an uninstrumented
path costs nothing. One `flush()` at the end folds in the request share, the modelled CPU for the
handler class and the accumulated row counts, prices them, and writes one analytics data point
indexed by tenant id carrying the source, the attribution and the rate-card version as blobs and
the quantities plus priced cents as numbers. The same totals go onto the invocation's structured
log through `@sdxc/logger`, so what one request cost is a log query. `flush()` catches its own
errors: instrumentation failing the work it measures would be worse than no instrumentation.

### Counting work done inside the object

The object's SQLite counters are readable only inside the object, so every RPC return value
carries a `cost` envelope — `{ rowsRead, rowsWritten, durationMs }`, plain integers filled from
the object's own cursor counters — which the Worker's ledger folds into the request's quantities.
One data point per request keeps attribution and rate-card version in one place, and the envelope
crosses the boundary as plain numbers.

**`reportStorageFootprint()`** is the one method this adds to the tenant object: row counts per
table plus the database size, the whole of what the daily storage sweep needs, in one call. The
sweep multiplies counts by the modelled mean row sizes, prorates by the day, and records the
GB-days against the tenant.

### What a tenant costs

Modelled per active-user-day, at 8 Worker requests, 8 object requests at ~20 ms, 10 rows read,
3 rows written, 5 audit rows written, 2 analytics points and 2 KV reads:

| Resource | Units | Rate (¢/unit) | ¢ per DAU-day |
| --- | --- | --- | --- |
| Worker requests | 8 | 3.0e-5 | 2.40e-4 |
| Worker CPU (modelled 8 ms × 8) | 64 ms | 2.0e-6 | 1.28e-4 |
| Object requests | 8 | 1.5e-5 | 1.20e-4 |
| Object duration (20 ms × 8) | 160 ms | 1.5625e-7 | 2.50e-5 |
| Rows read | 10 | 1.0e-7 | 1.00e-6 |
| Rows written | 3 | 1.0e-4 | 3.00e-4 |
| **Audit rows written** | 5 | 1.0e-4 | **5.00e-4** |
| Analytics points | 2 | 2.5e-5 | 5.00e-5 |
| KV reads | 2 | 5.0e-5 | 1.00e-4 |
| **Total** | | | **1.464e-3** |

Audit writes are the largest single line, which is why *Audit Log and Retention* keeps a closed
event catalog.

A Premium tenant at its 10,000 DAU cap, over a 30-day month — 300,000 DAU-days:

| Line | Arithmetic | Cents |
| --- | --- | --- |
| Per-active-user consumption | 300,000 × 1.464e-3 | 439.2 |
| Email, at 0.2 per DAU-month | 10,000 × 0.2 × 3.5e-2 | 70.0 |
| Audit storage, 90-day window | 10,000 × 5 × 200 B = 0.01 GB/day, held 90 days = 0.9 GB; 0.9 × 30 × 0.667 | 18.0 |
| Directory and key storage | modelled 0.4 GB; 0.4 × 30 × 0.667 | 8.0 |
| Subtotal | | 535.2 |
| Scheduled work and object residency, modelled at 5% | 535.2 × 0.05 | 26.8 |
| **Total** | | **562.0 ≈ $5.60** |

Gross margin at full usage: (99 − 5.60) / 99 ≈ 94%.

| Tier | Full usage at cap | Typical usage (~30% of cap) | Gross margin at full usage |
| --- | --- | --- | --- |
| Free | ~$0.05 | ~$0.02 | — |
| Pro | ~$1.30 | ~$0.40 | ~95% |
| Premium | ~$5.60 | ~$1.70 | ~94% |

Overage prices the same way: 1,000 additional DAU for a month is 30,000 DAU-days, about $0.44 of
consumption against a $10 charge.

## Consequences

### Positive

- A rate correction re-prices every stored measurement, because what is stored is quantities.
- Cost per tenant, per plan and per customer is a query rather than a spreadsheet exercise.
- A tenant consuming far outside the model is visible as a number, which is the earliest abuse
  signal the platform has.
- Recording is a few additions on the hot path and one write at the end.

### Negative

- Two lines are estimates, so the ledger's total and the infrastructure bill stay a calibration
  apart, and that calibration is a recurring manual task.
- Every RPC return value carries a cost envelope, a field on types that have nothing to do with
  cost.
- The resource order recorded points are written by cannot be reordered without orphaning every
  point already stored, and modelled storage is only as good as mean row sizes that drift with the
  schema.

### Neutral

- Analytics storage is sampled at high volume, so the ledger is a good estimate rather than an
  accounting record, which is all a cost-of-goods figure needs to be.
- The `platform` bucket is expected to be non-trivial; watching it is part of reading the ledger.

## Alternatives Considered

**Store priced money instead of quantities.** Simpler reads, no pricing function on the read path.
A rate correction then needs a migration over history, and a period spanning a price change cannot
be re-derived at all. Rejected.

**Rely on the infrastructure bill alone.** No code, exact totals, and no tenant anywhere on it, so
it answers none of the questions this exists for. Rejected.

**Skip the ledger, since cost is immaterial.** Defensible on margin alone, and the conclusion this
ADR reaches supports it. It also leaves lifetime value, the cost of the free tier and the abuse
signal uncomputable — none of which are margin questions. Rejected on those grounds.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the boundary the cost envelope crosses
- ADR-022: Daily Active User Metering and Quotas — the denominator this prices against
- [ADR-023: Audit Log and Retention](./ADR-023-audit-log-and-retention.md) — the largest line in the model
- [ADR-025: Usage Reporting for Lifetime Value](./ADR-025-usage-reporting-for-lifetime-value.md) — where these figures are sent
