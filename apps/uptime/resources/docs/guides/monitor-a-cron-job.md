---
title: Monitor a cron job
description: Find out when a backup, sync or report job stops running, by having the job check in after every run.
section:
  title: Guides
  order: 2
order: 4
lastUpdated: 2026-10-31
next: ["/docs/guides/choose-who-gets-alerted", "/docs/concepts/cron-jobs"]
keywords:
  ["scheduled task", "heartbeat", "dead man's switch", "background job", "crontab", "check-in"]
---

A cron job monitor waits for your job to report in. Each time the job finishes, it sends one request to Uptime; when a report doesn't arrive on schedule, Uptime alerts you.

<mockup area="cron" caption="A cron job's page" />

<steps>
<step id="create-the-cron-job-monitor" title="Create the cron job monitor">

1. Open <ui>Cron Jobs</ui> in the sidebar and click <ui>Create Cron Job</ui>.
2. Under **Basics**, give it a <ui>Name</ui> and, optionally, a <ui>Description</ui>.
3. Under **Schedule**, enter the job's schedule in <ui>Cron Expression</ui>, such as `0 * * * *` for every hour on the hour, and pick the <ui>Timezone</ui> it runs in (UTC by default).
4. Set the <ui>Grace Period</ui> in seconds: how long after the scheduled time a run may still check in on time. It defaults to 300 (5 minutes) and goes from 60 seconds to 24 hours. Make it longer than the job usually takes, since the check-in comes at the end.
5. Under **Alerting**, turn on <ui>Alert on Late</ui> if you want to hear as soon as a run is late, not only when it is missed. Leave <ui>Enabled</ui> on.
6. Click <ui>Create Cron Job</ui>.

</step>
<step id="get-an-api-key" title="Get an API key">

Check-ins are authenticated. A team owner or admin opens <ui>API Keys</ui> in the sidebar, clicks <ui>Create API Key</ui>, names it, ticks only `cron-jobs:ping` under <ui>Permissions</ui>, and clicks <ui>Create API Key</ui>. Copy the key now: it is shown once.

Store it where the job can read it, such as an `UPTIME_API_KEY` environment variable.

</step>
<step id="make-the-job-check-in" title="Make the job check in">

Open the cron job's page. **Ping this monitor** shows the command with this monitor's address filled in. Add it as the job's last step:

```bash title="Terminal"
curl -X POST https://uptime.sergiodxa.com/api/v1/cron-jobs/<cron-job-id>/ping \
  -H "Authorization: Bearer $UPTIME_API_KEY"
```

In a crontab, chain it with `&&` so a failed run never checks in:

```bash title="crontab"
0 * * * * your-job.sh && curl -fsS -X POST https://uptime.sergiodxa.com/api/v1/cron-jobs/<cron-job-id>/ping -H "Authorization: Bearer $UPTIME_API_KEY"
```

</step>
<step id="confirm-the-first-check-in" title="Confirm the first check-in">

After the job's next run, the check-in appears under **Ping History** on the cron job's page, marked <ui>On Time</ui> or <ui>Late</ui>, and the status changes from <ui>New</ui> to <ui>Healthy</ui>.

</step>
</steps>

## Healthy, late and missed

| Status  | When                                                                                | Alerts                           |
| ------- | ----------------------------------------------------------------------------------- | -------------------------------- |
| Healthy | The last run checked in before its scheduled time plus the grace period             | Recovery notice, if one was sent |
| Late    | The grace period passed without a check-in                                          | Only with <ui>Alert on Late</ui> |
| Missed  | The _next_ scheduled run's grace period passed too, so a whole run never checked in | Always                           |

A monitor that has never received a check-in stays <ui>New</ui> until it is missed.

<faq>
<question title="What does the check-in endpoint answer?">

`201` when the check-in is recorded. `401` when the key is missing or invalid, `403` when it lacks the `cron-jobs:ping` permission, `404` for an unknown ID or another team's monitor, and `409` when the cron job is disabled. Check-ins closer than 30 seconds apart for one monitor are refused with `429`.

</question>
<question title="Does a check-in cost anything?">

Each check-in counts as one ping toward the 100,000 included in the monthly subscription.

</question>
</faq>
