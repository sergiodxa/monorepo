# ADR-014: Index and Split the Alert and Maintenance-Window Lookups

## Status

**Accepted** — implemented 2026-07-30. Follows from
[ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§5 and §17 (medium). Cheap today, linear in total tenants forever.

## Context

Every non-healthy result runs the alert pipeline, which starts with two lookups. The first is
indexed; the second is not.

`Alert.listForHttpMonitor`:

```ts
return await db.findMany(alerts, {
	where: and(eq("team_id", teamId), or(eq("monitor_id", monitorId), isNull("monitor_id"))),
});
```

`EXPLAIN QUERY PLAN` for that shape:

```text
QUERY PLAN
`--SCAN alerts
```

A full table scan — of **every alert row belonging to every tenant** — to find one team's up to
ten alerts. Two reasons compound:

1. `alerts` has no index on `team_id`. Its only index is `alerts_id_unique`, which
   [ADR-010](./ADR-010-drop-redundant-duplicate-id-indexes.md) shows is itself redundant with
   the primary key. So the table has, in effect, no usable secondary index at all.
2. Even with one, the `OR monitor_id IS NULL` disjunction would defeat a simple
   `(team_id)` index for part of the predicate — SQLite cannot satisfy an `OR` across two
   different column conditions with one index scan.

`Alert.listTeamWide`, used by DNS, TCP, and cron results, has the same missing index without the
`OR`:

```ts
return await db.findMany(alerts, { where: { team_id: teamId, monitor_id: null } });
```

`MaintenanceWindow.isSuppressing` runs first and is the better-behaved of the two — it does have
`maintenance_windows_team_idx`:

```text
QUERY PLAN
`--SEARCH maintenance_windows USING INDEX maintenance_windows_team_idx (team_id=?)
```

but it then reads every one of that team's windows and evaluates recurrence in JS, which is
correct and bounded.

At current scale this costs nothing measurable: ~10 rows scanned, $0.00000001. The problem is
the growth curve. Rows read per alerting result is `total alerts across all tenants`, so:

| Tenants × alerts each | Rows scanned per alerting result |                                Cost per result |
| --------------------: | -------------------------------: | ---------------------------------------------: |
|                1 × 10 |                               10 |                                    $0.00000001 |
|               100 × 5 |                              500 |                                     $0.0000005 |
|             1,000 × 5 |                            5,000 |                                      $0.000005 |
|            10,000 × 5 |                           50,000 | $0.00005 — **1.4× a whole healthy HTTP check** |

It is also worst exactly when it matters least affordable: a broad incident takes many monitors
down at once, and each down result scans the whole table. Latency, not cost, is what bites
first — the scan sits between detecting a failure and sending the alert.

## Decision

**1. Index the team scope.**

```sql
CREATE INDEX `alerts_team_monitor_idx` ON `alerts` (`team_id`, `monitor_id`);
```

A composite on `(team_id, monitor_id)` serves both call sites: `listTeamWide`'s
`team_id = ? AND monitor_id IS NULL` becomes a direct seek, and each half of
`listForHttpMonitor`'s disjunction becomes a seek too.

**2. Split the `OR` into two indexed seeks, combined in JS.**

```ts
static async listForHttpMonitor(db: Database, teamId: string, monitorId: string) {
  let [monitorScoped, teamWide] = await Promise.all([
    db.findMany(alerts, { where: { team_id: teamId, monitor_id: monitorId } }),
    db.findMany(alerts, { where: { team_id: teamId, monitor_id: null } }),
  ]);
  return [...monitorScoped, ...teamWide];
}
```

Two statements instead of one, but each is an index seek returning a handful of rows, so rows
read drops from `all alerts platform-wide` to `this team's applicable alerts` — from thousands
to single digits. Two cheap statements beat one unbounded scan; D1 bills rows, not statements.

The concatenation order matters slightly: `dispatchAlerts` then filters on `notify_on_recovery`
and delivers via `Promise.allSettled`, so ordering does not affect behaviour — but keeping
monitor-scoped first preserves today's effective precedence if that ever changes.

**3. While here, add the index `CleanJob` needs.** Unrelated to alerts but the same class of
omission, called out in [ADR-020](./ADR-020-retention-for-every-result-table.md):

```sql
CREATE INDEX `monitor_results_completed_at_idx` ON `monitor_results` (`completed_at`);
```

`DELETE FROM monitor_results WHERE completed_at < ?` is a full scan today. Only worth adding if
`monitor_results` survives — [ADR-011](./ADR-011-carry-last-status-on-monitors.md) and ADR-002
§15 contemplate retiring the table — so sequence it after that decision, or skip it.

## Consequences

- **Rows read per alerting result becomes bounded by the team, not the platform.** The growth
  curve flattens: 50,000 rows scanned at 10,000 tenants becomes ~5.
- **Latency on the alert path improves**, which matters more than the money. The scan currently
  sits between detecting a failure and dispatching, and it is slowest during a broad incident.
- **Adds one index to `alerts`**, so alert create/update/delete write one extra row —
  $0.000001, on an operation that happens when a user edits an alert. Irrelevant.
- **Adds one statement per alerting result.** At $0 per statement (D1 bills rows) and with both
  statements running under `Promise.all`, there is no latency cost either.
- **No behaviour change.** Same rows returned, same order semantics, same filtering downstream.
- **Cheap and independent.** Nothing in this ADR depends on ADR-003 through ADR-013, and it can
  ship in the same migration as ADR-010's index cleanup.
- Worth a test that a team's alerts are found and another team's are not — the current full
  scan makes tenant isolation a property of the `WHERE` clause alone, and after this change it
  becomes a property of the index too.
