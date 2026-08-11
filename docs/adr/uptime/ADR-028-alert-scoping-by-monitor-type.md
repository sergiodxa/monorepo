# ADR-028: An Alert Watches Everything, One Monitor Type, or One Monitor

## Status

**Implemented** — 2026-08-11. Answers open question 11 of
[ADR-026](./ADR-026-domain-dns-monitors-with-record-import.md).

## Background

`alerts` has carried a nullable `monitor_id` since before there were DNS, TCP or cron-job
monitors. Nothing recorded which table that id pointed into, so it could only ever be
resolved one way: as an HTTP monitor. The dispatch pipeline said so directly —
`Alert.listForHttpMonitor` for HTTP and SSL, `Alert.listTeamWide` for everything else.

The practical consequence was that a DNS, TCP or cron-job result matched **only** team-wide
alerts. There was no way to say "alert me about this domain" or "about DNS", and no way to
keep one noisy monitor type off the channel that wakes somebody up.

ADR-026 replaced the single-record DNS monitor with a domain monitor that sweeps a whole
zone. That monitor reports every record that stops resolving, every record that changes and
every record it newly discovers — all of it into every team-wide channel at once. ADR-026
named the gap as the most likely reason the feature would feel noisy in production, and
deferred it as a change to the alert model rather than to DNS.

## Decision

An alert's scope is the pair `(monitor_type, monitor_id)`, and it means exactly one of
three things:

| `monitor_type` | `monitor_id` | Scope                            |
| -------------- | ------------ | -------------------------------- |
| `NULL`         | `NULL`       | every monitor of every type      |
| `dns`          | `NULL`       | every DNS monitor, now and later |
| `dns`          | `…`          | that one DNS monitor             |

A `monitor_id` with no `monitor_type` is not a representable scope. It is the one shape the
old table could produce and the application could not resolve, and closing it is the whole
point.

`monitor_type` was **added** with `ALTER TABLE`, not rebuilt: it is a nullable column with
no default and no `CHECK`, so SQLite adds it in place. The DNS work could afford to drop and
recreate its tables because it had no rows; `alerts` has rows somebody's on-call depends on.

Rows are backfilled with one statement:

```sql
UPDATE alerts SET monitor_type = 'http' WHERE monitor_id IS NOT NULL;
```

An alert with no monitor stays `NULL`/`NULL` and therefore stays team-wide, which is what it
already was. An alert with a monitor becomes HTTP-scoped, which is what it already was. No
alert changes behaviour, in either direction, which is the constraint that decided the whole
design: widening a narrow alert floods a channel, and narrowing a wide one silently stops
notifications somebody is relying on. The second is worse than the noise being fixed.

`storedAlertScope` applies the same reading in code, so a row that somehow escaped the
backfill is still read as HTTP-scoped rather than as team-wide.

### Matching

`Alert.listForMonitor(db, teamId, monitorType, monitorId)` replaces both old lookups. It
keeps the two index seeks the old HTTP path used — `monitor_id = ?` and `monitor_id IS NULL`,
split because SQLite cannot serve that `OR` from one index scan — and filters the type in
memory. A team holds at most ten alerts, so the filter runs over a handful of rows already in
hand; a third statement or a wider index would cost more than it saved.

`dispatchAlerts` loses its `isHttpMonitor` branch entirely. Every monitor type now takes the
same path, which is the difference between fixing the model and special-casing DNS.

### SSL is not a scope

`alert_events.monitor_type` has an `ssl` value; `alerts.monitor_type` deliberately does not.
An SSL check runs against an HTTP monitor's own row, so a certificate event is dispatched
with that monitor's id and is matched by whatever watches that monitor — the same collapse
`MaintenanceWindow.isSuppressing` already applies. A separate `ssl` scope would split one
monitor's notifications across two alerts nobody asked to configure separately.

### One control, not two

The form expresses all three scopes through a single `<select name="scope">`, whose option
values encode the pair (`""`, `type:dns`, `monitor:dns:<id>`). Two coupled controls — a type
picker and a monitor picker — could be submitted saying `dns` beside an HTTP monitor's id,
and no markup-only form can prevent that; the action would have to pick a half to believe.
Encoded into one value the contradiction is not expressible, and exactly one option carries
`selected`.

A value the encoding does not produce, or one naming a monitor the team does not own, is a
validation failure rather than a fallback to team-wide. An alert scoped to a monitor that was
later deleted renders as its own selected option saying so, so saving the form untouched
cannot quietly widen it back to everything.

### The API keeps its old spelling working

`monitorType` joins `monitorId`. Sent alone, `monitorType` scopes to a whole type; sent
together, the id is looked up in that type's own table. `monitorId` **alone** is read as
HTTP — the only thing it has ever meant — so every client sending one today gets exactly what
it got yesterday. On update the pair moves as a unit: sending either field rewrites both, so
narrowing to a type cannot strand the previous monitor's id, and mentioning neither leaves the
scope alone.

## Consequences

- A customer can put DNS findings on their own channel without unsubscribing from outages.
- `maintenance_windows` still has the same gap for the same reason — its `monitor_id` is also
  HTTP-only. It is a smaller problem (a window suppresses rather than notifies) and is left
  as its own change.
- `MAX_ALERTS_PER_TEAM` stays at 10. Scoping makes each alert cheaper to keep, so the cap may
  bind sooner; whether it should move is a commercial question this ADR does not answer.

## References

- [ADR-026: Domain DNS Monitors with Record Import](./ADR-026-domain-dns-monitors-with-record-import.md) — §11 and open question 11, which this answers
- [ADR-025: An Ongoing Outage Keeps Alerting](./ADR-025-alert-repeat-policy.md) — the repeat policy, unchanged by scoping
- `apps/uptime/app/lib/alert-scope.ts`, `app/data/alert.ts`, `app/data/alert-scope-monitors.ts`, `app/services/alerts.ts`, `database/migrations/20260811100000_alert_monitor_scope.sql`
