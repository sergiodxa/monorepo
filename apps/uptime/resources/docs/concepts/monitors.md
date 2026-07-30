---
title: Understanding Monitors
description: Monitors continuously check the health of your services and alert you when something goes wrong. Learn about HTTP, DNS, TCP, and cron job monitors.
section:
  title: Concepts
  order: 2
order: 1
lastUpdated: 2026-02-14
---

In modern infrastructure, services fail. Networks have hiccups. DNS records expire. Scheduled jobs silently stop running. Without monitoring, you might not discover these issues until your users do.

Monitors provide:

- **Early detection** — Know about problems before they impact users
- **Historical visibility** — Track uptime and performance trends over time
- **Peace of mind** — Confidence that your critical services are being watched 24/7

## Types of Monitors

Uptime offers four types of monitors, each designed for different use cases.

### HTTP Monitors

HTTP monitors check web endpoints by making HTTP requests and validating the response. They're ideal for:

- Websites and web applications
- REST APIs and GraphQL endpoints
- Health check endpoints
- Webhooks and callback URLs

HTTP monitors can verify status codes, response times, and even specific content in the response body. See [HTTP Monitors](/docs/concepts/http-monitors) for details.

### DNS Monitors

DNS monitors verify that your domain names resolve correctly. They're essential for:

- Ensuring domains point to the right IP addresses
- Detecting DNS propagation issues
- Monitoring DNS record changes
- Validating DNS failover configurations

DNS issues can be subtle and hard to diagnose—DNS monitors catch them early. See [DNS Monitors](/docs/concepts/dns-monitors) for details.

### TCP Monitors

TCP monitors establish connections to specific ports to verify that services are accepting connections. Use them for:

- Database servers (MySQL, PostgreSQL, Redis)
- Mail servers (SMTP, IMAP)
- Custom TCP services
- Services behind firewalls that don't expose HTTP

TCP monitors confirm that a service is listening and reachable at the network level. See [TCP Monitors](/docs/concepts/tcp-monitors) for details.

### Cron Job Monitors

Cron job monitors work differently—instead of Uptime checking your service, your scheduled jobs check in with Uptime. They're designed for:

- Scheduled tasks and batch jobs
- Backup scripts
- Data synchronization jobs
- Any recurring process that should run on a schedule

If a job fails to check in within its expected window, you'll know something went wrong. See [Cron Job Monitors](/docs/concepts/cron-jobs) for details.

## Common Concepts

All monitors share several core concepts regardless of type.

### Check Intervals

The interval determines how frequently Uptime checks your service. Common intervals include:

- **1 minute** — For critical, high-traffic services
- **5 minutes** — A good balance for most services
- **15 minutes** — For less critical services or to reduce costs
- **30+ minutes** — For background services or infrequently changing resources

Shorter intervals mean faster detection but more resource usage. Choose based on how quickly you need to know about issues.

### Status

Every monitor has a status that reflects the current health of the service:

- **Up** — The service is responding correctly and meeting all configured thresholds
- **Down** — The service is not responding or returning errors
- **Degraded** — The service is responding but not meeting performance thresholds (e.g., slow response times)

Status changes trigger alerts so you can respond appropriately.

### Enabling and Disabling

Monitors can be enabled or disabled at any time. Disabled monitors:

- Stop running checks
- Don't trigger alerts
- Preserve historical data
- Can be re-enabled instantly

This is useful during planned maintenance, when decommissioning services, or when troubleshooting alert fatigue.

## Monitors and Alerts

Monitors and alerts work together but serve different purposes:

- **Monitors detect** — They check your services and determine status
- **Alerts notify** — They tell you when status changes

A single monitor can trigger multiple alerts through different channels (email, Slack, webhooks). You can also configure alert conditions, like only alerting after a service has been down for 5 minutes to avoid noise from brief hiccups.

See [Understanding Alerts](/docs/concepts/alerts) for more on configuring notifications.

## Best Practices

### Start with Critical Services

Don't try to monitor everything at once. Begin with:

1. Your main website or application
2. APIs that customers depend on
3. Services that other systems rely on
4. Payment and authentication systems

Expand coverage over time as you get comfortable with the alerting workflow.

### Choose Appropriate Intervals

Not everything needs 1-minute checks:

- Customer-facing services → 1-5 minutes
- Internal tools → 5-15 minutes
- Documentation sites → 15-30 minutes
- Background services → Match the expected run frequency

### Use Meaningful Thresholds

Configure thresholds that reflect real problems:

- Set response time limits based on actual performance requirements
- Allow for occasional slow responses before marking degraded
- Consider requiring multiple consecutive failures before alerting

### Monitor from the User's Perspective

Where possible, monitor what users actually experience:

- Check production endpoints, not just health checks
- Verify responses contain expected content
- Monitor from regions where your users are located

### Keep Monitors Up to Date

Review your monitors periodically:

- Remove monitors for decommissioned services
- Update URLs and expected values after deployments
- Adjust thresholds as performance characteristics change

## Next Steps

- [HTTP Monitors](/docs/concepts/http-monitors) — Deep dive into monitoring web endpoints
- [DNS Monitors](/docs/concepts/dns-monitors) — Learn about DNS verification
- [TCP Monitors](/docs/concepts/tcp-monitors) — Monitor services at the network level
- [Cron Job Monitors](/docs/concepts/cron-jobs) — Track scheduled jobs
- [Understanding Alerts](/docs/concepts/alerts) — Configure how you get notified
