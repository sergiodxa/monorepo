# ADR-004: Bound Alert Repetition With a Default Cooldown and a Per-Incident Cap

## Status

**Accepted** — implemented 2026-07-31. Follows from
[ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§8 and §17 (critical). Second-highest-priority item in that ADR, and the only one that
addresses an _unbounded_ cost.

## Context

Down alerts are **level-triggered, not edge-triggered**. `notifyHttpResult` dispatches on
every non-healthy result:

```ts
let isRecovery = result.status === "up" && previousStatus !== null && previousStatus !== "up";
if (result.status === "up" && !isRecovery) return;
await dispatchAlerts({ ... });
```

The only thing standing between that and one email per check is `alerts.cooldown_minutes`,
which defaults to zero:

```ts
cooldown_minutes: c.integer().default(0), // 0 = no cooldown
```

and `AlertEvent.isInCooldown` short-circuits on that value without querying:

```ts
if (cooldownMinutes <= 0) return false;
```

So a monitor checked every minute that is down sends **one email per minute, indefinitely**,
for any alert created without explicitly setting a cooldown — which is every alert created
through the form's default.

| Outage length | `cooldown_minutes` | Emails |      Resend | Cloudflare Email |
| ------------- | ------------------ | -----: | ----------: | ---------------: |
| 30 minutes    | 0 (default)        |     31 |     $0.0279 |          $0.0109 |
| 30 minutes    | 15                 |      3 |     $0.0027 |          $0.0011 |
| 24 hours      | 0 (default)        |  1,441 |     $1.2969 |          $0.5044 |
| 7 days        | 0 (default)        | 10,081 | **$9.0729** |          $3.5284 |

A single week-long outage on one 1-minute monitor with one email alert costs more than the
entire $5 subscription, and more than the account's whole monthly infrastructure bill. It is
the only cost in the system with no upper bound.

`notifySslResult` is worse in kind, though smaller in volume: it is deliberately not
edge-triggered ("repeated reminders, not a one-time transition") and fires every day
`shouldAlertOnSslStatus` says to, bounded only by the same defaulted-to-zero cooldown.

This is also a product problem before it is a cost problem. 1,441 identical emails about one
outage is not a feature.

## Decision

Three changes, smallest first.

**1. Default `cooldown_minutes` to 15.**

```sql
-- new alerts only; see Consequences for existing rows
ALTER TABLE `alerts` ADD COLUMN `cooldown_minutes_v2` integer NOT NULL DEFAULT 15;
```

In practice: change the schema default, change the validator's default in
`app/http/validators/alert.ts`, and change the form's `defaultValue`. Fifteen minutes is
chosen because it is short enough that a genuine state change reaches the user quickly and
long enough that a day-long outage produces 96 emails rather than 1,441. Keep `0` a _legal_
value so a user can explicitly opt into every-check notification; just stop it being what
they get by accident.

**2. Add a per-incident email ceiling, independent of cooldown.**

Cooldown throttles rate; it does not bound total. Add a hard cap on consecutive `sent`
events for the same `(alert_id, monitor_id, event_type)` run without an intervening
recovery — 10 is a reasonable default. `alert_events` already carries everything needed to
compute it, and the `alert_events_alert_monitor_event_sent_idx` index already covers the
lookup. Record suppressed attempts with a new `status` value (`"skipped_cap"`) so the
history explains itself rather than going silent.

**3. Make the recovery email say what was suppressed.**

If 96 down-emails were sent and 300 suppressed, the recovery email should say so. Without
that, the cap looks like dropped alerts.

## Implementation notes

- The cap check belongs in `deliverOne` alongside the existing cooldown check in
  `app/services/alerts.ts`, so every monitor type inherits it — the same reason cooldown
  and recovery policy already live there rather than per-job.
- `isInCooldown`'s early return for `<= 0` should stay. The cap is what protects an
  explicit `cooldown_minutes: 0`.
- The count query must be bounded (`LIMIT`) and must not scan the whole run: count `sent`
  events since the last `up` event for that pair, using the existing composite index.
- Apply the same cap to SSL reminders. `notifySslResult`'s repeated-reminder behaviour is
  intentional and should stay, but 30 consecutive daily emails for one certificate is the
  same failure in slow motion.

## Consequences

- **The only unbounded cost in the system becomes bounded.** Worst-case incident email cost
  falls from $9.07 (and rising with outage length) to ~$0.01, regardless of duration.
- **Email volume drops roughly 10× for a typical incident**, which is the larger lever on
  email spend than switching transport
  ([ADR-016 does not cover this](./ADR-016-protect-the-public-endpoints.md); the transport
  question is noted in ADR-002 §18 and should be decided _after_ this change, because a 10×
  volume reduction matters more than a 2.6× rate reduction).
- **Existing alert rows keep `cooldown_minutes = 0`** unless backfilled. A schema default
  only affects new rows. Decide explicitly: either backfill `UPDATE alerts SET
cooldown_minutes = 15 WHERE cooldown_minutes = 0` — which silently changes behaviour users
  may be relying on — or leave them and rely on the per-incident cap, which is why the cap
  is part of this ADR rather than a follow-up. **Recommended: leave existing rows, ship the
  cap.**
- Users who genuinely want every-check notification can still set `0`; they now get at most
  10 per incident. If that turns out to be too restrictive, the cap is a constant, not a
  redesign.
- `alert_events` gains a `status` value, so anything switching exhaustively on it — the
  alert-history view, the API serialiser — needs the new case.
