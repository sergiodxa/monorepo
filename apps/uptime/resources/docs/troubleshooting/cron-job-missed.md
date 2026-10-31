---
title: My cron job shows as missed
description: Work out why Uptime marks a job as late or missed when you believe it ran, and get its check-ins counted.
section:
  title: Fix a problem
  order: 3
order: 3
lastUpdated: 2026-10-31
next: ["/docs/guides/monitor-a-cron-job", "/docs/concepts/cron-jobs"]
keywords:
  [
    "cron missed",
    "cron late",
    "heartbeat missing",
    "ping not received",
    "scheduled task",
    "401",
    "403",
  ]
---

Open the cron job's page and look at **Ping History**. If the run you expected isn't listed, its check-in never reached Uptime; start with the first three sections. If it is listed as <ui>Late</ui>, it arrived after its deadline; skip to the timing sections.

## If the check-in is rejected

Run the job's `curl` command by hand and read the status code:

| Code  | Cause                                                          | Fix                                                                          |
| ----- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `401` | No API key, or the key is wrong, deleted or expired            | Check the `Authorization: Bearer` header and the variable that holds the key |
| `403` | The key exists but lacks the `cron-jobs:ping` permission       | Ask an owner or admin to create a key with it under <ui>API Keys</ui>        |
| `404` | The ID in the URL is wrong, or the key belongs to another team | Copy the command again from **Ping this monitor** on the cron job's page     |
| `409` | The cron job is disabled                                       | Turn <ui>Enabled</ui> back on with <ui>Edit</ui>                             |

`curl` without `-f` exits successfully even when Uptime refuses the request, so a rejected check-in can go unnoticed in your job's logs. The crontab line Uptime suggests uses `curl -fsS`.

## If the job fails before it checks in

The check-in is meant to be the job's last step, so a job that crashes or exits early never sends it. That is the monitor working as intended. Check the job's own logs for the failed run.

## If the job never ran

Your scheduler may not have run the job at all: a stopped server, an expired container, a crontab that was overwritten. Confirm the scheduler's last run time on the machine itself.

## If the schedule or time zone doesn't match

Uptime expects a run at the times <ui>Cron Expression</ui> produces in the job's <ui>Timezone</ui>, which is UTC unless you changed it. A job scheduled for `0 2 * * *` on a server set to New York time runs five or four hours later than a monitor left on UTC expects.

Open the cron job with <ui>Edit</ui> and make <ui>Cron Expression</ui> and <ui>Timezone</ui> match the scheduler exactly.

## If the job takes longer than the grace period

The deadline for each run is its scheduled time plus the <ui>Grace Period</ui>, 300 seconds by default. The check-in comes at the end of the job, so a 20-minute job is late every time on a 5-minute grace period. A run is marked missed once the _next_ run's deadline has also passed.

Set <ui>Grace Period</ui> to longer than your slowest run with <ui>Edit</ui>. It goes up to 86,400 seconds (24 hours).

<faq>
<question title="Why is a brand-new job missed before it ever went late?">

A job stays <ui>New</ui> until its first check-in. A new job can't be late, so if the first runs never check in, it goes straight to <ui>Missed</ui>.

</question>
<question title="My job runs twice within a few seconds. Is the second check-in counted?">

No. Check-ins for one cron job closer than 30 seconds apart are refused with `429`.

</question>
</faq>
