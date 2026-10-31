---
title: I'm not receiving alerts
description: Track down why a monitor went down without a notification reaching you, and make sure the next one does.
section:
  title: Fix a problem
  order: 3
order: 2
lastUpdated: 2026-10-31
next: ["/docs/guides/choose-who-gets-alerted", "/docs/concepts/alerts"]
keywords:
  [
    "no notification",
    "missing alert",
    "email not arriving",
    "slack not working",
    "spam",
    "silent",
    "no email",
  ]
---

Open <ui>Alerts</ui> and click <ui>View History</ui>. Whether the monitor's event is listed, and with which **Status**, tells you which section below applies.

## If no alert covers the monitor

An alert only hears about the monitors in its <ui>Scope</ui>. An alert scoped to one monitor, or to <ui>Every HTTP monitor</ui>, stays silent when a cron job or a DNS monitor breaks.

Check the **Scope** column of the <ui>Alerts</ui> list. Widen an alert with <ui>Edit Alert</ui>, or create a <ui>Team-wide (every monitor)</ui> alert as a catch-all.

## If a maintenance window was running

While a maintenance window with <ui>Suppress alerts during this window</ui> covers a monitor, no alert is sent for it, and nothing appears in the history either.

Look under <ui>Maintenance</ui> for a window that was <ui>Active</ui> at the time, including recurring ones. Their times are in UTC.

## If the history says Skipped (Cooldown)

The first notice of an outage is always sent; repeats wait out the alert's <ui>Cooldown (minutes)</ui>, 60 by default. A recovery notice sent shortly after another one for the same monitor is also held back.

To hear more often, lower the cooldown with <ui>Edit Alert</ui>. Repeats are never closer than 5 minutes apart.

## If the history says Failed, or the alert shows Broken

<ui>Failed</ui> means the destination refused or couldn't take the delivery. A <ui>Broken</ui> badge on the alert means the destination said it no longer exists, as when a Slack or Discord webhook is deleted.

Open the alert with <ui>Edit Alert</ui>, enter a working webhook URL, integration key or address, and click <ui>Save changes</ui>. Saving clears the badge.

## If the history says Sent but the email never arrived

The email left Uptime. It comes from `no-reply@uptime.sergiodxa.com`, so check your spam folder and any filter that matches the alert's subject prefix, and add the address to your allow-list. Make sure the <ui>Recipient</ui> on the alert is spelled right.

## If the monitor's state doesn't alert

Some states never send a notice:

- A cron job that is <ui>Late</ui> alerts only when <ui>Alert on Late</ui> is on for that job. A <ui>Missed</ui> job always alerts.
- A flow monitor that shows <ui>Cannot run</ui> hasn't found anything wrong with your service, so it never alerts. See [My flow monitor fails or can't run](/docs/troubleshooting/flow-monitor-fails).
- A recovery is only announced with <ui>Notify on recovery</ui> on.

<faq>
<question title="Can I send a test alert?">

There's no test button. To try a channel, point a monitor at a URL that returns a different status from its <ui>Expected Status Code</ui> and click <ui>Run Monitor</ui>; the alert fires on that first failing check.

</question>
</faq>
