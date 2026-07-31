# ADR-020: Retention for Every Result Table

## Status

**Proposed** — 2026-07-30. Follows from [ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§12 (storage) and §17 (high).

## Context

Two retention jobs exist, and between them they cover two tables:

- `CleanJob` — `DELETE FROM monitor_results WHERE completed_at < ?`, 7-day cutoff.
- `CleanCronJobPingsJob` — `DELETE FROM cron_job_pings WHERE created_at < ?`, 365-day cutoff.

Three tables that grow with monitor activity have **no retention job at all**:

| Table                 | Written per                               | Rows written each | Purged by |
| --------------------- | ----------------------------------------- | ----------------: | --------- |
| `dns_monitor_results` | DNS execution                             |                 5 | nothing   |
| `tcp_monitor_results` | TCP execution                             |                 5 | nothing   |
| `alert_events`        | alert delivery, cooldown skip, or failure |                 6 | nothing   |

Storage is the smaller half of the problem. The larger half is that all three are read by
queries whose cost scales with table size:

- `AggregateDailyStatsJob.aggregateD1` runs `SELECT … GROUP BY` over `dns_monitor_results`
  and `tcp_monitor_results` filtered on `checked_at` between day bounds. `checked_at` is
  indexed, so it is a range scan today — but the table it scans never stops growing, and any
  future query that filters on something else becomes a full scan of unbounded data.
- `Monitor.countConsumedPingsByTeam` counts `dns_monitor_results` and `tcp_monitor_results`
  for the raw 2-day window, joined to their monitor tables. It runs on every dashboard usage
  card render.
- The alert-history view reads `alert_events` via `AlertEvent.listByAlertIds`, ordered by
  `sent_at desc` with a limit — bounded per query, but the index it walks grows forever.

`alert_events` is the fastest-growing of the three in a bad month, because
`cooldown_minutes` defaults to 0 ([ADR-004](./ADR-004-bound-alert-repetition.md)): a
week-long outage on one 1-minute monitor writes 10,081 rows × 6 = ~60,000 rows written to
that table alone.

`cron_job_pings` is covered but generous: 365 days of rows that carry `source_ip` and
`user_agent` strings. At ~368 MB steady state for the reference account it is 46× the storage
of `monitor_results` despite a third of the write volume, and it is the only material storage
line in the app today.

## Decision

**1. Extend `CleanJob` to cover every result table**, rather than adding three more jobs.
It already runs daily at midnight on its own cron and its own queue message; the work is four
`DELETE`s instead of one.

```sql
DELETE FROM monitor_results     WHERE completed_at < ?;   -- 7 days, unchanged
DELETE FROM dns_monitor_results WHERE checked_at   < ?;   -- 90 days
DELETE FROM tcp_monitor_results WHERE checked_at   < ?;   -- 90 days
DELETE FROM alert_events        WHERE sent_at      < ?;   -- 90 days
```

Ninety days for the three uncovered tables: long enough to be useful history on a monitor
detail page and in an incident post-mortem, short enough that steady-state size is a function
of rate rather than of account age. `monitor_results` keeps 7 days because its docblock is
explicit that it is a "last checked" cache plus the counting window, not history — long-term
HTTP history lives in Analytics Engine.

Each `DELETE` needs a supporting index to avoid a full scan. `dns_monitor_results` and
`tcp_monitor_results` already have `checked_at_idx`; `alert_events` already has
`alert_events_sent_at_idx`. `monitor_results` has **no index on `completed_at` alone**, so its
existing `DELETE` is a full scan today — cheap at 40,000 rows, worth fixing while here.

**2. Bound the delete.** A first run against a table that has grown for a year could delete
millions of rows in one statement, at 5–6 rows written each. Delete in bounded batches
(`DELETE … WHERE … LIMIT 10000`, looped until `affectedRows` is zero, with a per-run ceiling)
so the job cannot exceed its invocation limits or produce a single enormous write bill.

**3. Narrow what `cron_job_pings` retains.** Keep the 365-day window — the docs promise it —
but stop storing `user_agent` verbatim for a year. Either drop the column after 30 days
(`UPDATE cron_job_pings SET user_agent = NULL, source_ip = NULL WHERE created_at < ?`) or stop
recording it at all. It exists for debugging a misconfigured caller, which is a
days-old question, not a year-old one. This is also the app's largest personal-data retention
surface: `source_ip` kept for a year is a privacy decision as much as a cost one.

## Consequences

- **Three unbounded growth curves become bounded.** Steady-state size for the three
  newly-covered tables becomes 90 days × write rate, independent of account age.
- **Storage cost stays negligible** either way at current volume — the reference account's
  total D1 storage is ~0.4 GB against a 5 GB included allowance. This ADR is about the
  _query_ cost that grows with those tables and about not discovering the problem at 100×
  volume.
- **Adds rows written**: 5–6 per deleted row, deferred by the retention window. That cost is
  already modelled in ADR-002's per-execution tables for `monitor_results` and
  `cron_job_pings`, and adding it for DNS/TCP raises their per-execution cost from
  $0.0637/$0.0635 to roughly $0.113/$0.111 per 10,000 — still under a third of HTTP, so the
  ping weights in ADR-002 §11 do not change.
- **The first run after deploying will be large** for any table that has already accumulated.
  The batching in decision 2 is what makes that safe; without it the first run is the risk.
- **Narrowing `cron_job_pings` loses debugging data.** If `user_agent` turns out to matter
  beyond 30 days, that is recoverable by widening the window; the reverse — discovering a
  year of retained IPs during a privacy review — is not.
- Interacts with [ADR-004](./ADR-004-bound-alert-repetition.md): capping alert repetition
  reduces `alert_events` growth at the source, which matters more than deleting the rows
  later. Both are worth doing; ADR-004 first.
