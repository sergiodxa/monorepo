---
title: I get alerts but my site is up
description: Find out why a monitor reports a problem when the site opens fine in your browser, and stop the false alarms.
section:
  title: Fix a problem
  order: 3
order: 1
lastUpdated: 2026-10-31
next: ["/docs/guides/add-a-monitor", "/docs/concepts/http-monitors"]
keywords:
  ["false positive", "false alarm", "flapping", "site is up", "wrong alert", "degraded", "timeout"]
---

Start with the alert itself: open <ui>Alerts</ui>, click <ui>View History</ui>, and check the **Event** column. A <ui>Degraded</ui> event means the site answered, but slowly. A <ui>Down</ui> event means the check got no answer, the wrong status code, or the wrong content.

## If the alert says Degraded

A response that takes 5 seconds or longer counts as degraded, and a degraded check alerts just like a down one. Your browser may load the page quickly from its cache while a fresh request from the monitor's region takes longer.

To fix it, point the monitor at a lighter URL, such as a health-check route, with <ui>Edit Monitor</ui>. To accept slower responses, raise the monitor's `degradedAfterMs` (up to 30,000) through the [HTTP Monitors API](/docs/api/resources/http-monitors#update-monitor).

## If your server doesn't answer HEAD requests

Monitors send `HEAD` requests, which ask for the headers without the page. Some servers and frameworks answer `HEAD` with `404` or `405` even though the page opens fine.

A Slack, Discord or webhook alert names the status it received, as in `Response status: 405 (expected 200)`, and the alert email lists it too. To switch to `GET`, add a content check under **Content Monitoring** on <ui>Edit Monitor</ui> (a check needs the body, so it always sends `GET`), or set `"method": "GET"` through the API.

## If the expected status code is wrong

The monitor is down whenever the final status code differs from <ui>Expected Status Code</ui>. Redirects are followed first, so a URL that redirects to a login page is compared on the login page's code.

Open <ui>Edit Monitor</ui> and set <ui>Expected Status Code</ui> to what the URL returns when it is healthy, or use the URL it finally lands on.

## If the region can't reach your site

Each monitor checks from the one <ui>Region</ui> you picked, and a single failed check alerts. No answer within 10 seconds counts as down. A site that blocks or rate-limits traffic from some countries, or a network problem between that region and your host, produces alerts your own browser never sees.

Pick the region closest to your visitors in <ui>Edit Monitor</ui>. If your firewall or bot protection blocks automated traffic, allow Uptime's checks by their Web Bot Auth signature; see [Recognizing Uptime's Checks](/docs/concepts/http-monitors#recognizing-uptimes-checks).

## If a content check no longer matches

A failed content check makes the monitor down even with a `200` status. Text changed by a redesign, a translation or a cookie banner is the usual cause, and <ui>Contains</ui> checks are case sensitive when <ui>Case sensitive matching</ui> is ticked.

Open <ui>Edit Monitor</ui> and update or <ui>Delete</ui> the check under **Content Monitoring**.

## If the alert came from the SSL certificate

With <ui>Enable SSL Monitoring</ui> on, the monitor alerts as the certificate's expiry approaches, even while the site is up. The date comes from Certificate Transparency logs, which list the newest certificate issued for the host; if your server still serves an older one, the dates differ.

Check the **SSL Certificate** card on the monitor's page. To use your certificate's real date, enter it in <ui>Certificate Expiry Date</ui> on <ui>Edit Monitor</ui>.

<faq>
<question title="Does Uptime re-check before alerting?">

No. The first failing check sends the alert, so you hear about an outage as early as possible. Repeats while the monitor stays broken follow the alert's cooldown.

</question>
</faq>
