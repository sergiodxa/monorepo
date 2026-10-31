---
title: Add a monitor
description: Watch a website or API endpoint and learn within minutes when it goes down, slows down or serves the wrong page.
section:
  title: Guides
  order: 2
order: 1
lastUpdated: 2026-10-31
next: ["/docs/guides/choose-who-gets-alerted", "/docs/concepts/http-monitors"]
keywords:
  [
    "http monitor",
    "website monitor",
    "check",
    "ping",
    "uptime check",
    "health check",
    "ssl",
    "keyword",
  ]
---

An HTTP monitor requests one URL on a schedule and records whether it answered as expected. For DNS records, open ports, scheduled jobs and multi-step sign-ins, see [Understanding Monitors](/docs/concepts/monitors).

<mockup area="monitor" caption="A monitor's page" />

<steps>
<step id="open-the-form" title="Open the form">

Open <ui>HTTP Monitors</ui> in the sidebar and click <ui>Create Monitor</ui>.

</step>
<step id="say-what-to-watch" title="Say what to watch">

Under **Basics**, fill in <ui>Monitor Name</ui> and <ui>URL to Monitor</ui>. Use the full address, including `https://`. A health-check route such as `/healthz` makes a better target than a page that changes often.

</step>
<step id="choose-how-to-check" title="Choose how to check">

Under **Check settings**:

- <ui>Check Interval</ui>: from 1 to 60 minutes, 10 by default.
- <ui>Expected Status Code</ui>: the code a healthy response returns, `200 OK` by default. Redirects are followed, so this is the code of the page the URL finally lands on.
- <ui>Region</ui>: where the checks run from. Each monitor runs from one region; to watch from several, add a monitor per region.

</step>
<step id="create-it" title="Create it">

Click <ui>Create Monitor</ui>. The first check runs immediately, and the monitor's page opens with the result.

</step>
</steps>

## What up, degraded and down mean

| Status   | When                                                                                       |
| -------- | ------------------------------------------------------------------------------------------ |
| Up       | The status code matches, every content check passes, and the response took under 5 seconds |
| Degraded | Everything matches, but the response took 5 seconds or longer                              |
| Down     | No response within 10 seconds, a different status code, or a content check that failed     |

Both degraded and down send alerts. See [Choose who gets alerted](/docs/guides/choose-who-gets-alerted).

## Optional: check what the page says

A page can return `200 OK` and still be broken: an empty template, an error message, a maintenance notice. Content checks read the response body on every check.

1. Open the monitor and click <ui>Edit Monitor</ui>.
2. In **Content Monitoring**, choose a <ui>Check Type</ui>: <ui>Contains</ui>, <ui>Does Not Contain</ui> or <ui>Regex Pattern</ui>.
3. Type the text or pattern in <ui>Value</ui>, tick <ui>Case sensitive matching</ui> if case matters, and click <ui>Add Check</ui>.

The monitor is down whenever any of its checks fails.

## Optional: watch the SSL certificate

1. Open the monitor and click <ui>Edit Monitor</ui>.
2. In **SSL certificate monitoring**, turn on <ui>Enable SSL Monitoring</ui>.
3. Set <ui>Alert Before Expiry</ui> to how many days of warning you want (30 by default).
4. Click <ui>Save SSL settings</ui>.

Leave <ui>Certificate Expiry Date</ui> empty and Uptime reads the date from public Certificate Transparency logs every day. Type a date only for a certificate that never appears there, such as one from a private CA.

<faq>
<question title="Can I change the request method, timeout or the 5-second threshold?">

Not from the form. New monitors send `HEAD` requests with a 10-second timeout and a 5-second degraded threshold. Adding a content check switches the request to `GET`, since the body is needed. To set `method`, `timeoutSeconds` (1 to 60) or `degradedAfterMs` (1,000 to 30,000), update the monitor through the [HTTP Monitors API](/docs/api/resources/http-monitors).

</question>
<question title="Can I send headers, such as an Authorization token?">

Not with an HTTP monitor. To check an endpoint that needs a token, write a [flow monitor](/docs/guides/check-a-sign-in-flow) that signs in first.

</question>
<question title="How much does a monitor cost?">

Every check is one ping. The $5 monthly subscription includes 100,000 pings; past that, each block of 10,000 pings costs $1. A monitor checking every minute uses 43,200 pings in a 30-day month, and one checking every 10 minutes uses 4,320.

</question>
<question title="My firewall blocks bots. Will it block the checks?">

It may. Every check is signed with Web Bot Auth, so your firewall can allow it by verifying the signature instead of matching IP addresses. See [Recognizing Uptime's Checks](/docs/concepts/http-monitors#recognizing-uptimes-checks).

</question>
</faq>
