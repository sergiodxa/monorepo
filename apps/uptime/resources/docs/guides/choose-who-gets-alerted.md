---
title: Choose who gets alerted
description: Send outage notices to the right inbox, Slack or Discord channel, PagerDuty service or webhook, and control how often they repeat.
section:
  title: Guides
  order: 2
order: 2
lastUpdated: 2026-10-31
next: ["/docs/guides/publish-a-status-page", "/docs/concepts/alerts"]
keywords:
  [
    "notifications",
    "notify",
    "email alert",
    "slack",
    "discord",
    "pagerduty",
    "webhook",
    "on-call",
    "cooldown",
  ]
---

An alert connects monitors to one destination. Create one alert per destination: one for the team inbox, one for the on-call Slack channel, and so on. A team can have up to 10 alerts.

<mockup area="alerts" caption="The alerts list" />

<steps>
<step id="name-it-and-pick-its-monitors" title="Name it and pick its monitors">

1. Open <ui>Alerts</ui> in the sidebar and click <ui>Create Alert</ui>.
2. Type a <ui>Name</ui> that says where it goes, such as "On-call Slack".
3. Choose a <ui>Scope</ui>:
   - <ui>Team-wide (every monitor)</ui> covers every monitor, including ones you add later.
   - <ui>Every HTTP monitor</ui>, <ui>Every cron job</ui> and the other "Every…" options cover one kind of monitor.
   - A single monitor's name covers only that monitor.

</step>
<step id="pick-the-channel" title="Pick the channel">

Under **Notification channel**, choose a <ui>Channel</ui> and fill in its fields:

| Channel   | What to enter                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| Email     | <ui>Recipient</ui>, and optionally a <ui>Subject prefix (optional)</ui> to filter alerts in your inbox          |
| Slack     | The <ui>Webhook URL</ui> of a Slack Incoming Webhook                                                            |
| Discord   | The <ui>Webhook URL</ui> from the channel's Server Settings → Integrations → Webhooks                           |
| PagerDuty | The <ui>Integration key</ui> of the service's Events API v2 integration                                         |
| Webhook   | The <ui>URL</ui> to post to, and optionally a <ui>Signing secret (optional)</ui> so your endpoint can verify it |

For webhook payloads and signature verification, see [Alerts & Notifications](/docs/concepts/alerts).

</step>
<step id="set-the-delivery-rules" title="Set the delivery rules">

Under **Delivery rules**:

- <ui>Notify on recovery</ui> (on by default) sends one more notice when the monitor is healthy again.
- <ui>Cooldown (minutes)</ui> (60 by default) is how long to wait before repeating the notice while the monitor stays down. You can set 0 to 1440; repeats are never closer than 5 minutes apart.

Click <ui>Create Alert</ui>.

</step>
</steps>

## When an alert fires

- **On the first failing check.** There is no confirming second check, and the cooldown never delays this first notice.
- **Again every cooldown** while the monitor stays broken, with no limit on how many.
- **Once on recovery**, if <ui>Notify on recovery</ui> is on.

What counts as broken depends on the monitor: an HTTP monitor alerts when it is down or degraded, and a cron job alerts when it is missed (and when it is late, if you turned on <ui>Alert on Late</ui>). A flow monitor alerts when a test fails, never when it cannot run.

Nothing is sent while a maintenance window with alert suppression covers the monitor. See [Schedule maintenance](/docs/guides/schedule-maintenance).

<faq>
<question title="How do I see what was sent?">

Open <ui>Alerts</ui> and click <ui>View History</ui>. Each row shows the alert, the monitor, the event (<ui>Down</ui>, <ui>Degraded</ui> or <ui>Recovered</ui>) and whether it was <ui>Sent</ui>, <ui>Failed</ui> or <ui>Skipped (Cooldown)</ui>.

</question>
<question title="An alert shows a Broken badge. What happened?">

The destination answered that it no longer exists, for example a deleted Slack webhook. Open the alert with <ui>Edit Alert</ui>, enter a working destination and save; saving the channel clears the badge.

</question>
<question title="Who sends the emails?">

Alert emails come from `no-reply@uptime.sergiodxa.com`. Add it to your contacts or allow-list so they don't land in spam.

</question>
</faq>
