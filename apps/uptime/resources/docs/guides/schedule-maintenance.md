---
title: Schedule maintenance
description: Keep planned downtime from paging your team, and tell your status page visitors about it in advance.
section:
  title: Guides
  order: 2
order: 6
lastUpdated: 2026-10-31
next: ["/docs/guides/publish-a-status-page", "/docs/concepts/maintenance"]
keywords:
  ["planned downtime", "maintenance window", "mute alerts", "silence alerts", "deploy", "pause"]
---

A maintenance window tells Uptime that downtime during a set period is planned. While it runs, the monitors it covers keep being checked, but their alerts can stay quiet.

<mockup area="maintenance" caption="Scheduled maintenance windows" />

<steps>
<step id="open-the-form" title="Open the form">

Open <ui>Maintenance</ui> in the sidebar and click <ui>Schedule Maintenance</ui>.

</step>
<step id="say-what-it-covers" title="Say what it covers">

Under **Coverage**, give the window a <ui>Name</ui>, such as "Database upgrade", and choose its <ui>Scope</ui>: <ui>Team-wide (every monitor)</ui>, every monitor of one kind, or a single monitor.

</step>
<step id="set-the-time" title="Set the time">

Under **Schedule**, fill in <ui>Starts at</ui> and <ui>Ends at</ui>. Both are read in **UTC**, whatever your computer's time zone, so convert your local time first.

</step>
<step id="choose-what-happens-during-it" title="Choose what happens during it">

Under **Behavior**, both of these start on:

- <ui>Suppress alerts during this window</ui> holds back every alert for the covered monitors while the window runs.
- <ui>Show on status page</ui> announces the window on every status page that shows a covered service.

For work that repeats, turn on <ui>Recurring</ui> and write the pattern in <ui>Recurrence pattern (when recurring)</ui>, in UTC: `daily:02:00-04:00`, `weekly:monday:02:00-04:00` or `monthly:1:02:00-04:00`.

Click <ui>Schedule Maintenance</ui>.

</step>
</steps>

The window is listed under the <ui>Upcoming</ui> tab until it starts, then under <ui>Active</ui>, then under <ui>Past</ui>.

## Finish early

If the work is done before the window ends, open the window with <ui>Edit</ui> and click <ui>End maintenance now</ui>. Alerts resume and the notice leaves your status page; the window itself stays in the list, marked <ui>Ended early</ui>.

<faq>
<question title="Do suppressed alerts show up later?">

No. An alert held back by a maintenance window is never sent and isn't listed in the alert history. If the monitor is still down after the window ends, the next failing check alerts as usual.

</question>
<question title="Do checks still run, and still count toward uptime?">

Checks keep running and keep being billed during a window. Reports list the minutes of maintenance that covered each monitor beside its uptime.

</question>
</faq>
