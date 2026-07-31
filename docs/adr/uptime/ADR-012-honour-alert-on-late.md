# ADR-012: Honour `alert_on_late` for Cron-Job Monitors

## Status

**Proposed** — 2026-07-30. Follows from [ADR-002](./ADR-002-infrastructure-cost-per-monitor-type.md)
§17 (medium). A promise the UI makes and the code does not keep.

## Context

`cron_job_monitors` carries an `alert_on_late` flag:

```ts
alert_on_late: c.boolean().default(false),
```

It is fully plumbed through everything except the decision it names:

- validated in `app/http/validators/cron-job.ts`, defaulting to `false`;
- persisted by `createCronJob` / `updateCronJob`;
- exposed on the REST API as `alertOnLate` in both `api/cron-job.ts` and `api/cron-jobs.ts`;
- rendered as a `Switch` in `resources/views/cron-jobs/form.tsx:101`;
- asserted in seven test files.

`notifyCronJobResult` never reads it:

```ts
let isRecovery = newStatus === "healthy" && previousStatus !== null
  && previousStatus !== "healthy" && previousStatus !== "new";
if (newStatus === "healthy" && !isRecovery) return;
if (newStatus === "new") return;

await dispatchAlerts({ ...  eventType: isRecovery ? "up" : newStatus === "missed" ? "down" : "degraded" });
```

`late` falls through to `degraded` and dispatches unconditionally. So a user who leaves the
switch off — which is the **default** — still receives every late alert. Two consequences:

**Product.** The control does nothing. A user who explicitly turned off late alerts gets them
anyway, which is worse than not offering the toggle.

**Cost.** `CheckCronJobsJob` transitions `healthy → late` and then `… → missed`, so a silent
job produces **two** notifications where the default configuration asks for one. At the Resend
rate that is $0.0009 of unwanted email per incident per alert, plus 6 rows written to
`alert_events` and the `alerts` full scan that precedes it. Bounded per incident — unlike the
HTTP path in [ADR-004](./ADR-004-bound-alert-repetition.md) — but it is 100% waste, since the
user declined it.

Worth noting the default direction: `alert_on_late` defaults to `false`, so the current
behaviour is louder than the schema's intent for _every_ existing monitor, not just ones
where a user changed the setting.

## Decision

Read the flag in `notifyCronJobResult` and suppress the `late` dispatch when it is off:

```ts
export async function notifyCronJobResult(
  db: Database,
  resend: Resend,
  monitor: SelectCronJobMonitor,
  previousStatus: CronJobStatus | null,
  newStatus: CronJobStatus,
): Promise<void> {
  let isRecovery = /* unchanged */;
  if (newStatus === "healthy" && !isRecovery) return;
  if (newStatus === "new") return;
  // `late` is an opt-in notification; `missed` and recovery are not.
  if (newStatus === "late" && !monitor.alert_on_late) return;

  await dispatchAlerts({ ... });
}
```

Three properties this preserves deliberately:

- **`missed` always alerts.** It is the actual failure signal; `late` is an early warning.
  Gating `missed` on a flag named `alert_on_late` would be surprising.
- **Recovery always alerts** when `notify_on_recovery` is set, including recovery _from_ a
  `late` state. A user who did not want the warning still wants to know the job came back if
  they were told it was missed.
- **The state transition still happens.** `CheckCronJobsJob` calls `updateStatus` before
  notifying, so `late` is still recorded, still visible on the dashboard, and still the basis
  for the later `missed` transition. This suppresses the _notification_, not the state.

That last point is the one to get right: gating the transition instead of the notification
would break the `missed` timeline, because `missed` is reached from `healthy` **or** `late` and
`listActionable` only returns monitors in those two states.

## Consequences

- **The toggle starts working.** Users who left it at the default stop receiving late alerts
  — a behaviour change for every existing cron monitor, and one that reduces notifications.
  Needs a changelog line: "cron monitors no longer send 'late' alerts unless _Alert on late_ is
  enabled", because someone currently relying on those alerts will notice them stop.
- **Halves notification volume for a cron-monitor incident** in the default configuration:
  one `missed` email instead of `late` + `missed`. ~$0.0009 and 6 `alert_events` rows saved
  per incident per alert.
- **No schema or migration change.** The column, the validator, the API field, and the form
  control all already exist; this is a two-line change in one function.
- **`alert_events` history becomes sparser** for late transitions. The dashboard's alert
  history will no longer show `degraded` events for late cron jobs on monitors with the flag
  off. If that history is considered valuable independently of delivery, record a
  `skipped_disabled` event instead of returning early — consistent with how
  `skipped_cooldown` is already recorded in `deliverOne`. **Recommended**, since it keeps the
  history explaining itself rather than going silent, at the cost of 6 rows written.
- Existing tests assert `alert_on_late: false` in fixtures while expecting late alerts to
  dispatch; those expectations invert. `app/services/alerts.test.ts:1138` and
  `app/jobs/check-cron-jobs.test.ts:82` are the two that matter.
