# ADR-019: Instrument D1 Row Counts and Durable Object Wall Time

## Status

**Accepted** — implemented 2026-07-30. Follows from
[ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§16. Should arguably ship **first**: it is what turns that ADR's modelled numbers into measured
ones.

## Context

[ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md) derives cost per monitor execution
from static inspection: `EXPLAIN QUERY PLAN` for D1 rows read, `sqlite_master` for the index set
behind rows written, and modelled bands for Worker CPU and Durable Object duration. Three of its
inputs carry enough uncertainty to move its conclusions, and all three are measurable today
without adding a single billable operation:

| Unknown                       | Assumed                | Why it matters                                                                                                                                     |
| ----------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 rows read per statement    | 20,180 per HTTP ping   | **58% of expected HTTP cost.** Derived from a plan captured with the host `sqlite3` against the local database file; D1 runs its own SQLite build. |
| D1 rows written per statement | 10 per HTTP ping       | 29% of expected cost. Derived from counting indexes, including SQLite's implicit primary-key indexes.                                              |
| DO billed wall clock          | 250 ms (band 50–1,000) | Sets the DO duration line, and the timeout case is 40× the typical one. `X-Response-Time` measures the _probe_, not the billed window.             |

Two further unknowns — K, the number of every-minute cron deliveries per minute, and the real
check rate per monitor — are answerable from Cloudflare's own analytics with no code change at
all, and are listed under Non-decisions below so this ADR does not duplicate metering that
already exists.

The point of this ADR is the narrow set of things Cloudflare's analytics **cannot** attribute:
per-statement and per-job-type breakdowns. The dashboard reports rows read per _database_; what is
needed is rows read per _query_, so a regression can be traced to the statement that caused it.

## Decision

### 1. Surface D1 `meta` from the adapter into the logger

Every D1 response carries `meta.rows_read` and `meta.rows_written`, and
`@pkg/data-table-d1`'s `execute()` **already reads `result.meta`** to normalise `affectedRows` and
`insertId`:

```ts
let result = (await prepared.all()) as D1StatementResult;
// ...
return {
	rows,
	affectedRows: normalizeAffectedRowsForReader(operation.kind, rows, result.meta),
	insertId: normalizeInsertIdForReader(operation.kind, operation, rows, result.meta),
};
```

The numbers are in hand and discarded. Add an optional observer to the adapter's options so a
consumer can receive them without the package taking a logging dependency:

```ts
createD1DatabaseAdapter(env.DB, {
	onStatement({ kind, table, rowsRead, rowsWritten, durationMs }) {
		/* ... */
	},
});
```

Wire it in `app/lib/container.ts` to accumulate per-scope totals, and have `Job.run`'s
`BatchedLogger` — which already emits exactly one batched log line per job with a
`job:<kebab-name>:<message id>` identifier — include the totals in its `job.completed` event.

That yields exact rows read and written **per job type**, which is precisely the attribution
ADR-002 estimates. One log field, no extra queries, no extra billable operations.

For request paths, the same accumulator can hang off the existing request logger middleware.

### 2. Measure the Durable Object's billed window, not just the probe

`GeoFetchDO.fetch` already computes the probe duration:

```ts
let start = performance.now();
let response = await fetch(request);
let end = performance.now();
response.headers.set("X-Response-Time", `${end - start}`);
```

The billed window is wider than that — it starts when the request reaches the object and ends when
it becomes hibernation-eligible, which includes response construction and body streaming. Add a
second header covering the whole handler:

```ts
response.headers.set("X-DO-Wall-Time", `${performance.now() - handlerStart}`);
```

and log it in `CheckHttpJob` alongside `responseTimeMs`. Two numbers instead of one conflated
number: probe latency is the product metric, wall time is the billing metric. The gap between them
is what content checks and large response bodies widen, which is currently invisible.

`performance.now()` inside the object measures the object's own view and will slightly understate
the billed window (it excludes dispatch). Treat it as a lower bound and reconcile against
`durableObjectsInvocationsAdaptiveGroups`' `sum.wallTime` divided by requests, which is the
authoritative aggregate.

### 3. Confirm the query plans against D1 itself

The plans in ADR-002 and [ADR-003](./ADR-003-schedule-http-checks-from-next-due-at.md) were
captured with host `sqlite3` 3.51.0 against a copy of the local database file, because that is
where the real schema and index set live. Re-run the two that matter against production:

```bash
bunx wrangler d1 execute DB --remote --command "EXPLAIN QUERY PLAN <findDue query>"
```

If D1's planner chooses differently, the rows-read model changes — though not the
planner-independent part of the claim, which is that `MAX(completed_at) … GROUP BY monitor_id` over
an unfiltered table must read every row of it.

### 4. Assert the cost model in a test

Once per-statement counts are logged, the highest-value ones become assertable. A test that
`CheckHttpJob` performs no more than N D1 statements and reads no more than M rows for a healthy
check turns the cost model into a regression guard — so the next `findDue`-shaped query is caught
in CI rather than in a bill six months later. This is the durable value of the whole ADR.

## Non-decisions — use Cloudflare's analytics, do not build metering

Deliberately **not** implemented in the app, because the platform already answers them and
duplicating metering costs the operations it measures:

| Question                            | Where to get it                                                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K — cron deliveries per minute      | Workers Metrics filtered to the `scheduled` handler, or GraphQL `workersInvocationsAdaptive` grouped by event type; divide by 43,200                                                |
| Actual checks per monitor per month | The dashboard's own `consumed` vs `estimated` figures, or an Analytics Engine query over `uptime_monitor_results`                                                                   |
| Queue batch sizes and retry rate    | Queues Metrics, or `queueConsumerMetricsAdaptiveGroups`. `batch.messages.length` and `message.attempts` are already available in the handler, and `Job.run` already logs `attempts` |
| Worker CPU per script               | Workers Metrics CPU-time distribution; `workersInvocationsAdaptive` exposes `cpuTime` per invocation                                                                                |
| Aggregate D1 rows read/written      | `d1AnalyticsAdaptiveGroups`                                                                                                                                                         |
| KV operations                       | KV Metrics per namespace                                                                                                                                                            |
| Email sends                         | `SELECT status, COUNT(*) FROM alert_events WHERE sent_at >= ? GROUP BY status`, cross-checked against Resend's dashboard                                                            |
| Per-type monitor counts             | `SELECT COUNT(*)` per monitor table — worth an internal endpoint, since sweep cost per execution is `1/N` in each                                                                   |

## Consequences

- **ADR-002's two highest-impact unknowns become measured**, from one adapter option and one log
  field. If rows read per HTTP ping turns out to be materially different from 20,180, the
  allowance analysis in ADR-002 §14 and the priority of ADR-003 both move — so this is the
  cheapest way to validate the most expensive claim in the series.
- **Zero additional billable operations.** Both numbers already exist; this stops discarding them.
- **`@pkg/data-table-d1` gains an optional callback**, which is a shared-package change. It must
  stay optional and dependency-free so no consumer is forced to care.
- **A hot-path callback needs care.** It runs per statement, so it must not allocate heavily or
  throw — a logging observer that throws would fail the query it was measuring.
- **Log volume rises slightly**, though `BatchedLogger` already emits one line per job, so this
  adds fields rather than lines.
- **`X-DO-Wall-Time` is a lower bound**, not the billed figure. Documenting that honestly matters
  more than the number — an under-measured duration presented as exact would be worse than the
  current absence.
- **Enables tuning the constants other ADRs guess at**:
  [ADR-008](./ADR-008-bounded-concurrency-sweeps.md)'s concurrency of 10 and
  [ADR-009](./ADR-009-shard-the-geofetch-durable-object-namespace.md)'s 8 shards per region are
  both explicitly placeholders pending measurement from here.
