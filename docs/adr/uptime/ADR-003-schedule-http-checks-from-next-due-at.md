# ADR-003: Schedule HTTP Checks From a `next_due_at` Column

## Status

**Proposed** — 2026-07-30. Follows from [ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§5 (finding 1), §11 (drift), and §15 (change 1). Highest-priority item in that ADR.

## Context

`Monitor.findDue` decides which HTTP monitors are due by recomputing each monitor's last
completion from the whole result table:

```sql
SELECT m.id AS monitorId, t.owner_id AS ownerId
FROM monitors m
JOIN teams t ON t.id = m.team_id
LEFT JOIN (
  SELECT monitor_id, MAX(completed_at) AS last_completed_at
  FROM monitor_results
  WHERE completed_at IS NOT NULL
  GROUP BY monitor_id
) r ON r.monitor_id = m.id
WHERE m.enabled_at IS NOT NULL
  AND (r.last_completed_at IS NULL OR r.last_completed_at + (m.interval_seconds * 1000) <= ?)
```

`EXPLAIN QUERY PLAN` output for that query against the real schema — this is the planner
describing what it already does, **not** SQL or a hint anyone writes:

```text
QUERY PLAN
|--MATERIALIZE r
|  `--SCAN monitor_results USING COVERING INDEX monitor_results_monitor_completed_at_response_status_response_time_idx
|--SCAN m
|--SEARCH t USING INDEX teams_id_unique (id=?)
`--SEARCH r USING AUTOMATIC COVERING INDEX (monitor_id=?) LEFT-JOIN
```

`MATERIALIZE r` is how `EXPLAIN QUERY PLAN` reports that it evaluated the `LEFT JOIN (SELECT
… GROUP BY …)` subquery into a transient table before joining. It is a fact about the current
query's execution, not a technique being proposed; the decision below removes the subquery, so
the planner never reaches that step again.

Two full scans. The subquery cannot be satisfied by a seek, so SQLite materialises it over
every row in `monitor_results`; `SCAN m` is a second full scan because `monitors` has no
index on `enabled_at`. The query runs once per every-minute cron delivery.

> **How this plan was captured, and its limits.** Run with the host `sqlite3` 3.51.0 against a
> copy of the local D1 database file, because that is where the real schema and index set live.
> D1 runs its own SQLite build, so the exact plan text and the planner's choices may differ in
> production. What does **not** depend on the planner: `MAX(completed_at) … GROUP BY
monitor_id` over an unfiltered table has to read every row of it, by any strategy. Confirm on
> D1 directly with `wrangler d1 execute DB --remote --command "EXPLAIN QUERY PLAN …"`, and
> treat `meta.rows_read` from a real response as the authoritative number — see
> [ADR-019](./ADR-019-instrument-d1-rows-and-do-wall-time.md).

Three separate problems follow.

**Cost.** `monitor_results` holds 7 days of history, so rows read per ping is
`10,080 × K + 129,600 × K × Nm / P` — scale-invariant in the dominant term. At K = 2 that is
≈20,167 rows read per ping, **58% of expected HTTP cost** and 97% of D1 rows read. There is
no economy of scale to grow into: the per-ping figure does not fall as volume rises.

**Drift.** The predicate compares against `MAX(completed_at)`, and `completed_at` is stamped
_after_ the probe returns. Each check's due time therefore slides forward by its own latency
plus queue delay. A check completing at 12:00:01.5 is not due at the 12:01:00 delivery, so a
1-minute monitor silently becomes a 2-minute monitor unless the duplicate cron delivery
(~7 s later, see `Monitor.scheduledJobId`) happens to rescue it. The product under-delivers
checks and under-bills for them.

**Duplicate work.** Because nothing is claimed, every cron delivery within the same minute
re-reads the same monitor as due and enqueues another message. The minute-bucketed job id
stops the second message from performing a second check, but the queue operations, the
scheduler's D1 reads, and the Polar call are all paid K times.

## Decision

Store each monitor's next due time on the monitor row, index it, and **claim** due monitors
with a single conditional `UPDATE … RETURNING` instead of computing them from history.

Add to `monitors`:

```sql
ALTER TABLE `monitors` ADD COLUMN `next_due_at` integer;
CREATE INDEX `monitors_next_due_at_idx` ON `monitors` (`next_due_at`);
```

`next_due_at` is `NULL` exactly when the monitor is not scheduled — disabled, or never
enabled. That makes it the single scheduling predicate and subsumes the `enabled_at IS NOT
NULL` check, so no index on `enabled_at` is needed.

`findDue` becomes a claim plus an owner lookup:

```sql
-- 1. claim: advances the due time and returns only the rows it actually claimed
UPDATE monitors
   SET next_due_at = ?, updated_at = ?
 WHERE next_due_at IS NOT NULL AND next_due_at <= ?
RETURNING id AS monitorId, team_id AS teamId;

-- 2. owners for the claimed teams, indexed point lookups
SELECT id, owner_id FROM teams WHERE id IN (...);
```

The new due time is advanced **from the previous due time, not from completion**, by whole
intervals until strictly greater than now:

```text
next = previous_next_due_at
while next <= now: next += interval_seconds * 1000
```

Advancing by whole intervals keeps the cadence anchored to the schedule (no drift) while the
`while` loop prevents a catch-up storm after an outage — a monitor that was unscheduled for
an hour gets one check, not sixty.

Write `next_due_at` in the three places that change scheduling: `Monitor.create` (to
`Date.now()`, so the first check runs on the next tick), `Monitor.updateById` when
`interval_seconds` or `enabled_at` changes, and the claim above. Set it to `NULL` when a
monitor is disabled.

Keep the `monitor_results` primary-key dedupe. The claim is atomic, so it should prevent
duplicate messages on its own, but the existing job-id collision stays as the correctness
backstop and costs nothing when it never fires.

## Consequences

- **D1 rows read per HTTP ping falls from ≈20,167 to ≈21**, and rows written rises by 2 (the
  claimed row plus its `next_due_at` index entry). Expected HTTP cost drops from $0.3477 to
  $0.1661 per 10,000 — a **2.1× improvement**, and the largest single cost reduction
  available anywhere in the app.
- **Duplicate cron deliveries stop enqueuing duplicate messages.** The second delivery in a
  minute finds nothing to claim, so queue operations fall from 3K to 3 per ping and the K
  multiplier largely disappears from the cost model. The Polar call also drops to once per
  minute per owner with work to do, rather than once per delivery.
- **The configured interval becomes authoritative.** A 1-minute monitor is checked every
  minute. Measured ping consumption will _rise_ toward the dashboard's projection, which is
  a billing increase for existing customers — worth a changelog note, and worth checking
  against the allowance analysis in ADR-002 §14 before shipping.
- **A lost message now costs one interval, not zero.** Today an unacked, undelivered message
  leaves the monitor perpetually due, so it is retried every minute. After this change the
  due time has already advanced, so a dropped message means one missed check. That is the
  right trade — but it makes [ADR-018](./ADR-018-dead-letter-queue-for-the-ping-queue.md)
  (a dead-letter queue) more valuable, since a dropped message becomes invisible otherwise.
- **A non-subscribed owner's monitors are claimed before the subscription filter runs**, so
  their due time advances without a check. Correct in effect — they are not paying — but it
  means up to one interval of delay after they subscribe.
  [ADR-005](./ADR-005-replicate-polar-subscriptions-into-d1.md) removes the problem rather than
  working around it: once Polar webhooks own scheduling, a revoked subscription sets
  `next_due_at = NULL` and an activated one sets it to now, so the claim query never needs to
  know about subscriptions at all and resumption is immediate.
- Unblocks retiring the `findDue`-only indexes on `monitor_results`
  ([ADR-010](./ADR-010-drop-redundant-duplicate-id-indexes.md)) and, eventually, the table
  itself.
- `Monitor.findDue`'s existing tests need rewriting around the claim semantics: the same
  monitor must not be claimed twice by two consecutive calls, and a disabled monitor must
  not be claimed at all.
