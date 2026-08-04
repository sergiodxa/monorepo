# ADR-025: An Ongoing Outage Keeps Alerting, Bounded by Rate Instead of Total

## Status

**Implemented** — 2026-08-04. Supersedes part of
[ADR-004](./ADR-004-bound-alert-repetition.md) (see [Superseded Decisions](#superseded-decisions)).

## Background

ADR-004 bounded alert repetition two ways at once: it raised the `alerts.cooldown_minutes`
default from 0 to 15, and it added a per-incident ceiling of 10 `sent` notifications for the
same `(alert_id, monitor_id, event_type)` run without an intervening recovery. The ceiling was
what made the ADR safe to ship without backfilling rows that store `0`.

The product owner has since specified the alert repeat policy directly, and the ceiling
contradicts it. The policy is: notify **immediately** when a monitor is detected down (no
confirming second check); while it stays down, stay quiet until an hour has passed and then
notify **again**, for as long as the outage lasts; plus **one** notification on recovery. A
ceiling of 10 silences an hourly alert after ten hours of downtime — precisely the outage worth
being told about.

## Context

### What the ceiling actually bounded

The ceiling bounded the total number of notifications per incident. The problem it was
protecting against was a _rate_ problem: `cooldown_minutes: 0` is a legal stored value, and
`AlertEvent.isInCooldown` short-circuits on it (`if (cooldownMinutes <= 0) return false`), so a
1-minute monitor that is down produces one notification per check. Bounding the total does stop
that, but it also stops every well-configured long outage from being reported.

### Why a validator minimum cannot replace it

| Path                                                         | Behaviour                                                                                                |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Rows already stored                                          | Never re-validated. Existing `0` rows keep spamming whatever the validator says.                         |
| Dashboard edit form (`resources/views/alerts/form.tsx`)      | Loads `alert.cooldown_minutes` and posts it back, so a raised minimum rejects a row's own current value. |
| `POST /api/v1/alerts` (`app/http/controllers/api/alerts.ts`) | `cooldownMinutes: s.defaulted(..., 0)` — an omitted field still stores `0`.                              |

A validator minimum reaches only newly submitted values, which is the one population that was
never the problem. Treating `0` as a sentinel for the default would fix `0` and leave `1` —
also legal, also one notification per check on a 1-minute monitor.

### The latent first-alert bug

The old ceiling and cooldown checks were both purely time-scoped: any `sent` event inside the
window suppressed the next notification. A new outage starting shortly after a recovery was
therefore silenced by the _previous_ incident's cooldown window, and raising the default
cooldown to 60 would have widened that window fourfold.

## Decision

### 1. Remove the per-incident ceiling

`MAX_CONSECUTIVE_SENDS` is gone from `app/services/alerts.ts`. Nothing writes
`alert_events.status = 'skipped_cap'` any more. The enum value stays in
`database/schema.ts` (`alertEventStatuses`) and `AlertEvent.summarizeIncident` still counts it
as suppressed, because incidents that began under the old policy carry those rows. This is a
deliberate product decision, not a regression.

### 2. Default `cooldown_minutes` to 60

`database/migrations/20260804120000_alert_cooldown_default.sql` rebuilds `alerts` with
`cooldown_minutes integer DEFAULT 60 NOT NULL`; `database/schema.ts` and the form validator
(`app/http/validators/alert.ts`) default to 60 to match. **Existing rows are deliberately not
rewritten** — the same reasoning ADR-004 applied when the default moved from 0 to 15. A team
that chose a cooldown chose it.

### 3. Make the first notification of an incident incident-scoped, not time-scoped

`suppressionReason` now asks whether the incident has been notified _at all_ before consulting
any cooldown:

```ts
let alreadyNotified = await AlertEvent.countSentSinceRecovery(
	db,
	alert.id,
	monitorId,
	eventType,
	1,
);
if (alreadyNotified === 0) return null;
```

`countSentSinceRecovery` counts `sent` events after the pair's last `up` event, so the check is
scoped to the current incident. Two consequences: no cooldown value, however large, can delay
the news that something just went down; and the latent bug above is fixed, because the previous
incident's sends are outside the count.

### 4. Floor repeats at five minutes

```ts
const MIN_REPEAT_COOLDOWN_MINUTES = 5;

function repeatCooldownMinutes(alert: SelectAlert): number {
	return Math.max(alert.cooldown_minutes, MIN_REPEAT_COOLDOWN_MINUTES);
}
```

Applied only to level-triggered repeats. It is a dispatch-time floor, so it reaches stored rows,
form-created rows, and API-created rows at once, honours every configured value at or above it,
and needs no data migration. Five minutes: the fastest interval this app schedules is 60
seconds, so any floor above one minute makes "one notification per check" unrepresentable, and
five keeps the worst case at 12 notifications an hour. A stored `0` now means "as often as
allowed", not "every check".

### 5. Leave recovery unfloored and uncapped

Recovery is edge-triggered and ends the incident, so it needs no floor and no ceiling. It is
still gated by the alert's own configured `cooldown_minutes` — deliberately, because that gate
is all that stands between a flapping monitor and one "recovered" notification per flap.

## Superseded Decisions

From [ADR-004](./ADR-004-bound-alert-repetition.md):

| Superseded text (exact heading or bullet)                                                                                                                                                    | Replacement                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Title: "Bound Alert Repetition With a Default Cooldown and a Per-Incident Cap"                                                                                                               | Repetition is bounded by rate only; the total is unbounded.                                          |
| Decision 1: "**1. Default `cooldown_minutes` to 15.**"                                                                                                                                       | Default is 60 (Decision 2 above).                                                                    |
| Decision 2: "**2. Add a per-incident email ceiling, independent of cooldown.**"                                                                                                              | Removed entirely (Decision 1 above); replaced by the dispatch-time floor (Decision 4 above).         |
| Implementation note: "Apply the same cap to SSL reminders."                                                                                                                                  | No cap exists to apply. See [Open Question](#open-question-ssl-reminders-have-no-incident-boundary). |
| Consequence: "**The only unbounded cost in the system becomes bounded.** Worst-case incident email cost falls from $9.07 (and rising with outage length) to ~$0.01, regardless of duration." | False as of this ADR. Incident email cost is again unbounded in outage length.                       |
| Consequence: "Users who genuinely want every-check notification can still set `0`; they now get at most 10 per incident."                                                                    | `0` is honoured as a rate, floored at one notification per five minutes, with no per-incident total. |

ADR-004's Decision 3 ("**3. Make the recovery email say what was suppressed.**") stands
unchanged, and `AlertEvent.summarizeIncident` still backs it.

## Consequences

### Positive

- **An alert never goes silent during an outage.** The behaviour matches what a monitoring
  product is bought for: the outage keeps saying so until it ends.
- **No cooldown value can delay the first notification.** Raising the default to 60 costs
  nothing in detection latency, because the first notification of an incident does not consult
  cooldown at all.
- **A new outage right after a recovery is no longer silenced** by the previous incident's
  window.
- **Per-check spam is unrepresentable.** Previously it was legal and merely capped; now the
  floor makes it unreachable for every row, including the ones no validator will ever see
  again.

### Negative

- **Incident email cost is unbounded in outage length again.** A 7-day outage on an hourly
  alert is ~168 emails (~$0.15 at ADR-004's Resend rate of ~$0.0009/email). The floor's worst
  case — a `cooldown_minutes` of 0 or below 5 — is 12 emails an hour, ~2,016 over 7 days
  (~$1.81). ADR-004 rejected exactly this shape of cost. The decision here is that an alert
  which never goes silent is worth it: the worst case requires both an explicitly low cooldown
  and a week-long unattended outage, and email remains the most expensive thing this app does.
- **A team that leaves an outage unattended for days gets a notification an hour for days.**
  That is the intended behaviour, and it will read as noise to some users. The lever is the
  cooldown, which reaches 1440 (24 hours).
- **SSL reminders lost their only bound.** See below.

### Neutral

- `alert_events` keeps `skipped_cap` as a legal-but-unwritten status. The history view groups
  every `skipped_*` value, so no exhaustive switch had to change.
- Rows storing a cooldown below 5 keep storing it; the floor is applied at dispatch, so the
  configured value is still what the UI and API report.

## Open Question: SSL Reminders Have No Incident Boundary

`notifySslResult` is deliberately not edge-triggered: it fires on every day
`shouldAlertOnSslStatus` says to, and it **never dispatches an `up` event**. Every mechanism
above is scoped by "since the last recovery", so for an SSL alert there is no incident boundary
at all — the whole history of that `(alert, monitor)` pair is one open-ended incident, and only
the very first reminder it ever sent skipped the cooldown.

The per-incident ceiling was the only thing bounding this. With it removed, a certificate nobody
renews now emails once a day **indefinitely**, where it previously stopped after 10 reminders.
The daily cadence comes from `CheckSslJob` running daily, not from any cooldown; a 60-minute
cooldown does not constrain a once-a-day dispatch.

This needs a product decision and is not addressed by this ADR. Candidate shapes, neither
chosen:

1. **A per-monitor "reminders exhausted" state** — record that the reminders for a certificate
   have been delivered and stop, resetting when the certificate's expiry moves (i.e. when it is
   renewed). Gives SSL the incident boundary it currently lacks, using the same
   since-the-boundary queries everything else uses.
2. **An SSL-specific cadence** — make the reminder schedule itself the bound, e.g. notify only
   on the `WARNING_THRESHOLDS_DAYS` crossings (30/14/7/1) and then on expiry, instead of every
   day within a threshold.

## References

- [ADR-004: Bound Alert Repetition With a Default Cooldown and a Per-Incident Cap](./ADR-004-bound-alert-repetition.md)
- [ADR-002: Infrastructure Cost per Monitor Type](./ADR-002-infrastructure-cost-per-monitor-type.md) §8, §17 — the cost analysis ADR-004 followed from
- `apps/uptime/app/services/alerts.ts` — `MIN_REPEAT_COOLDOWN_MINUTES`, `repeatCooldownMinutes`, `suppressionReason`, `notifySslResult`
- `apps/uptime/app/data/alert-event.ts` — `countSentSinceRecovery`, `isInCooldown`, `summarizeIncident`
- `apps/uptime/database/migrations/20260804120000_alert_cooldown_default.sql`

## Notes

- The dashboard alert form still prefills `15` for a new alert
  (`resources/views/alerts/form.tsx`), so an alert created through the UI without editing that
  field stores 15 rather than the schema/validator default of 60. Worth reconciling; it does not
  affect the policy, since 15 is above the floor.
- ADR-004's cost table is still the reference for per-email rates; only its bounded-cost
  conclusion is superseded.
