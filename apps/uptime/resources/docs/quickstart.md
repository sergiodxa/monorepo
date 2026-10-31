---
title: Start monitoring in five minutes
description: Watch your first URL, get an email when it breaks, and confirm both work before you walk away.
section:
  title: Getting Started
  order: 1
order: 1
lastUpdated: 2026-10-31
next:
  [
    "/docs/guides/add-a-monitor",
    "/docs/guides/choose-who-gets-alerted",
    "/docs/guides/publish-a-status-page",
  ]
keywords: ["getting started", "first monitor", "setup", "onboarding", "check", "ping"]
---

You need an Uptime account and a URL anyone on the internet can open: your homepage, an API endpoint or a health-check route.

<mockup area="monitor" caption="A monitor's page after its first checks" />

<steps>
<step id="create-the-monitor" title="Create the monitor">

1. Open <ui>HTTP Monitors</ui> in the sidebar and click <ui>Create Monitor</ui>.
2. Under **Basics**, fill in <ui>Monitor Name</ui> (for example, "Landing page") and <ui>URL to Monitor</ui> (the full address, starting with `https://`).
3. Under **Check settings**, leave <ui>Check Interval</ui> at 10 minutes or slide it anywhere from 1 to 60 minutes.
4. Leave <ui>Expected Status Code</ui> at `200 OK` unless your URL answers with something else when it is healthy.
5. Pick the <ui>Region</ui> closest to your visitors. Every check runs from that one region.
6. Click <ui>Create Monitor</ui>.

Uptime runs the first check right away and opens the monitor's page.

</step>
<step id="add-an-alert" title="Add an alert">

1. Open <ui>Alerts</ui> in the sidebar and click <ui>Create Alert</ui>.
2. Give it a <ui>Name</ui>, such as "Email me".
3. Leave <ui>Scope</ui> on <ui>Team-wide (every monitor)</ui>, so this alert also covers monitors you add later.
4. Under **Notification channel**, choose <ui>Email</ui> as the <ui>Channel</ui> and type your address in <ui>Recipient</ui>.
5. Leave <ui>Notify on recovery</ui> on, so you also hear when the site is back.
6. Click <ui>Create Alert</ui>.

</step>
<step id="check-it-works" title="Check it works">

1. Open your monitor from <ui>HTTP Monitors</ui> and click <ui>Run Monitor</ui>. Uptime checks the URL now and tells you whether it is up, degraded or down.
2. If it says down, compare the status code your URL returned with the one you expected, and fix the monitor with <ui>Edit Monitor</ui>.
3. When the monitor next goes down, the alert email arrives on that first failing check. Every alert Uptime sends, or holds back, is listed under <ui>Alerts</ui> → <ui>View History</ui>.

</step>
</steps>

A response that takes 5 seconds or longer counts as **degraded**, and a degraded check alerts just like a down one.
