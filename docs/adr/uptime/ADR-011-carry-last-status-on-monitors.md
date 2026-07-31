# ADR-011: Carry `last_status` on `monitors` and Retire the Per-Check Analytics Engine Query

## Status

**Accepted** — implemented 2026-07-31. Follows from
[ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md) §7 and §17 (medium).

## Context

Every HTTP check queries Analytics Engine over HTTP to learn what the previous check said:

```ts
let previous = await getLatestHttpResult(monitor.team_id, job.monitorId);
let previousStatus = isFailure(previous) ? null : (previous.data?.status ?? null);
```

`getLatestHttpResult` is an **uncached** SQL query against the Analytics Engine HTTP API:

```sql
SELECT blob3 AS status, double1 AS responseTimeMs, double3 AS responseStatus, timestamp
FROM uptime_monitor_results
WHERE index1 = '{teamId}' AND blob1 = '{monitorId}' AND blob2 = 'http'
ORDER BY timestamp DESC
LIMIT 1
```

The value is used for exactly one thing: deciding whether this result is a recovery, in
`notifyHttpResult`'s `isRecovery` test. It is then discarded.

Three costs, none large alone:

- **$0.000001 per ping** at $1.00 per million AE read queries — **3% of expected HTTP cost**,
  and the third-largest line after D1 reads and writes.
- **A round trip to `api.cloudflare.com` inside the check window**, on the critical path
  between the probe and the result commit. It widens the window in which a redelivery can
  race, and it is one more thing that can fail mid-check.
- **It sits in front of the commit for ordering reasons.** The code comments explain why:
  reading after writing this check's own data point would make "previous" the row just
  written, so no transition would ever be detected. That ordering constraint is entirely an
  artifact of storing the previous status in the same append-only stream as the new one.

The other three monitor types do not have this problem. DNS, TCP, and cron each keep their
last status on the monitor row (`dns_monitors.last_status`, `tcp_monitors.last_status`,
`cron_job_monitors.status`) and pass it straight to their `notify*` helper with no query at
all. HTTP is the outlier, and it is the outlier because its results live in Analytics Engine
rather than D1 — a consequence of
[ADR-001](./ADR-001-analytics-engine-migration.md)'s migration that was not carried through to
the recovery-detection path.

## Decision

Give `monitors` the same cached status column the other three monitor tables already have, and
delete the per-check query.

```sql
ALTER TABLE `monitors` ADD COLUMN `last_status` text;          -- 'up' | 'down' | 'degraded'
ALTER TABLE `monitors` ADD COLUMN `last_checked_at` integer;
```

`CheckHttpJob` reads `monitor.last_status` from the row it already loads — no extra statement,
no extra rows read — and writes the new status in the same `UPDATE` that
[ADR-003](./ADR-003-schedule-http-checks-from-next-due-at.md) already introduces for
`next_due_at`. So this ADR adds **zero statements** on top of ADR-003 and removes one AE query.

> **Wrong as shipped.** ADR-003 landed its claim as a scheduler-side `UPDATE … RETURNING` in
> `Monitor.findDue`, which fires once per cron tick for every due monitor — not once per check
> in the consumer. There was no consumer-side write to ride on, so `last_status` needed its own
> `UPDATE monitors`: **+1 statement and +1 row written per check**, which roughly cancels the
> per-check AE query saving. The paragraph below anticipated exactly this ("`last_status` must
> still be written in the consumer, not the scheduler"); it is the "zero statements" arithmetic
> that was optimistic, not the design. The change still pays for itself — see the corrected
> Consequences.

```ts
// before: an HTTP round trip to the AE SQL API
let previous = await getLatestHttpResult(monitor.team_id, job.monitorId);
let previousStatus = isFailure(previous) ? null : (previous.data?.status ?? null);

// after: already in hand from the findOne the job performs anyway
let previousStatus = monitor.last_status;
```

Keep `getLatestHttpResult` — it is also used by `http-monitors.tsx` to render each monitor's
current status badge. But once `monitors.last_status` exists, that N+1 (one uncached AE query
per monitor per page view, ADR-002 §12) can read the column instead, which removes the last
caller and the function with it. Doing both together is the cleaner change: one column
retires one per-check query _and_ one per-page-view N+1.

Order of writes matters. The status column must be updated **after** the result is committed,
in the same place `next_due_at` is advanced, so a job that fails before committing does not
leave a status claiming a check happened. If ADR-003's scheduler-side claim advances
`next_due_at` up front, `last_status` must still be written in the consumer, not the
scheduler — they are two different writes with two different triggers.

## Consequences

- **Removes 1 AE query per HTTP execution** — $0.000001 per ping, 3% of expected cost, and
  ~$0.18/month for the reference account. Analytics Engine is not billed yet, so this is a
  future liability retired early rather than a bill that drops today.
- **Removes a network round trip from the check's critical path**, narrowing the redelivery
  race window and removing a failure mode. The code's careful read-before-write ordering
  comment becomes unnecessary.
- **Makes HTTP consistent with the other three monitor types**, which is worth something on
  its own: recovery detection stops having two implementations.
- **Retires the monitors-list N+1** if the badge is switched to the column at the same time —
  N uncached AE queries per page view become zero.
- **Introduces a second source of truth for status.** `monitors.last_status` and the Analytics
  Engine stream can now disagree if a write to one succeeds and the other fails. The stream
  stays authoritative for history and aggregation; the column is a cache for
  transition detection and badge rendering, and should be documented as such in the schema —
  the same relationship `dns_monitors.last_value` already has.
- **Backfill is unnecessary.** A `NULL` `last_status` means "never checked", which
  `notifyHttpResult` already treats as not-a-recovery — the same semantics as today's `null`
  from a failed or empty AE query. Existing monitors self-heal on their first check.
- ~~Depends on ADR-003 to be free.~~ **Corrected.** ADR-003's write lives in the scheduler, so
  there was never a consumer-side write to ride on: this costs **+1 statement and +1 row written
  per check** regardless of ordering, roughly cancelling the per-check AE saving. What justifies
  it is the read side and the failure modes, not per-ping cost — the monitors-list N+1 goes from
  N uncached AE queries per page view to zero, an `api.cloudflare.com` round trip leaves the
  critical path between probe and commit, and recovery detection stops degrading when Analytics
  Engine is unavailable. The per-check cost is a wash; the page-view saving is not.
- `last_response_time_ms` was added alongside the two columns above. It is not in the Decision,
  but without it the monitors list's Response Time column had no source once the per-monitor AE
  query was deleted, and it rides the same `UPDATE` for no extra statement — the same trio
  `tcp_monitors` already carries.
