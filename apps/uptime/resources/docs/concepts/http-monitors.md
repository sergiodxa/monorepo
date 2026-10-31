---
title: HTTP Monitors
description: Check your websites, APIs, and web services for availability and performance. Track response times, status codes, SSL certificates, and content.
section:
  title: Concepts
  order: 4
order: 2
lastUpdated: 2026-10-31
next: ["/docs/guides/add-a-monitor", "/docs/troubleshooting/alerts-but-site-is-up"]
---

When an HTTP monitor runs, it:

1. Sends an HTTP request to your configured URL
2. Measures the response time
3. Checks the status code against your expected value
4. Optionally validates response content
5. Optionally checks SSL certificate status

Based on these checks, the monitor reports one of three statuses:

- **Up** - The endpoint responded successfully within expected parameters
- **Down** - The endpoint failed to respond, returned an unexpected status code, or failed content validation
- **Degraded** - The endpoint responded successfully but slower than your configured threshold

## Configuration Options

### URL and HTTP Method

Specify the full URL to monitor, including the protocol (`http://` or `https://`). Redirects are followed, so the check judges the page the URL finally lands on.

A monitor sends `HEAD` requests by default, which fetch the headers without the body. Adding a content check switches the request to `GET`, since the body is needed. The method can't be changed in the dashboard; set it through the [HTTP Monitors API](/docs/api/resources/http-monitors) with `method`, one of `GET`, `HEAD`, `POST`, `PUT`, `PATCH` or `DELETE`.

### Expected Status Code

Define which HTTP status code indicates a successful response. Common configurations:

- **200** - Standard successful response
- **201** - Resource created successfully (for POST requests)
- **204** - Successful with no content
- **401** - Protected endpoints where authentication is expected to fail

Redirects are followed, so the code compared is the one the final page returns. If it doesn't match your expected value, the monitor reports as Down.

### Check Interval

Set how frequently the monitor checks your endpoint. Intervals range from **1 to 60 minutes**:

| Interval      | Best For                                          |
| ------------- | ------------------------------------------------- |
| 1 minute      | Critical services requiring immediate detection   |
| 5 minutes     | Important services with reasonable detection time |
| 15 minutes    | Standard monitoring for most services             |
| 30-60 minutes | Low-priority services or rate-limited endpoints   |

### Timeout Settings

A check that gets no response within **10 seconds** reports as Down. The timeout can't be changed in the dashboard; set `timeoutSeconds` (1 to 60) through the [HTTP Monitors API](/docs/api/resources/http-monitors).

### Degraded Threshold

A response that takes **5 seconds** or longer reports as Degraded instead of Up, and alerts like a Down check. The threshold can't be changed in the dashboard; set `degradedAfterMs` (1,000 to 30,000) through the [HTTP Monitors API](/docs/api/resources/http-monitors).

For example, if your API typically responds in 200ms, a threshold of 1,000ms tells you when performance drops significantly.

### Region Selection

Each monitor runs from **one region**, chosen in <ui>Region</ui>:

- **Africa**
- **Asia-Pacific**
- **Eastern Europe**
- **Eastern North America**
- **Middle East**
- **Oceania**
- **South America**
- **Western Europe**
- **Western North America**

To watch a service from several places, create one monitor per region.

### Recognizing Uptime's Checks

Every HTTP check is signed with [Web Bot Auth](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/), so a firewall or bot-management rule can let checks through by verifying the signature instead of matching IP ranges. Each request carries `Signature-Agent: sig1="https://uptime.sergiodxa.com"`, and the public keys are published at `https://uptime.sergiodxa.com/.well-known/http-message-signatures-directory`.

## SSL Certificate Monitoring

SSL monitoring is off by default. Turn on <ui>Enable SSL Monitoring</ui> on the monitor's edit page, and Uptime tracks when the host's certificate expires and alerts before it does. The status is re-evaluated once a day.

### Where the Expiry Date Comes From

Uptime reads your certificate's expiry date from [Certificate Transparency](https://certificate.transparency.dev/) logs, the public record every publicly trusted certificate authority writes each certificate to. Once a day it searches the logs for the monitor's host and picks the certificate that:

- Names the host, either exactly or through a wildcard such as `*.example.com`
- Is valid today and has not been revoked
- Was issued most recently

Its expiry date and issuer fill the SSL card, so a renewed certificate moves the date forward on its own. When you turn SSL monitoring on, or save its settings without a date, the lookup runs right away.

The SSL card says where the date came from. When the logs hold no valid certificate for the host, the card says so and the status stays as it was. The same happens when the logs cannot be reached: Uptime keeps the last certificate it found and tries again the next day.

To override the logs, enter the expiry date (and optionally the issuer) yourself in the monitor's SSL settings. A typed date is used as it is until you clear it. Use it for certificates that never appear in the logs, such as ones from a private or internal certificate authority.

The logs record the certificates a CA issued, which is usually, but not always, the one your server presents: a certificate issued and never installed still counts as the newest. If your server keeps serving an older certificate, enter its date by hand.

### Expiry Warning Threshold

Set <ui>Alert Before Expiry</ui> to how many days before expiration you want to be notified, from **1 to 365 days**. The default is **30 days**.

Set this based on how long your certificate renewal process takes. A 30-day warning gives most teams enough time to renew without urgency, while a 14-day warning suits teams with automated renewal processes.

### SSL Status Tracking

The monitor tracks SSL certificate details including:

- Certificate validity status
- Expiration date
- Days until expiration
- Certificate issuer

You'll receive alerts when the certificate is about to expire and when it has expired.

## Content Checks

Beyond status codes, you can validate that the response body contains (or doesn't contain) specific content.

### Check Types

| Type                 | Description                                                  |
| -------------------- | ------------------------------------------------------------ |
| **Contains**         | Response must include the specified text                     |
| **Does Not Contain** | Response must not include the specified text                 |
| **Regex Pattern**    | Response must match the specified regular expression pattern |

### Case Sensitivity

Tick <ui>Case sensitive matching</ui> to match case exactly. Left unticked, Contains and Does Not Contain ignore case, and a regex pattern runs with the `i` flag. Add checks on the monitor's edit page, under **Content Monitoring**; the monitor is Down whenever any enabled check fails.

### Use Cases

Content checks help you:

- **Verify page content** - Ensure your homepage contains your company name or key content
- **Check for error messages** - Detect when error pages are served (e.g., "Internal Server Error")
- **Validate API responses** - Confirm responses contain expected data structures
- **Detect maintenance pages** - Alert when maintenance or "under construction" content appears
- **Monitor for security issues** - Detect if error pages expose sensitive information

Example content checks:

```
Contains: "Welcome to Our Service"
Not Contains: "Error"
Not Contains: "maintenance"
Regex: "\"status\":\s*\"ok\""
```

## Best Practices

### Use a Health-Check Route

Point the monitor at a lightweight route such as `/healthz` rather than a heavy page. It answers faster, keeps clear of the degraded threshold, and fails only when the service itself does.

### Set Appropriate Expected Status Codes

Match your expected status code to what the endpoint actually returns:

- API health endpoints typically return 200
- Protected endpoints without credentials return 401 or 403
- Endpoints that redirect are judged on the page they redirect to

Don't assume 200 is always correct - check what your endpoint actually returns.

### Configure Degraded Thresholds for Performance Monitoring

Adjust the degraded threshold through the API to catch performance regressions before they become outages. Base your threshold on:

- Historical response times (set threshold at 2-3x normal)
- User experience requirements
- SLA commitments

### Enable SSL Monitoring for HTTPS Endpoints

Always enable SSL certificate monitoring for production HTTPS endpoints. Expired certificates cause immediate outages and security warnings for users.

Set your expiry warning threshold based on:

- Certificate renewal process duration
- Team availability and response time
- Whether you use automated renewal (shorter threshold OK)
- Manual renewal processes (longer threshold recommended)

### Monitor from Where Your Users Are

Pick the region closest to your users. If your service is global, add a monitor for the same URL in each region that matters, so a regional outage shows up as one failing monitor among passing ones.

### Use Content Checks for Critical Pages

Add content checks to critical pages to detect:

- Blank pages that return 200 but have no content
- Error messages served with 200 status codes
- Cached or stale content
- CDN or proxy issues serving wrong content
