# ADR-010: Drop the Redundant Duplicate `id` Indexes

## Status

**Proposed** — 2026-07-30. Follows from [ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§5 (finding 2) and §17 (medium). Smallest cost win in the app relative to effort.

## Context

Every table declares its primary key as a text column:

```sql
CREATE TABLE `monitor_results` (
  `id` text(36) PRIMARY KEY NOT NULL,
  ...
);
```

On a normal rowid table, SQLite implements a `TEXT PRIMARY KEY` with an automatic unique
index. The migrations then create a _second_ unique index on the same column:

```sql
CREATE UNIQUE INDEX `monitor_results_id_unique` ON `monitor_results` (`id`);
```

Confirmed against `sqlite_master` on the real schema — both exist, on every table that has
the pattern:

```text
monitor_results        -> sqlite_autoindex_monitor_results_1        + monitor_results_id_unique
cron_job_pings         -> sqlite_autoindex_cron_job_pings_1         + cron_job_pings_id_unique
dns_monitor_results    -> sqlite_autoindex_dns_monitor_results_1    + dns_monitor_results_id_unique
tcp_monitor_results    -> sqlite_autoindex_tcp_monitor_results_1    + tcp_monitor_results_id_unique
cron_job_monitors      -> sqlite_autoindex_cron_job_monitors_1      + cron_job_monitors_id_unique
monitor_daily_stats    -> sqlite_autoindex_monitor_daily_stats_1    (no duplicate — the exception)
```

The same pattern exists on `monitors`, `teams`, `memberships`, `invites`, `alerts`,
`maintenance_windows`, `dns_monitors`, `tcp_monitors`, `team_domains`, and
`monitor_content_checks`; the six above are the ones on hot write paths.

The duplicate buys nothing. Nothing can use it that the primary-key index cannot: same
column, same uniqueness, same collation. It exists because the migration generator emitted an
explicit unique index for a column already declared `PRIMARY KEY`.

It costs on every write. Per D1's billing: "Indexes will add an additional written row when
writes include the indexed column, as there are two rows written: one to the table itself, and
one to the index." So each duplicate is **+1 row written per insert and +1 per delete**:

| Path                                                  | Rows written today | Without the duplicate | Saving per execution                     |
| ----------------------------------------------------- | -----------------: | --------------------: | ---------------------------------------- |
| HTTP: insert `monitor_results` + retention delete     |                 10 |                     8 | $0.000002 — **6% of expected HTTP cost** |
| TCP / DNS: insert result + update monitor             |                  6 |                     5 | $0.000001 — **17% of their cost**        |
| Cron: insert ping + update monitor + retention delete |                 12 |                    10 | $0.000002 — **16% of cost**              |
| Alerting: insert `alert_events`                       |                  6 |                     5 | $0.000001 per alert event                |

## Decision

Drop the redundant explicit unique indexes. One migration, no application change:

```sql
DROP INDEX `monitor_results_id_unique`;
DROP INDEX `cron_job_pings_id_unique`;
DROP INDEX `dns_monitor_results_id_unique`;
DROP INDEX `tcp_monitor_results_id_unique`;
DROP INDEX `cron_job_monitors_id_unique`;
-- and the same for the remaining `*_id_unique` indexes on non-hot tables
```

Before dropping each one, confirm the table's primary key really is the same single column and
that SQLite created an autoindex for it — `SELECT name, tbl_name FROM sqlite_master WHERE type
= 'index'` against the target database, not against the local file. A table whose `id` is
_not_ declared `PRIMARY KEY`, or a composite key, would make the explicit index load-bearing.
`monitor_daily_stats` shows the generator did not apply the pattern uniformly, so check rather
than assume.

Also drop the two indexes that exist only to serve `Monitor.findDue`, once
[ADR-003](./ADR-003-schedule-http-checks-from-next-due-at.md) has removed that query:

```sql
DROP INDEX `monitor_results_monitor_completed_at_response_status_response_time_idx`;
DROP INDEX `monitor_results_created_at_idx`;
CREATE INDEX `monitor_results_monitor_created_at_idx` ON `monitor_results` (`monitor_id`, `created_at`);
```

The four-column covering index exists for the materialised subquery; `created_at_idx` alone
serves nothing the composite cannot. Replacing both with one `(monitor_id, created_at)` index
keeps `Monitor.listResults`' paginated newest-first query indexed and takes
`monitor_results` from four indexes to two — insert and delete drop from 5 rows written to 3.

## Consequences

- **HTTP cost per 10,000 falls by ~$0.02, TCP and DNS by ~$0.01** from the duplicate drops
  alone. Combined with the `findDue` index cleanup and ADR-003, expected HTTP cost goes from
  $0.3477 to $0.1161 per 10,000 (ADR-002 §15, change 2).
- **No query gets slower.** The primary-key autoindex serves every lookup the dropped index
  served. `db.findOne(table, { where: { id } })` continues to be a `SEARCH … USING INDEX`.
- **Storage falls** by one index per table, which for `cron_job_pings` at 365-day retention is
  the largest single component after the table itself.
- **Verify per table before dropping.** The one real risk is dropping an index that turns out
  to be load-bearing because that table's key is not what the pattern suggests. The check is
  one query and should be run against production, not the local file.
- **The migration generator will re-add them** on the next generated migration unless its
  output is reviewed. Worth a note in `apps/uptime/AGENTS.md` so the next schema change does
  not silently reintroduce the pattern.
- Sequencing: the duplicate drops are independent and can ship immediately. The
  `findDue`-only index drops must wait for ADR-003, or the scheduler's query becomes a table
  scan instead of a covering-index scan and gets _worse_.
