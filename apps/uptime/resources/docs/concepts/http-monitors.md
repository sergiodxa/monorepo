---
title: HTTP Monitors
description: Check your websites, APIs, and web services for availability and performance. Track response times, status codes, SSL certificates, and content.
section:
  title: Concepts
  order: 2
order: 2
lastUpdated: 2026-02-14
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

Specify the full URL to monitor, including the protocol (`http://` or `https://`).

Choose the HTTP method that best fits your use case:

| Method | Use Case                                                        |
| ------ | --------------------------------------------------------------- |
| GET    | Retrieve content and validate responses                         |
| HEAD   | Quick availability checks without downloading the response body |
| POST   | Test API endpoints that require POST requests                   |
| PUT    | Test API update endpoints                                       |
| DELETE | Test API deletion endpoints                                     |
| PATCH  | Test partial update endpoints                                   |

### Expected Status Code

Define which HTTP status code indicates a successful response. Common configurations:

- **200** - Standard successful response
- **201** - Resource created successfully (for POST requests)
- **204** - Successful with no content
- **301/302** - Redirect responses (if you expect redirects)
- **401** - Protected endpoints where authentication is expected to fail

If the response status code doesn't match your expected value, the monitor reports as Down.

### Check Interval

Set how frequently the monitor checks your endpoint. Intervals range from **1 to 60 minutes**:

| Interval      | Best For                                          |
| ------------- | ------------------------------------------------- |
| 1 minute      | Critical services requiring immediate detection   |
| 5 minutes     | Important services with reasonable detection time |
| 15 minutes    | Standard monitoring for most services             |
| 30-60 minutes | Low-priority services or rate-limited endpoints   |

### Timeout Settings

Configure how long the monitor waits for a response before considering the check failed. A shorter timeout helps detect slow or unresponsive services faster.

The timeout should be longer than your typical response time but short enough to catch genuine issues. For most web services, 10-30 seconds works well.

### Degraded Threshold

Set a response time threshold (in milliseconds) above which the monitor reports as Degraded instead of Up. This helps you identify performance issues before they become outages.

For example, if your API typically responds in 200ms, setting a degraded threshold of 1000ms alerts you when performance drops significantly.

### Region Selection

Monitors run from multiple geographic regions to give you a global view of your service availability. Select one or more regions:

- **Africa**
- **APAC** (Asia-Pacific)
- **Eastern Europe**
- **Eastern North America**
- **Middle East**
- **Oceania**
- **South America**
- **Western Europe**
- **Western North America**

Running checks from multiple regions helps identify regional outages and latency issues that affect specific geographic areas.

## SSL Certificate Monitoring

For HTTPS endpoints, Uptime automatically monitors your SSL certificate status.

### Automatic SSL Checks

Every HTTP check to an HTTPS URL also verifies:

- The certificate is valid and trusted
- The certificate hasn't expired
- The certificate matches the requested domain

### Expiry Warning Threshold

Configure how many days before certificate expiration you want to be notified. The threshold ranges from **1 to 90 days**.

Set this based on how long your certificate renewal process takes. A 30-day warning gives most teams enough time to renew without urgency, while a 14-day warning suits teams with automated renewal processes.

### SSL Status Tracking

The monitor tracks SSL certificate details including:

- Certificate validity status
- Expiration date
- Days until expiration
- Certificate issuer

You'll receive alerts when the certificate is about to expire or if any SSL validation fails.

## Content Checks

Beyond status codes, you can validate that the response body contains (or doesn't contain) specific content.

### Check Types

| Type             | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| **Contains**     | Response must include the specified text                     |
| **Not Contains** | Response must not include the specified text                 |
| **Regex**        | Response must match the specified regular expression pattern |

### Case Sensitivity

Enable or disable case-sensitive matching for Contains and Not Contains checks. Regex checks use their own case sensitivity flags.

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

### Use HEAD for Simple Availability Checks

When you only need to verify a URL is reachable, use the HEAD method. It's faster and uses less bandwidth since the server doesn't send the response body.

### Set Appropriate Expected Status Codes

Match your expected status code to what the endpoint actually returns:

- API health endpoints typically return 200
- Protected endpoints without credentials return 401 or 403
- Endpoints that redirect return 301 or 302

Don't assume 200 is always correct - check what your endpoint actually returns.

### Configure Degraded Thresholds for Performance Monitoring

Enable degraded threshold monitoring to catch performance regressions before they become outages. Base your threshold on:

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

### Monitor from Multiple Regions

Select regions where your users are located. If your service is global, monitor from at least 3-4 geographically distributed regions to detect regional issues.

### Use Content Checks for Critical Pages

Add content checks to critical pages to detect:

- Blank pages that return 200 but have no content
- Error messages served with 200 status codes
- Cached or stale content
- CDN or proxy issues serving wrong content
