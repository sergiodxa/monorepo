# ADR-006: Honour `interval_seconds` for TCP and DNS Monitors

## Status

**Proposed** — 2026-07-30. Follows from [ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§11 and §17 (high). A billing-integrity bug, not a cost optimisation.

## Context

`tcp_monitors` and `dns_monitors` both carry an `interval_seconds` column with a default
(60 for TCP, 3600 for DNS). Both are editable in the UI —
`resources/views/tcp-monitors/form.tsx` and `resources/views/dns-monitors/form.tsx` render
them — and both are billed against: `Monitor.estimateConsumedPingsByTeam` projects each
monitor as `monthMs / (interval_seconds * 1000)`.

Neither job reads the column. `CheckTcpJob` sweeps everything, every 5 minutes:

```ts
let monitors = await TcpMonitor.listEnabled(db);
for (let monitor of monitors) { ... }
```

`CheckDnsJob` does the same, hourly. Both docblocks are candid about it — "TCP monitors are
not staggered by their individual `interval_seconds`" — but the field remains in the schema,
the form, the REST API, and the ping projection.

The bill and the work therefore disagree, in both directions:

| Configured interval     | Projected pings/month | Actual executions/month | Error                              |
| ----------------------- | --------------------: | ----------------------: | ---------------------------------- |
| DNS, 5 minutes          |                 8,927 |                     743 | billed **12× more** than performed |
| DNS, 1 hour (default)   |                   743 |                     743 | correct by coincidence             |
| DNS, 1 day              |                    30 |                     743 | performed **25× more** than billed |
| TCP, 1 minute (default) |                44,639 |                   8,927 | billed **5× more** than performed  |
| TCP, 5 minutes          |                 8,927 |                   8,927 | correct by coincidence             |
| TCP, 1 hour             |                   743 |                   8,927 | performed **12× more** than billed |

Only the value that happens to match the sweep cadence is right. A user who sets a DNS
monitor to 5 minutes is overcharged twelvefold for checks that never happen; a user who sets
it to daily gets 743 checks they are not billed for. The dashboard shows the projection as
the estimate next to real consumption, so the two numbers visibly disagree with no
explanation.

This cannot be fixed with a ping weight ([ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§11 explains why): the error is per-monitor and signed, not a uniform multiplier.

## Decision

Honour the interval. Give TCP and DNS the same `next_due_at` scheduling
[ADR-003](./ADR-003-schedule-http-checks-from-next-due-at.md) introduces for HTTP, and turn
the sweeps into due-filtered sweeps rather than sweep-everything.

```sql
ALTER TABLE `tcp_monitors` ADD COLUMN `next_due_at` integer;
CREATE INDEX `tcp_monitors_next_due_at_idx` ON `tcp_monitors` (`next_due_at`);
ALTER TABLE `dns_monitors` ADD COLUMN `next_due_at` integer;
CREATE INDEX `dns_monitors_next_due_at_idx` ON `dns_monitors` (`next_due_at`);
```

`listEnabled` becomes `claimDue`, using the same conditional `UPDATE … RETURNING` shape as
ADR-003, advanced by whole intervals from the previous due time.

Then raise the sweep cadence to the finest interval the product allows, so a monitor's
configured interval is actually reachable:

```jsonc
"crons": [
  "* * * * *",    // uptime monitors + cron job monitors + TCP + DNS
  // "*/5 * * * *" and "0 * * * *" no longer needed for TCP/DNS
]
```

Fold `checkTcp` and `checkDns` into the every-minute delivery. Because the sweep now claims
only due monitors, running it every minute costs an indexed range scan that matches nothing
in most minutes — cheaper than today's hourly full `listEnabled` scan, not more expensive.

Enforce a floor on `interval_seconds` in the validators, matching HTTP's 60-second minimum,
so the finest configurable interval and the finest schedulable interval agree.

### Alternative considered and rejected

**Remove `interval_seconds` from the TCP and DNS forms, API, and projection**, documenting
the fixed cadences. This is a smaller change and makes the bill honest immediately. Rejected
because it removes a capability users already believe they have and already see in the UI,
and because per-monitor intervals are the normal shape of this product — HTTP has them, and
the ping model is built around them. It remains the correct fallback if scheduling parity is
deferred: the bug is _the disagreement_, and either side can be moved to fix it.

## Consequences

- **Billing becomes truthful for TCP and DNS.** Projected and consumed pings converge, which
  is the point.
- **Executed volume changes for existing monitors, in both directions.** A DNS monitor left
  at the 1-hour default is unaffected. One set to 5 minutes starts running 12× more often
  and its bill stops overstating; one set to daily runs 25× less often and its bill stops
  understating. Both are corrections, but both are user-visible — this needs a changelog
  entry and probably an email to affected accounts before it ships.
- **Cost per execution is unchanged**; only the number of executions changes. At ADR-002's
  expected $0.0637 per 10,000 DNS executions, even a 12× increase on a handful of monitors is
  cents.
- **Two cron schedules disappear** from `wrangler.jsonc`, and the every-minute delivery does
  slightly more work. Net cost is lower, because a due-filtered indexed scan beats an
  unfiltered `listEnabled`.
- **Sweep duration pressure rises**, since TCP checks now run up to every minute rather than
  every 5. That makes [ADR-008](./ADR-008-bounded-concurrency-sweeps.md) (bounded-concurrency
  sweeps) a prerequisite, not a parallel improvement — a sequential TCP sweep with 5-second
  timeouts cannot fit a 1-minute budget.
- Depends on ADR-003 landing first, or at least on its `next_due_at` claim helper being
  written so all three monitor types share one implementation rather than three.
