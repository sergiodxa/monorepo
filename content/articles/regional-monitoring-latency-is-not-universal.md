---
title: "Regional Monitoring: Latency Is Not Universal"
excerpt: Your service might be fast in Virginia and slow in Sydney.
---

A service that responds in 50ms from Virginia might take 500ms from Sydney. Single-region monitoring will show healthy response times while a significant portion of your users experiences poor performance. This false confidence is one of the most common monitoring blind spots.

Latency is fundamentally a function of distance. Data travels through fiber optic cables at roughly two-thirds the speed of light. A round trip from Sydney to Virginia covers about 16,000 kilometers, adding at least 80ms of latency from physics alone. Real-world routing adds more.

## The False Confidence Problem

Most monitoring setups check from a single location, often the same region where the application is deployed. This creates a best-case measurement that doesn't reflect global user experience.

Consider a typical setup: your application runs in `us-east-1`, and your monitoring runs from the same region or nearby. Every health check shows 20ms response times. Your dashboards are green. Your SLOs are met.

Meanwhile, users in Asia Pacific experience 300ms response times. Users in Europe see 150ms. Your monitoring never captures this because it never measures from those locations.

This isn't a subtle difference. A 20ms response time feels instant. A 300ms response time feels sluggish. Your monitoring says everything is fine while a third of your users has a [degraded experience](/articles/the-three-states-of-service-health) that never shows up in your dashboards.

## Choosing Regions Based on User Distribution

Effective regional monitoring requires understanding where your users are. There's no universal set of regions that works for every service.

Start with your analytics data. Where do your users come from? Group them by geographic region and identify the major clusters. Your monitoring locations should cover these clusters.

Common patterns include:

**Global consumer service**: Monitor from North America, Europe, Asia Pacific, and South America. Cover major population centers where your users are concentrated.

**US-focused B2B service**: Monitor from both US coasts and potentially the central US. Even within a single country, coast-to-coast latency differences are noticeable.

**Regional service**: If you only serve Europe, monitoring from Sydney doesn't help. Focus your monitoring budget on locations within your service area.

**Multi-region deployment**: If you deploy to multiple regions, monitor from locations that should route to each deployment. This validates that geographic routing works correctly.

The goal is representative coverage, not exhaustive coverage. Three well-chosen monitoring locations provide more insight than ten poorly chosen ones.

## What Regional Discrepancies Reveal

When monitoring shows different latencies from different regions, the discrepancy itself is informative. The pattern of differences reveals infrastructure characteristics.

**Consistent high latency from distant regions**: This is expected physics. If Sydney consistently shows 200ms more latency than Virginia, that's the speed of light, not a problem to fix.

**Intermittent high latency from specific regions**: This suggests routing issues, congested network paths, or problems with specific ISPs or transit providers.

**Sudden latency increase from one region**: This might indicate a CDN configuration change, a failed regional deployment, or a network path change.

**All regions show increased latency simultaneously**: This points to an origin server problem, not a network or geographic issue.

**Some regions timeout while others succeed**: This suggests geographic routing failures, regional outages, or firewall rules affecting specific source IPs.

Regional monitoring turns latency from a single number into a diagnostic tool. The pattern of regional differences tells you where to investigate.

## CDN and Edge Deployment Validation

Regional monitoring becomes essential when you deploy to the edge. CDNs, edge functions, and multi-region deployments are supposed to reduce latency for global users. Regional monitoring validates that they actually do.

A misconfigured CDN might route all traffic to a single origin, negating the geographic distribution. Edge function deployments might fail in specific regions while succeeding in others. Geographic DNS routing might send users to the wrong region.

Without regional monitoring, these issues are invisible. Your origin servers see normal traffic. Your single-region monitoring shows normal latency. Only users in affected regions experience the problem. [DNS failures exhibit similar regional behavior](/articles/why-dns-failures-are-hard-to-diagnose), making multi-region monitoring essential for both latency and availability.

Regional monitoring should show that users in each region are served by nearby infrastructure. If Sydney users see the same latency as Virginia users to a US-based origin, your edge deployment isn't working.

## Implementation Considerations

Regional monitoring has practical constraints that affect implementation:

**Cost**: Monitoring from more regions costs more. Balance coverage against budget. Start with your highest-traffic regions and expand as needed.

**Frequency**: Checking from ten regions every minute generates ten times the data and cost of single-region monitoring. Adjust check frequency based on how quickly you need to detect issues.

**Baseline establishment**: Each region has a different expected latency. You need region-specific baselines and thresholds, not a single global threshold. An [alert cooldown system](/tutorials/build-an-alert-cooldown-system) can help prevent notification storms when regional issues occur.

**Alert fatigue**: More monitoring locations means more potential alerts. Configure alerting to distinguish between regional issues and global outages. [Designing alerts that don't cause fatigue](/articles/designing-alerts-that-dont-cause-fatigue) becomes even more important with regional monitoring.

**Synthetic vs. real user monitoring**: Synthetic checks from monitoring locations complement real user monitoring (RUM). Synthetic catches issues proactively; RUM shows actual user experience.

## The Latency Budget Perspective

Regional monitoring also informs latency budgets. If your application needs to feel responsive globally, you need to understand how much latency is consumed by geography before your application code even runs.

A 100ms latency budget is achievable for users near your servers. For users on the other side of the world, physics consumes most of that budget before the request reaches your application. This might mean you need edge deployment, or it might mean you need different performance expectations for different regions.

Regional monitoring makes these trade-offs visible. You can make informed decisions about where to deploy, what latency to promise, and how to set user expectations. Without regional data, you're optimizing for users you can measure while ignoring users you can't.
