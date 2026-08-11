# ADR-029: A Maintenance Window Covers Everything, One Monitor Type, or One Monitor

## Status

**Implemented** — 2026-08-11. Closes the gap
[ADR-028](./ADR-028-alert-scoping-by-monitor-type.md) named and deferred.

## Background

`maintenance_windows` carried the same nullable `monitor_id` as `alerts`, with the same
missing fact: nothing recorded which monitor table the id pointed into, so it could only
ever be resolved as an HTTP monitor. `isSuppressing` said so directly — it ran the
monitor-scoped seek only when `monitorType === "http"` and returned an empty list for every
other type.

The consequence was that a DNS, TCP or cron-job check was covered by team-wide windows and
nothing else. Taking one domain offline for an hour meant either silencing every monitor the
team owns for that hour, or getting paged for work somebody scheduled.

ADR-028 fixed this for `alerts` and left this table as its own change, on the grounds that a
window suppresses rather than notifies and is therefore the smaller problem. It is the same
problem.

## Decision

A window's scope is the pair `(monitor_type, monitor_id)`, read exactly as ADR-028 defines
it:

| `monitor_type` | `monitor_id` | Scope                            |
| -------------- | ------------ | -------------------------------- |
| `NULL`         | `NULL`       | every monitor of every type      |
| `dns`          | `NULL`       | every DNS monitor, now and later |
| `dns`          | `…`          | that one DNS monitor             |

`monitor_type` was **added** with `ALTER TABLE` — a nullable column, no default, no `CHECK`,
so SQLite adds it in place rather than through the create/copy/drop/rename rebuild the
migrations in this directory use for default changes. Production holds no windows today, but
local and future environments do and the file has to be right for them; rebuilding would move
live rows, including windows scheduled for tonight, for no reason.

Rows are backfilled with one statement:

```sql
UPDATE maintenance_windows SET monitor_type = 'http' WHERE monitor_id IS NOT NULL;
```

A window with no monitor stays team-wide and a window with one becomes HTTP-scoped, which is
what each already was. `storedMonitorScope` applies the same reading in code, so a row that
escaped the backfill is read as HTTP-scoped rather than as team-wide — the defensive half
matters more here than it did for alerts, because widening a window silences monitors instead
of merely notifying about them.

### One module, not a second one

The obvious way to write this was to copy `~/app/lib/alert-scope` into a maintenance
equivalent. That would have been two modules encoding the same pair the same way, with two
parse functions, two encoders and two legacy readings, drifting apart the first time a fifth
monitor type is added.

They are the same problem, and — checked before deciding rather than assumed —
`MaintenanceMonitorKind` and `ALERT_SCOPE_TYPES` were already the identical four values, for
identical reasons, including SSL being absent from both. So the module was **generalised**
rather than copied: `~/app/lib/monitor-scope` (`MONITOR_SCOPE_TYPES`, `MonitorScope`,
`storedMonitorScope`, `monitorScopeMatches`, `encodeMonitorScope`, `parseMonitorScope`), with
`~/app/data/scope-monitors` resolving a scope against the four monitor tables and one
`MonitorScopeField` rendering the picker. Every alert call site moved to the new spelling in
the same change, so there is exactly one of each at the end. `MaintenanceMonitorKind` is gone;
`AlertMonitorKind` is now `MonitorScopeType | "ssl"`.

The shared picker reads its option copy from one `components.monitorScope` i18n namespace: a
monitor type is named the same wherever it is offered. Only the sentence explaining what
narrowing does to _this_ form differs, and each page passes its own.

### Matching

`isSuppressing` loses its `monitorType === "http"` special case and runs the monitor-scoped
seek for every type, filtering the type in memory the way `Alert.listForMonitor` does.

The two-statements-not-`OR` structure is unchanged and so is its reasoning: SQLite cannot
satisfy an `OR` across two different conditions on the same column with one index scan, so
the single-statement form degrades to seeking `team_id` alone and reading every one of that
team's windows. Split, each half is a seek on
`maintenance_windows_team_monitor_idx (team_id, monitor_id)` and both run concurrently, so
the extra statement costs no latency. What changed is only that the first seek now runs for
every monitor type instead of one.

SSL still collapses to `http` in `dispatchAlerts` before either lookup, as it always did: a
certificate check runs against the HTTP monitor's own row, so the windows covering that
monitor are the ones that cover it.

### Form and API

The form expresses all three scopes through the same single `<select name="scope">` the alert
form uses, for the same reason: two coupled controls could be submitted saying `dns` beside
an HTTP monitor's id and no markup-only form can prevent it. A value the encoding does not
produce, or one naming a monitor the team does not own, is a validation failure rather than a
fallback to team-wide, and a window pointing at a deleted monitor renders its own selected
"no longer exists" option so that saving the form untouched cannot widen it.

The API gains `monitorType` beside `monitorId`. `monitorId` **alone** is still read as HTTP —
the only thing it has ever meant — so every client sending one today is unaffected. On update
the pair moves as a unit: sending either field rewrites both, and mentioning neither leaves
the scope alone.

## Consequences

- A team can schedule maintenance on a domain, a TCP endpoint or a cron job without going
  quiet everywhere else, which is what makes the window usable at all for those types.
- There is one scope vocabulary in the app rather than two, and a fifth monitor type is one
  entry in `MONITOR_SCOPE_TYPES` plus one model in `SCOPE_MONITOR_MODELS`.
- The names ADR-028 used (`alertScopeMatches`, `~/app/lib/alert-scope`) no longer exist; that
  ADR records the earlier spelling of what is now one shared module.
- Nothing else had to change: `show_on_status_page` is stored but no public page renders a
  window yet, and the account export copies the row wholesale, so it carries the new column
  without being told. When a status page does show maintenance, it will have to decide how to
  name a type-scoped window, which has no single monitor to point at.

## References

- [ADR-028: An Alert Watches Everything, One Monitor Type, or One Monitor](./ADR-028-alert-scoping-by-monitor-type.md) — the same decision for `alerts`, and the source of this vocabulary
- [ADR-026: Domain DNS Monitors with Record Import](./ADR-026-domain-dns-monitors-with-record-import.md) — the monitor type that made per-type scoping worth having
- `apps/uptime/app/lib/monitor-scope.ts`, `app/data/maintenance-window.ts`, `app/data/scope-monitors.ts`, `resources/components/monitor-scope-field.tsx`, `database/migrations/20260811110000_maintenance_monitor_scope.sql`
