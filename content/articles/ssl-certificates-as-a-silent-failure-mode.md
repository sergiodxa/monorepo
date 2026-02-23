---
title: SSL Certificates as a Silent Failure Mode
excerpt: Certificate expiry causes immediate outages with no graceful degradation.
---

SSL certificates fail in a peculiar way: one moment everything works, the next moment nothing does. There's no warning, no partial functionality, no graceful degradation. When a certificate expires, browsers and clients simply refuse to connect.

This binary failure mode makes certificate expiry one of the most dangerous types of outages. Your application code never runs. Your error handling never triggers. Your logging never captures anything. From your server's perspective, nothing is wrong because no requests ever arrive.

## The Anatomy of a Certificate Outage

When a user visits your site with an expired certificate, the TLS handshake fails before any HTTP request is made. The browser shows a security warning, and most users will not proceed past it. Even if they wanted to, many browsers make it increasingly difficult to bypass these warnings.

For API clients and automated systems, the failure is even more severe. Most HTTP clients will throw an error and refuse to connect entirely. There's no response body to parse, no status code to check, no retry logic that will help. The connection simply cannot be established.

This is fundamentally different from application errors. A 500 error still means your infrastructure is working: DNS resolved, TCP connected, TLS negotiated, and your application processed the request (even if it failed). A certificate error means none of that happened. Like [DNS failures](/articles/why-dns-failures-are-hard-to-diagnose), the problem occurs before your application code ever runs.

## Why Automated Renewal Is Not Enough

Services like Let's Encrypt have made automated certificate renewal the default for many deployments. This is excellent, but it creates a false sense of security.

Automated renewal can fail silently. The renewal process might encounter rate limits, DNS validation failures, or permission issues. Your certificate continues working until it expires, at which point you discover the renewal has been failing for weeks.

Common failure scenarios include:

- DNS changes that break domain validation
- File permission changes on the web server
- Rate limiting from too many renewal attempts
- Network issues during the ACME challenge
- Misconfigured cron jobs or systemd timers

The renewal process succeeding once does not guarantee it will succeed again. Each renewal is a fresh operation that can fail for new reasons.

## Setting Expiry Thresholds

Certificate monitoring should alert you with enough time to fix issues before expiry. The right threshold depends on your renewal process and response capabilities.

For automated renewal with Let's Encrypt (90 day certificates, typically renewed at 60 days), consider alerting at:

- **30 days before expiry**: Warning that renewal may have failed
- **14 days before expiry**: Urgent alert requiring investigation
- **7 days before expiry**: Critical alert requiring immediate action

For manually managed certificates (often 1 year validity), adjust accordingly:

- **60 days before expiry**: Begin renewal process
- **30 days before expiry**: Escalate if not renewed
- **14 days before expiry**: Emergency procedures

The key insight is that your alert threshold should exceed your worst case response time. If it takes your team 48 hours to respond to a non-critical alert during a holiday weekend, your warning threshold needs to account for that. [Well-designed alerts](/articles/designing-alerts-that-do-not-cause-fatigue) give you time to act before problems become outages.

## Defense in Depth

The most reliable approach combines automated renewal with active monitoring. Neither alone is sufficient. This [layered monitoring approach](/articles/why-multi-protocol-monitoring-matters) ensures you catch problems that any single check might miss.

Automated renewal handles the happy path: certificates get renewed on schedule without human intervention. Monitoring handles the unhappy path: when automation fails, humans are alerted with enough time to intervene.

Your monitoring should check:

- **Certificate expiry date**: The most obvious check, but also the most important
- **Certificate chain validity**: Intermediate certificates can also expire
- **Certificate matches expected domain**: Catches misconfigurations
- **Renewal process health**: Monitor your ACME client logs for failures

Some teams also monitor certificate transparency logs to detect unauthorized certificate issuance for their domains. This catches a different class of problem: not expiry, but potential compromise.

## The Cost of Getting This Wrong

Certificate outages are memorable because they're so complete. Every user is affected. Every API integration breaks. Every automated process fails. And the fix, while usually simple, requires manual intervention that may not be immediately available.

The reputational cost is also significant. Users see a security warning with your domain name on it. They don't see "certificate expired," they see "this site may be trying to steal your information." That's a trust violation that takes time to recover from.

Certificate monitoring is cheap insurance against an expensive failure mode. The monitoring itself is simple: check the expiry date, alert if it's too soon. The value comes from catching problems while they're still theoretical, not after they've become outages.
