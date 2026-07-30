# ADR-015: Window the p99 Response-Time Statistic

## Status

**Proposed** — 2026-07-30. Follows from [ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§5 and §17 (medium).

## Context

`Monitor.getStats` computes a p99 by fetching every response time it has ever stored and
indexing into the sorted array in JavaScript:

```ts
db.exec(
  `SELECT r.response_time_ms AS responseTimeMs
   FROM monitor_results r
   JOIN monitors m ON r.monitor_id = m.id
   WHERE ${scopeClause} AND r.response_time_ms IS NOT NULL
   ORDER BY r.response_time_ms ASC`,
  scopeParams,
),
```

```ts
let responseTimes = (...).map((r) => r.responseTimeMs);
let p99Index = Math.floor(responseTimes.length * 0.99);
return { ..., p99: responseTimes[p99Index] ?? null };
```

No `LIMIT`, no time window. Three problems, in increasing severity:

**Rows read.** For `getStatsByTeamId` the scope is `m.team_id = ?`, so it reads every row for
every monitor the team owns, within `monitor_results`' 7-day retention. For the reference
account that is ~40,000 rows per call — $0.00004, which is *more than a whole healthy HTTP
check* — and it grows linearly with the team's monitor count and check frequency.

**Memory and CPU.** All of those rows are materialised into a Worker array and mapped. At
40,000 rows that is fine; at a team with 100 one-minute monitors it is ~1,000,000 rows over 7
days, which will hit Worker memory limits before it hits a cost limit.

**Correctness of the statistic.** A p99 over "everything still in the retention window" is not
a p99 over a stated period. It silently means "the last 7 days" because that is what `CleanJob`
happens to leave behind — and it will silently mean something different the moment retention
changes. Two calls a week apart cover different windows. The number is not comparable with
itself.

There is a further wrinkle: `ORDER BY r.response_time_ms ASC` sorts by *value*, not time, so the
`monitor_results_monitor_completed_at_response_status_response_time_idx` index cannot serve the
ordering for a filtered scope — SQLite sorts the result set. That sort is the expensive part at
scale.

The same query shape has a second, cheaper half (`COUNT(*)`, `SUM(...)`, `MAX(...)` for total,
uptime, and last-check) which is fine — aggregates return one row.

## Decision

**1. Give the statistic a stated window.** 24 hours, matching every other "recent" figure in the
app — `getTeamHttpSummaries`, `getSlowestResultForMonitor`, and the dashboard's uptime card all
use `NOW() - INTERVAL '24' HOUR`. A p99 that says "last 24 hours" is comparable with itself and
with the numbers beside it.

**2. Compute it in Analytics Engine, not D1.** HTTP results already land there
([ADR-001](./ADR-001-analytics-engine-migration.md)), and Analytics Engine exists to answer
exactly this shape of question over a time range without shipping rows to the Worker:

```sql
SELECT quantileWeighted(0.99)(double1, _sample_interval) AS p99ResponseTimeMs
FROM uptime_monitor_results
WHERE index1 = '{teamId}' AND blob2 = 'http' AND timestamp >= NOW() - INTERVAL '24' HOUR
```

Weighting by `_sample_interval` matters for the same reason `getHttpDailyAggregate` already does
it: Analytics Engine statistically samples at scale, so an unweighted quantile skews. Confirm the
exact quantile function against the account's SQL dialect before relying on it — the analytics
service's docblock already warns that the dialect rejects things like `COUNT(*)`, so the
available quantile spelling needs checking rather than assuming.

This makes the p99 **one AE read query ($0.000001) instead of ~40,000 D1 rows read ($0.00004)**
— 40× cheaper today, and flat in volume rather than linear.

**3. Cache it with the other dashboard queries.** Route it through `queryAnalyticsCached` under a
`buildCacheKey(teamId, "p99")` segment, so repeated dashboard loads cost a KV read rather than a
query — the same treatment `getTeamHttpSummaries` and `getTeamHttpSparklines` already get.

**4. If it must stay in D1, bound it.** As a fallback — for instance if the quantile function is
unavailable — add `AND r.completed_at >= ?` for the 24-hour window and compute the percentile
with an `OFFSET`, so one row comes back instead of all of them:

```sql
SELECT r.response_time_ms AS p99
  FROM monitor_results r JOIN monitors m ON r.monitor_id = m.id
 WHERE ${scopeClause} AND r.response_time_ms IS NOT NULL AND r.completed_at >= ?
 ORDER BY r.response_time_ms ASC
 LIMIT 1 OFFSET (SELECT CAST(COUNT(*) * 0.99 AS INTEGER) FROM ...)
```

Still reads the window's rows to satisfy the `OFFSET`, so it fixes memory but not rows read.
Prefer option 2.

## Consequences

- **Rows read per stats call drops from ~40,000 to 0** (one AE query instead), and stops growing
  with the team's monitor count.
- **Removes a Worker memory ceiling** that would be reached at a few hundred monitors per team.
- **The p99 changes value** for existing users, because the window narrows from "whatever is in
  retention" to a stated 24 hours. It is a different — and defensible — number, but it is
  user-visible. Label it in the UI ("p99, last 24h") so it explains itself; the current label
  implies nothing about period, which is part of the problem.
- **`getStatsByTeamId` and `getStatsById` diverge in source**: the aggregate half stays in D1,
  the p99 moves to Analytics Engine. Two stores for one card. Acceptable — it mirrors how the
  dashboard already mixes them — but worth a comment on the method saying which number comes
  from where and why.
- **AE dependency for a page that currently works without it.** `queryAnalytics` already
  degrades to `failure(...)` rather than throwing, and the call site should render "—" on
  failure as the other analytics-backed cards do, so an AE outage costs one figure, not the page.
- **Unblocks retiring `monitor_results`.** This is one of the two remaining readers of the table
  (the other is `Monitor.countConsumedPingsByTeam`), so moving it is a prerequisite for ADR-002
  §15's change 3.
- Cheap and independent of ADR-003 through ADR-014; can ship any time.
