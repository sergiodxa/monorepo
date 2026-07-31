# ADR-007: Report Per-Customer Infrastructure Cost to Polar Cost Insights

## Status

**Proposed** — 2026-07-30. Turns the cost model in
[ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md) from a one-off analysis into a
continuously measured, per-customer figure delivered to Polar. No code written yet.

## Context

ADR-002 established what one monitor execution costs, by hand, at one commit, for one
account. Everything in it is a snapshot: the D1 row counts came from `EXPLAIN QUERY PLAN`,
the cron-delivery multiplier `K` and the Durable Object duration are modelled bands, and the
whole thing has to be re-derived by a human every time the code changes. §16 lists eleven
measurements the model needs and does not have.

Meanwhile the revenue side is already in Polar: subscriptions, a `ping` meter
(`22fabd9b-8b03-4cc2-8981-230717267cd5`), a product gate the scheduler consults every
minute. Polar knows exactly what every customer pays and nothing about what they cost.

**Cost Insights** closes that gap. Polar accepts a `_cost` object inside an ingested event's
metadata, attaches it to a customer, and combines it with that customer's revenue to produce
cost, gross profit, and LTV per customer in the Metrics API and dashboard. So the work is
not "build a cost dashboard" — it is "count the operations each customer causes, price them,
and report them to Polar as events carrying a `_cost`."

Two constraints from the brief shape everything below:

1. **Assume no included quotas.** Every operation is priced at the Workers Paid overage
   rate, whether or not the account is over its allowance. This is ADR-002 §0's frame: it
   answers _"what would this customer cost me if I had no free tier"_, which is the only
   version of the number that stays true as the platform grows.
2. **Report every resource.** Workers requests and CPU, D1 reads/writes/storage, Queues
   operations, Durable Object requests and duration, Analytics Engine writes and queries,
   KV reads/writes/storage, and outbound email.

### What is already true, and what it costs to be wrong

| Fact                                                                                                                                                                                        | Source                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Polar usage ingestion is **not wired up** at all. `PING_METER_ID` and `Customer.getUsagePerMonth` exist for reading; `check-http.ts`'s docblock says "Usage ingestion is not wired up yet". | `app/data/customer.ts`, `app/jobs/check-http.ts`                 |
| The billing subject is the **team owner**, keyed by the OIDC subject as Polar's `external_id`.                                                                                              | `Customer.findOrCreate`                                          |
| Cost is incurred per **team** (monitors belong to teams), revenue is collected per **owner**. One owner may hold several teams.                                                             | `database/schema.ts`, `Monitor.findDue`                          |
| D1 returns `meta.rows_read` / `meta.rows_written` on every response, and the adapter already destructures `result.meta`.                                                                    | `packages/data-table-d1/src/index.ts:132`                        |
| `GeoFetchDO` already computes a `performance.now()` delta, exposed as `X-Response-Time`.                                                                                                    | `app/do/geo-fetch.ts`                                            |
| The service container is `AsyncLocalStorage`-backed and `nodejs_compat` is on.                                                                                                              | `packages/service-container/src/index.ts:83`, `wrangler.jsonc:6` |
| One Analytics Engine dataset exists (`uptime_monitor_results`), written once per HTTP check and never for TCP/DNS/cron.                                                                     | `app/services/analytics.ts:147`, `wrangler.jsonc:75`             |

The cost of getting attribution wrong is not a wrong dashboard — it is a wrong pricing
decision. ADR-002 §14 already shows the included allowance failing the pessimistic test by
$0.53 on a fully-consuming customer. Deciding whether to raise it needs measured
per-customer cost, not a modelled band.

---

## 1. What Polar accepts, verified

Checked against the installed SDK, `@polar-sh/sdk@0.48.1`, and the Cost Insights docs on
2026-07-30.

Cost Insights is **first-class in the installed SDK** — this is not a metadata hack:

```ts
// models/components/costmetadatainput.ts
export type CostMetadataInput = {
	/** The amount in cents. */
	amount: number | string;
	/** The currency. Currently, only `usd` is supported. */
	currency: string;
};

// models/components/eventmetadatainput.ts
export type EventMetadataInput = LLMMetadata | CostMetadataInput | string | number | boolean;
```

| Property        | Value                                                                                    | Consequence for this design                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where cost goes | `metadata._cost` on an ingested event                                                    | No separate endpoint; cost rides the existing events API                                                                                                                                                   |
| Unit            | **cents**, decimal                                                                       | `100` = $1.00. `0.5` = $0.005. Every rate in §2 is stored in cents, not dollars                                                                                                                            |
| Precision       | up to 17 digits, 12 decimal places                                                       | A per-check HTTP cost of $0.000034767 is `0.0034767` cents — 7 decimals, comfortable                                                                                                                       |
| `amount` type   | `number \| string`                                                                       | **Send a string.** JS renders any float below 1e-6 in exponential notation (`(1e-7).toString() === "1e-7"`), so a small `number` risks an unparseable body. `toFixed(9)` on a string sidesteps it entirely |
| Currency        | `usd` only                                                                               | Fine; every rate is already USD                                                                                                                                                                            |
| Customer key    | `EventCreateCustomer.customerId` **or** `EventCreateExternalCustomer.externalCustomerId` | Use `externalCustomerId` — the app already keys customers by OIDC subject and never stores the Polar id                                                                                                    |
| Deduplication   | `externalId` on the event                                                                | The idempotency mechanism for the reporting job (§6)                                                                                                                                                       |
| Timestamp       | `timestamp?: Date`, defaults to ingestion time                                           | Set it explicitly so a late or retried run lands cost on the day it was incurred                                                                                                                           |
| Meter required? | No                                                                                       | Meters aggregate usage for billing; `_cost` is read by Cost Insights and the Metrics API. No new meter                                                                                                     |
| Batch limit     | Not documented                                                                           | Chunk conservatively (§6)                                                                                                                                                                                  |

`@pkg/polar`'s `IngestEvent` can express none of this today: `customerId` is required,
`externalCustomerId` does not exist, and `metadata` is typed
`Record<string, string | number | boolean>`, which cannot hold a nested `_cost`. That is a
required package change (§8).

---

## 2. The rate card

A single module, `app/lib/cost-rates.ts`, holding every unit price from ADR-002 §1
**expressed in cents**, with a version string.

```ts
export const RATE_CARD_VERSION = "2026-07-30";

/** Cents per unit, at Workers Paid overage rates, with no included quota netted off. */
export const RATES = {
	workerRequest: 3.0e-5, // $0.30 / M
	workerCpuMs: 2.0e-6, // $0.02 / M ms
	queueOperation: 4.0e-5, // $0.40 / M
	d1RowRead: 1.0e-7, // $0.001 / M
	d1RowWritten: 1.0e-4, // $1.00 / M
	d1StorageGbDay: 2.5, // $0.75 / GB-month ÷ 30
	kvRead: 5.0e-5, // $0.50 / M
	kvMutation: 5.0e-4, // $5.00 / M — write, delete and list share the rate
	kvStorageGbDay: 1.667, // $0.50 / GB-month ÷ 30
	doRequest: 1.5e-5, // $0.15 / M
	doDurationMs: 1.5625e-7, // $12.50 / M GB-s at the fixed 128 MB allocation
	aeDataPoint: 2.5e-5, // $0.25 / M
	aeQuery: 1.0e-4, // $1.00 / M
	emailSent: 9.0e-2, // $0.90 / 1,000 — Resend, the actual transport
} as const;
```

Three properties this module must have:

- **Versioned, never edited in place.** A Cloudflare price change adds a new version; it
  does not retroactively restate history. `RATE_CARD_VERSION` is carried on every recorded
  data point and every Polar event, so a cost figure can always be traced to the prices that
  produced it.
- **Cents, because Polar's unit is cents.** Converting dollars to cents at the reporting
  boundary invites a 100× error in exactly the place it would be hardest to notice.
- **Email priced at Resend's $0.90/1,000, not Cloudflare's $0.35/1,000.** ADR-002 §1 is
  explicit that `app/services/alerts.ts` sends through Resend. Price what the code does. If
  the migration in ADR-002 §18 happens, that is a new rate card version.

Sanity check against ADR-002 §9: one expected HTTP success is `0.0034767` cents, and
179,304 of them is 623 cents — $6.23/month, consistent with §13's $7.78 total once cron
heartbeats and email are added.

---

## 3. The cost ledger

A per-unit-of-work accumulator. One ledger exists per **job run** and per **inbound
request** — not per Worker invocation, because a queue batch is one invocation running up to
ten jobs concurrently under `waitUntil`, and their operations interleave.

### Scoping: a dedicated `AsyncLocalStorage`, not the container

The obvious move is to register the ledger as a `scoped` service. It does not work:
`ServiceContainer.findInstance` walks parent containers, so if anything resolves the ledger
in the outer batch scope, every job in the batch shares one instance and attribution
silently merges.

```ts
// packages/service-container/src/index.ts:217
private findInstance<T>(key: ServiceKey<T>) {
  if (this.#instances.has(key)) return { value: this.#instances.get(key) as T };
  return this.parent?.findInstance(key);   // <- a child sees the parent's cached scoped value
}
```

So the ledger owns its own storage:

```ts
let ledgerStorage = new AsyncLocalStorage<CostLedger>();

export function withCostLedger<T>(ledger: CostLedger, work: () => Promise<T>) {
	return ledgerStorage.run(ledger, work);
}

/** The active ledger, or `null` outside any tracked unit of work. */
export function currentLedger(): CostLedger | null {
	return ledgerStorage.getStore() ?? null;
}
```

`AsyncLocalStorage.run` nests strictly, so ten concurrent `waitUntil`ed jobs get ten
ledgers with no possibility of crosstalk. Every recording site must tolerate
`currentLedger() === null` and no-op — the D1 adapter is an isolate-wide singleton and will
be called from paths that have no ledger (migrations, tests, ad-hoc scripts).

### Shape

```ts
class CostLedger {
	/** Records `quantity` units of `resource` against a team. */
	record(resource: Resource, quantity: number, teamId: string | null): void;

	/** Records against no team; settled by §5's policy at flush time. */
	shared(resource: Resource, quantity: number): void;

	/** Divides everything recorded via `shared()` across these teams, by weight. */
	apportion(weights: Map<string, number>): void;

	/** Prices every bucket and writes one Analytics Engine data point per team. */
	flush(source: string): void;
}
```

`flush` is called from exactly two places: `Job.run`'s existing `finally` block (which
already calls `logger.flush()`), and after `app.fetch(request)` in the worker's `fetch`
handler. Nothing else needs to know the ledger exists.

---

## 4. What gets counted, where, and how well

The distinction that matters is **measured** vs **modelled**. Measured quantities come back
from the platform; modelled ones come from a constant in the rate-card module. Every
modelled quantity is a number the reconciliation in §7 has to check.

| Resource             | Call site                                         | How counted                                                                                           | Quality                                        |
| -------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| D1 rows read         | `@pkg/data-table-d1` `execute()`                  | `meta.rows_read` per statement, new `onStatement` hook                                                | **measured, exact**                            |
| D1 rows written      | same                                              | `meta.rows_written`                                                                                   | **measured, exact**                            |
| D1 storage           | daily job                                         | per-team row counts × mean row size, prorated per day                                                 | modelled                                       |
| Queue operations     | `scheduled()` producer; `queue()` consumer        | 1 write per message sent, 1 read + 1 delete per message delivered, +1 read per `message.attempts > 1` | **measured, exact**                            |
| Workers requests     | `fetch`, `scheduled`, `queue` entry               | 1 per invocation; a queue batch's single request divided by `batch.messages.length`                   | **measured, exact**                            |
| Workers CPU ms       | ledger flush                                      | constant per handler class (ADR-002 §9 bands)                                                         | **modelled** — no runtime API exposes CPU time |
| DO requests          | `CheckHttpJob.fetchMonitor`                       | 1 per `stub.fetch`                                                                                    | **measured, exact**                            |
| DO duration          | `GeoFetchDO.fetch`                                | new `X-DO-Wall-Time` header covering the whole handler, not just the probe                            | **measured**                                   |
| AE data points       | `writeHttpPingResult`, ledger flush               | 1 per `writeDataPoint`, including the ledger's own                                                    | **measured, exact**                            |
| AE queries           | `queryAnalytics`                                  | 1 per call — counts the monitors-list N+1 honestly                                                    | **measured, exact**                            |
| KV reads / mutations | `@pkg/session-storage-kv`, `queryAnalyticsCached` | 1 per operation                                                                                       | **measured, exact**                            |
| KV storage           | daily job                                         | session count + cache keys × mean value size                                                          | modelled, immaterial                           |
| Emails               | `deliverEmail`                                    | 1 per Resend send, recorded on success **and** failure — a failed send is billed                      | **measured, exact**                            |

Two notes on the DO duration header. `X-Response-Time` today measures the probe, not the
billed window, and ADR-002 §6 records that the object is billed for the whole time it is not
hibernation-eligible — which includes the awaited outbound `fetch()`. So the new header must
wrap the entire handler, and `X-Response-Time` must keep its current meaning because
`response_time_ms` is a product figure, not a cost one.

### This closes six of ADR-002 §16's eleven unknowns as a by-product

Not a side benefit — arguably the main one. The instrumentation is the measurement.

| ADR-002 §16 unknown              | Assumed                      | Resolved by                                     |
| -------------------------------- | ---------------------------- | ----------------------------------------------- |
| `K` — cron deliveries per minute | 2 (1–3)                      | Every delivery flushes a ledger; `K` is a count |
| D1 rows read per statement       | 20,180 / HTTP ping           | `meta.rows_read`, exact                         |
| Rows written per statement       | derived from `sqlite_master` | `meta.rows_written`, exact                      |
| DO billed duration               | 250 ms (50–1,000)            | `X-DO-Wall-Time`                                |
| Queue batch size and retry rate  | B ≈ 5, retries ≈ 0           | `batch.messages.length`, `message.attempts`     |
| Alert / email volume             | 434 emails/month             | Counted at `deliverEmail`                       |
| AE writes and queries            | 1 + 1 per HTTP ping          | Counted at the call site                        |

Worker CPU and the actual check rate stay outside this system — CPU because Workers exposes
no runtime API for it, the check rate because it is measured by comparing consumed against
estimated pings, which the dashboard already does.

---

## 5. Attribution policy

Most cost is caused by an identifiable team. Some is caused by a set of teams collectively.
A little is caused by nobody. The policy has to be written down, because every "shared" line
is a judgement that changes per-customer profitability.

| Cost                                                     | Caused by                          | Policy                                                                                                                                                                 |
| -------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One HTTP check's own operations                          | one monitor                        | **Direct** to that monitor's team                                                                                                                                      |
| Its queue write/read/delete                              | one monitor                        | **Direct**                                                                                                                                                             |
| The retention `DELETE` that row will later cause         | one monitor                        | **Direct, prepaid at insert.** Charge insert + eventual delete together, as ADR-002 §9 does. `CleanJob`'s single bulk `DELETE` cannot be split per team after the fact |
| `findDue` scan + scheduler invocation + Polar gate calls | every enabled HTTP monitor         | **Apportioned** by that delivery's due-monitor count per team                                                                                                          |
| TCP / DNS sweep                                          | every enabled monitor of that type | **Apportioned** by monitors swept per team                                                                                                                             |
| Cron evaluation sweep                                    | every actionable cron monitor      | **Apportioned** by actionable monitors per team                                                                                                                        |
| `AggregateDailyStatsJob`                                 | every monitor rolled up            | **Apportioned** by monitors per team                                                                                                                                   |
| Dashboard and API requests                               | the team being viewed              | **Direct**                                                                                                                                                             |
| Public status-page views                                 | the team owning the page           | **Direct**                                                                                                                                                             |
| `EnqueuePendingDomainsJob`                               | pending domains                    | **Direct** when there are any; otherwise platform                                                                                                                      |
| Workers Paid $5/mo, Resend Pro $20/mo                    | the platform existing              | **Excluded** — see below                                                                                                                                               |

ADR-002 §9's apportionment arithmetic carries over unchanged; the difference is that the
denominators are now counted at runtime instead of assumed. Note what this does to the
scheduler line: today it is 58% of an HTTP check's cost, and it is apportioned across
whichever monitors happened to be due — so a customer with a single 1-minute monitor on an
otherwise quiet platform absorbs nearly the whole scan. That is not a modelling artifact,
it is the truth, and it is exactly the signal ADR-003 exists to remove.

### Fixed subscription fees are excluded, and that is a decision to confirm

The brief says report everything. Read as _"do not net off the included quotas"_ — the
reading §0 of ADR-002 uses — fixed fees are out of scope, and that is the recommendation
here: a $25/month floor divided by a customer count that changes monthly makes per-customer
cost non-comparable across months and pollutes LTV with an artifact of how many other
customers existed at the time.

Read as _"every dollar I spend must land on a customer"_, they belong in. If that is the
intent, the cleanest form is a separate monthly `infra.cost.platform` event split evenly
across teams with at least one enabled monitor, kept as its own event name so it can be
subtracted back out. Flagged in §11 as a decision, not assumed.

---

## 6. Storage and delivery

### Not D1

Writing cost rows to D1 on the hot path would add 4–6 rows written per check — about
$0.000006, or **17% of an HTTP check's total cost**, to measure a cost of $0.0000348. The
instrument would be a material fraction of the thing it measures.

### Analytics Engine, one data point per team per unit of work

A new dataset, `uptime_costs`, on a new binding. One `writeDataPoint` per team per ledger
flush costs `2.5e-5` cents — **0.7% of an HTTP check**, and less than that for every other
type, since a sweep flushes once for many executions.

```jsonc
"analytics_engine_datasets": [
  { "binding": "PING_RESULTS", "dataset": "uptime_monitor_results" },
  { "binding": "COSTS", "dataset": "uptime_costs" },
]
```

| Field         | Contents                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `index1`      | `ownerId` — the Polar `external_customer_id`, so a per-customer drill-down is an indexed read                          |
| `blob1`       | `teamId`                                                                                                               |
| `blob2`       | source: `scheduled`, `queue:checkHttp`, `queue:checkTcp`, `fetch:dashboard`, `fetch:status-page`, `fetch:cron-ping`, … |
| `blob3`       | monitor type: `http` \| `tcp` \| `dns` \| `cron` \| `none`                                                             |
| `blob4`       | `direct` \| `apportioned`                                                                                              |
| `blob5`       | `RATE_CARD_VERSION`                                                                                                    |
| `double1..13` | **quantities**, one per resource in §2's rate card                                                                     |
| `double14`    | the priced total in cents, denormalised                                                                                |

**Store quantities, price at read time.** Quantities are measurements and never need
restating; a rate-card correction can then be re-applied across the whole retained window.
`double14` exists only as a cross-check — if pricing the quantities at read time disagrees
with it, either the rate card moved or something is wrong, and both are worth knowing.

Three properties of the dataset that constrain the design:

- **Sampling.** Analytics Engine samples under load, and a sampled sum understates. Every
  cost query **must** be `SUM(_sample_interval * doubleN)`. Note that
  `getTeamHttpSummaries` does not do this today — a latent undercount in the existing
  monitoring queries, out of scope here but worth its own fix.
- **250 data points per invocation.** A TCP or DNS sweep flushes one point per distinct
  team, so the cap binds once the platform passes 250 teams with monitors of a swept type.
  ADR-006 removes the problem by turning sweeps into per-monitor messages. Until then, teams
  beyond the cap fold into one `overflow` point and the job logs it — a silent truncation
  here would read as "that customer costs nothing".
- **Three-month retention.** Polar is the store of record for cost history; this dataset is
  a staging buffer and a reconciliation source.

### The daily reporting job

`ReportCostsJob`, on a new `0 2 * * *` cron — after `aggregateDailyStats` at 01:00, so a
failure in one does not delay the other.

```sql
SELECT
  index1 AS ownerId,
  blob1  AS teamId,
  blob5  AS rateCard,
  SUM(_sample_interval * double1)  AS workerRequests,
  SUM(_sample_interval * double2)  AS workerCpuMs,
  -- … one per resource …
  SUM(_sample_interval * double14) AS reportedCents
FROM uptime_costs
WHERE timestamp >= toStartOfDay(NOW() - INTERVAL '1' DAY)
  AND timestamp <  toStartOfDay(NOW())
GROUP BY index1, blob1, blob5
```

One row becomes one Polar event:

```ts
{
  name: "infra.cost.daily",
  externalCustomerId: ownerId,
  externalId: `infra_cost:${teamId}:${day}`,   // Polar deduplicates on this
  timestamp: endOfDayUtc,
  metadata: {
    _cost: { amount: "0.003476700", currency: "usd" },   // cents, as a string
    team_id: teamId,
    day,                                                 // YYYY-MM-DD
    rate_card: RATE_CARD_VERSION,
    // the drivers, so Polar's dashboard can answer *why*
    d1_rows_read: 20180,
    d1_rows_written: 10,
    queue_operations: 6,
    worker_requests: 1,
    do_duration_ms: 250,
    ae_queries: 1,
    emails_sent: 0,
    cents_d1: 0.003018,
    cents_email: 0,
    // …
  },
}
```

Design points:

- **One event per team per day**, not per check. Per-check ingestion would be 179,304 Polar
  API calls a month for a single account, and ADR-005 already documents the scaling wall that
  per-minute Polar traffic creates. Daily aggregation loses nothing Cost Insights can use.
- **`externalId` makes retries free.** `@pkg/polar`'s `IngestEvent.externalId` docblock says
  it: Polar deduplicates, so re-sending is a no-op. This is what lets the job be a plain
  queue job with the queue's own retry semantics and no "reported" flag in D1. It is the
  whole reason to key on `{teamId, day}` rather than something time-dependent.
- **`amount` is a string**, `toFixed(9)`. Nine decimal places of a cent is $1e-11 of
  resolution — far below anything that matters — and keeps the value clear of Polar's
  17-digit ceiling, which a 12-decimal fraction on a three-figure daily cost would reach.
- **Explicit `timestamp`.** A run that is late by two days must still book cost to the day
  it happened, or the daily cost chart lies.
- **Chunked ingest.** Polar does not document a batch limit; chunk at 100 events per request
  and let the queue retry a failed chunk. With `externalId` in place, a partially-succeeded
  chunk is safe to resend whole.
- **Owners with no Polar customer** — an unsubscribed owner still incurs dashboard cost —
  cannot receive an event. Log and skip; do not silently drop, because a growing skip count
  means real spend is going unattributed.

### Why a dedicated cost event, and not `_cost` on the `ping` events

There is no cost-only API. Cost is always metadata on an ingested **event** — the question is
only which event carries it. The obvious candidate is the `ping` usage event, which is the
canonical Cost Insights shape (the docs' own example attaches `_cost` to an `llm.inference`
event) and would give one stream instead of two.

It is permitted to send a dedicated one. In Polar's model events are the primitive and meters
are views over them — a `Meter` is `{ filter, aggregation }`, selecting events by name and
metadata — so an event name is freeform and needs no matching meter. The usage-billing docs
confirm ingestion is unconditional: "As events always are ingested, we will never prohibit
any customer's action based on their Usage Meter balance." An event matching no meter is
stored and readable by Cost Insights and the Metrics API; it is simply not billed.

Cardinality is not the reason to separate them. When `ping` ingestion is eventually wired up
(ADR-002 §3 records that it is not), it will be a daily aggregate with a deterministic
`externalId` — the `ingestPageViews` shape in `@pkg/polar`, one event per period with the
count in metadata and a `sum` aggregation on the meter. That is the same one-event-per-team-
per-day as §6, so merging would cost nothing in volume.

The reason to separate them is that **cost and usage have different denominators**. There is
real cost that produces no ping at all:

| Cost with no corresponding ping                                                                                                                                                                  | Source                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Dashboard, API and public status-page requests                                                                                                                                                   | ADR-002 §12 — "not per ping"                                      |
| Duplicate cron deliveries at `K > 1`: queue operations, the `findDue` scan and the Polar gate calls all multiply, while the minute-bucketed job id collides on the `monitor_results` primary key | ADR-002 §13, point 2 — "Cost rises with K; billed usage does not" |
| The cron evaluation sweep                                                                                                                                                                        | ADR-002 §10 — "Evaluation sweeps = not billed as pings at all"    |
| An unsubscribed owner's dashboard use — the scheduler gates them out of checks entirely                                                                                                          | `Customer.filterActiveSubscribers`                                |

So a team can have a day with real cost and zero pings, and `_cost` riding a ping event would
have nowhere to put it. Two further reasons point the same way: cost tracking would otherwise
be blocked behind ping ingestion, which does not exist yet; and a chunk retry or a shape
change in the cost path would be touching a revenue-bearing event.

Both events land on the same customer, so Polar sums them into one cost figure regardless.
Should the denominators ever converge, merging later is a change to one job, not a rewrite.

---

## 7. Reconciliation

A modelled cost that nobody checks drifts. Because the model assumes no included quotas, its
relationship to the real invoice is exact and computable:

```text
invoice_line = max(0, modelled_units − included_units) × rate
```

So the check is at the **quantity** level, independent of pricing, and most of it is
verifiable against Cloudflare's own analytics:

| Resource               | Checked against                           | Exact?                           |
| ---------------------- | ----------------------------------------- | -------------------------------- |
| D1 rows read / written | `d1AnalyticsAdaptiveGroups`               | yes                              |
| Workers requests       | `workersInvocationsAdaptive`              | yes                              |
| Queue operations       | `queueConsumerMetricsAdaptiveGroups`      | yes                              |
| DO requests, wall time | `durableObjectsInvocationsAdaptiveGroups` | yes                              |
| AE data points         | `analyticsEngineWritesAdaptiveGroups`     | yes                              |
| KV operations          | KV namespace metrics                      | yes                              |
| Emails                 | Resend dashboard                          | yes                              |
| Worker CPU             | `workersInvocationsAdaptive` → `cpuTime`  | **calibrates the modelled band** |

Run monthly. Any resource off by more than a few percent is an instrumentation gap — an
uninstrumented call site — not a pricing question. The CPU comparison is the one that feeds
back into the rate-card module, replacing ADR-002 §9's assumed 1/3/8 ms bands with a
measured constant.

---

## 8. Package changes required

Both are additive.

### `@pkg/polar`

```ts
export interface IngestEvent {
	/** The Polar customer the event belongs to. Mutually exclusive with `externalCustomerId`. */
	customerId?: string;
	/** The app-owned external id of the customer. Mutually exclusive with `customerId`. */
	externalCustomerId?: string;
	name: string;
	metadata?: Record<string, string | number | boolean>;
	/** Cost to attach to this event for Polar Cost Insights. `amount` is in **cents**. */
	cost?: { amount: string; currency: "usd" };
	timestamp?: Date;
	externalId?: string;
}
```

`ingestEvents` maps `cost` into `metadata._cost` and picks
`EventCreateCustomer` vs `EventCreateExternalCustomer` from which id is present. The SDK
types both, so this is a mapping change, not a cast.

A convenience wrapper mirroring `ingestPageViews`' shape — best-effort, returns `false`
instead of throwing, so a reporting cron retries on the next run rather than failing a queue
job — plus chunking at 100 events per request.

### `@pkg/data-table-d1`

```ts
interface D1Meta {
	changes?: number;
	last_row_id?: number;
	rows_read?: number; // new
	rows_written?: number; // new
}

interface D1AdapterOptions {
	capabilities?: AdapterCapabilityOverrides;
	/** Called after every statement with what D1 reported. Must never throw. */
	onStatement?(event: { rowsRead: number; rowsWritten: number; kind: string }): void;
}
```

`execute()` already reads `result.meta` on both the `all()` and `run()` paths, so this is a
handful of lines. The hook has to be defensive: it runs on a singleton adapter shared by
every code path in the app, including ones with no active ledger.

---

## 9. Overhead budget

The instrument must account for itself, or the totals are wrong by the cost of measuring
them.

| Item                                           | Cost             | Share of an HTTP check |
| ---------------------------------------------- | ---------------- | ---------------------- |
| 1 AE data point per ledger flush               | $0.00000025      | **0.7%**               |
| The ledger's own AE write, counted             | included above   | —                      |
| `ReportCostsJob`: 1 queue message + 1 AE query | ~$0.0000022/day  | ~$0.00007/month        |
| Polar ingest calls                             | free subrequests | 0                      |
| D1 writes on the hot path                      | **none**         | 0                      |

0.7% today; ~1.5% after ADR-003 halves the HTTP baseline. The ledger charges its own AE
write to the team it describes, which is the only self-consistent choice — that write exists
because that team's check ran.

The cheaper alternative is to fold the cost doubles into the existing
`writeHttpPingResult` data point, which HTTP checks already emit, taking HTTP's overhead to
zero. It is not worth it: it couples the cost schema to ADR-001's monitoring dataset, and it
only helps HTTP, so the query path splits in two for a saving of 0.7%.

---

## 10. Implementation plan

Sequenced so each phase is independently verifiable, and the highest-value measurement
lands first.

| Phase | Work                                                                                                                                      | Verified by                                                                                                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **0** | `@pkg/data-table-d1`: `rows_read`/`rows_written` in `D1Meta` + `onStatement`. `@pkg/polar`: `externalCustomerId`, `cost`, chunked ingest. | Unit tests; MSW for the Polar ingest call                                                                                     |
| **1** | `app/lib/cost-rates.ts`; `app/services/cost.ts` (ledger + `AsyncLocalStorage`); `COSTS` binding and dataset.                              | Rate-card unit tests; a ledger test asserting the priced total for a synthetic HTTP check matches ADR-002 §9 within tolerance |
| **2** | Instrument the HTTP path end to end — it touches every resource class. Flush from `Job.run`'s `finally`.                                  | The measured `rows_read` should land near 20,180. A large gap is the finding, and it is worth more than the estimate was      |
| **3** | Scheduler apportionment; TCP/DNS/cron sweeps; inbound requests; KV; email; the daily storage estimate.                                    | Every resource in §4 non-zero in the dataset; no `overflow` points                                                            |
| **4** | `ReportCostsJob`, the `0 2 * * *` cron, Polar ingestion.                                                                                  | Cost appears per customer in Polar's dashboard; a re-run of the same day creates no second event                              |
| **5** | First monthly reconciliation (§7); publish a corrected rate card with a measured CPU constant.                                            | Every checkable resource within a few percent of Cloudflare's own analytics                                                   |

**Do this before ADR-003 through ADR-006, not after.** Those four ADRs each claim a cost
reduction — ADR-003 alone claims HTTP cost halves. Instrumenting first turns every one of
those claims into a measurement instead of a projection, and the before/after is only
available if "before" was recorded.

Testing notes: run with `bun run test` at the root (or `bun test --isolate`); mock Polar with
MSW rather than injecting a fetch; no user-facing copy is added, so no locale work.

---

## 11. Decisions to confirm

1. **Fixed subscription fees — in or out?** Recommendation: **out**, reported separately if
   at all (§5). In means a monthly `infra.cost.platform` event split across active teams.
2. **Granularity — daily per team.** Recommendation: **daily**. Per-check ingestion is
   179k+ Polar calls a month per account for no analytical gain; monthly is too coarse to
   spot a runaway.
3. **A dedicated `infra.cost.daily` event, or `_cost` on the future `ping` usage events?**
   Recommendation: **dedicated**, because cost and usage have different denominators and
   some real cost produces no ping at all (§6). Same event volume either way, so this is a
   correctness call, not a cost one.
4. **Cost per team or per owner?** Recommendation: **one event per team**, with `team_id` in
   metadata, attributed to the owner's customer record. Polar sums to the customer
   automatically, and the per-team split is the thing you need when one owner holds several
   teams and one of them is the expensive one.
5. **Does an unsubscribed owner's cost get reported?** They incur dashboard and status-page
   cost but have no Polar customer. Recommendation: log and skip, and alert if the skipped
   total grows past a threshold.

---

## Consequences

- Per-customer gross margin becomes a measured figure in Polar rather than a modelled one in
  a document, which is what the allowance decision in ADR-002 §14 has been waiting for.
- Six of ADR-002 §16's eleven unknowns become counted values (§4). The cost model stops
  needing to be re-derived by hand after every change.
- Worker CPU remains modelled — no runtime API exposes it — and stays the largest residual
  uncertainty, at ≤2% of any total.
- Two shared packages gain additive API surface (§8), used by this app first.
- The system costs about 0.7% of what it measures, and that 0.7% is included in what it
  reports.
- Cost history older than three months exists only in Polar; the Analytics Engine dataset is
  a staging buffer, not an archive.
- The apportionment policy in §5 is a judgement, recorded here so a per-customer cost figure
  can always be explained. Changing it changes historical comparability, so it should change
  by a new ADR rather than a patch.
