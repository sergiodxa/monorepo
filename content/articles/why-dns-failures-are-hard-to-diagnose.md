---
title: Why DNS Failures Are Hard to Diagnose
excerpt: DNS issues are invisible because the failure happens before your application runs.
---

DNS failures have a unique property that makes them frustrating to debug: they're invisible to your application. By the time your code runs, DNS resolution has already succeeded. When DNS fails, your code never runs at all.

This creates a diagnostic blind spot. Your application logs show nothing. Your error tracking captures nothing. Your metrics dashboards show reduced traffic, but no errors. From your application's perspective, users simply stopped making requests.

## The Failure Happens Before Your Code

Consider what happens when a user visits your website. Their browser needs to resolve your domain name to an IP address before it can establish a TCP connection. If DNS resolution fails, the browser shows a "can't reach this site" error. No HTTP request is ever made.

Your server never sees this failure. There's no request to log, no error to capture, no metric to increment. The failure happened entirely on the client side, in the DNS resolution step that precedes any communication with your infrastructure.

This is fundamentally different from application errors. A 500 error means your server received a request and failed to handle it. A timeout means your server received a request but took too long. A DNS failure means your server was never contacted at all. [SSL certificate failures](/articles/ssl-certificates-as-a-silent-failure-mode) share this characteristic: the problem happens before your code runs.

## The "Can't Connect" Masquerade

DNS failures typically present as connection errors. Users report "the site is down" or "I can't connect." These symptoms are indistinguishable from network outages, server crashes, or firewall issues.

When investigating, teams often start with the wrong assumptions:

- Check if the server is running (it is)
- Check if the firewall is configured correctly (it is)
- Check if the load balancer is healthy (it is)
- Try accessing the site themselves (it works)

The last point is particularly misleading. DNS resolution is cached at multiple levels: the browser, the operating system, the local network's DNS resolver, and upstream DNS servers. If you recently accessed the site, your cached resolution may still be valid even while DNS is broken for new queries.

This leads to the classic "it works on my machine" situation, except the cause is invisible. Your machine has a cached DNS response. The user's machine is trying to resolve fresh and failing.

## The TTL Caching Challenge

DNS caching is essential for performance but complicates both failures and recovery. When you make a DNS change, it doesn't take effect immediately. Old records remain cached until their TTL (time to live) expires.

This creates several diagnostic challenges:

**Inconsistent failures**: Some users experience the problem while others don't, depending on when their cache expires. This makes the issue seem intermittent or user-specific.

**Delayed symptom onset**: A DNS misconfiguration might not cause immediate problems. Users with cached records continue working normally. The failure only manifests as caches expire, potentially hours after the change.

**Slow recovery**: Even after you fix the DNS issue, users with cached bad records continue experiencing failures until their cache expires. This makes it seem like your fix didn't work.

**Geographic variation**: Different DNS resolvers have different cache states. Users in one region might be affected while users in another are fine, making the problem appear to be network-related. This is why [regional monitoring](/articles/why-latency-is-not-universal-in-regional-monitoring) matters for DNS as much as for latency.

## Why Reactive Debugging Fails

The standard debugging approach for production issues is reactive: wait for errors, examine logs, identify the cause. This approach fails for DNS issues because there are no errors to examine.

By the time you realize DNS might be the problem, you've already spent time investigating other possibilities. And confirming DNS as the cause requires tools and techniques outside your normal debugging workflow.

Common reactive approaches and why they fail:

**Checking application logs**: DNS failures don't generate application logs because the application is never contacted.

**Checking error rates**: Your error rate might actually decrease during a DNS outage because fewer requests reach your servers.

**Checking from your own machine**: Your cached DNS may mask the problem.

**Asking users for details**: Users can only report symptoms ("can't connect"), not causes.

## Proactive Monitoring Changes the Game

Proactive DNS monitoring inverts the debugging process. Instead of inferring DNS problems from symptoms, you directly observe DNS behavior and detect issues before they cause user-visible problems.

Effective DNS monitoring checks:

- **Resolution success**: Can your domain be resolved at all?
- **Resolution correctness**: Does it resolve to the expected IP addresses?
- **Resolution latency**: How long does resolution take?
- **Propagation status**: Have changes propagated to major resolvers?

Monitoring from multiple geographic locations is essential. DNS issues are often regional, affecting some resolvers but not others. Single-location monitoring can miss problems that affect a significant portion of your users. You can [make geo-located requests with Durable Objects](/tutorials/make-geo-located-requests-with-durable-objects) to check DNS from different regions.

The key insight is that DNS monitoring should be independent of your application monitoring. This [separation of concerns](/articles/separating-detection-from-notification) ensures you detect DNS failures even when, especially when, your application monitoring shows nothing wrong.

## Building DNS Awareness

Beyond monitoring, building organizational awareness of DNS as a failure mode improves incident response. When "the site is down" reports come in, DNS should be on the initial checklist alongside server health and network connectivity.

Useful practices include:

- Document your expected DNS configuration so you can quickly verify correctness
- Include DNS checks in your incident response runbook
- Use tools like `dig` and `nslookup` with specific resolver addresses to bypass local caching
- Monitor DNS independently from application health checks

DNS failures are hard to diagnose because they're invisible to the tools we normally use. Making them visible through dedicated monitoring transforms them from mysterious outages into quickly identifiable issues.
