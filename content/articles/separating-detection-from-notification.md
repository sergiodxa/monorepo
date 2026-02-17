---
title: Separating Detection from Notification
excerpt: Monitors and alerts should be decoupled systems with independent lifecycles.
---

Most monitoring systems conflate two distinct concerns: detecting that something is wrong and notifying someone about it. This coupling seems natural at first. You set up a monitor, and when it triggers, it sends an alert. Simple.

But this simplicity creates problems as your system grows. Different teams need different notification strategies. The same underlying issue might require different escalation paths depending on severity. And when you need to change how notifications work, you end up touching every monitor in your system.

## The Problem with Coupled Systems

Consider a typical setup: you have a monitor that checks API latency every minute. When latency exceeds 500ms, it sends a Slack message to the engineering channel.

Now requirements change:

- The support team also needs to know about latency issues, but only if they last more than 5 minutes
- Executives want a daily summary of any latency incidents, not real-time alerts
- The on-call engineer needs a PagerDuty notification for latency over 2 seconds
- The SRE team wants all latency data pushed to their analytics platform

With a coupled system, you end up creating four separate monitors, each with slightly different thresholds and destinations. They're checking the same metric but can drift out of sync. When you need to change the latency threshold, you have to remember to update all four.

## One Monitor, Many Alerts

The solution is to separate detection from notification. A monitor's job is to observe system state and determine when conditions are abnormal. An alert's job is to notify specific people through specific channels based on rules you define.

This separation enables a one-to-many relationship: one monitor can feed multiple alerts with different criteria.

Your latency monitor detects when latency exceeds various thresholds. Then:

- Alert A sends to Slack immediately when latency > 500ms
- Alert B sends to Slack after 5 minutes of sustained latency > 500ms
- Alert C pages on-call when latency > 2000ms
- Alert D aggregates incidents for a daily executive summary
- Alert E streams all data to the analytics webhook

Each alert has its own rules, channels, and audience. The monitor doesn't know or care about any of this. It just reports what it observes.

## One Alert, Many Monitors

The relationship works in the other direction too. A single alert can aggregate signals from multiple monitors.

This is particularly useful when monitors need different detection strategies—for example, active health checks versus [passive heartbeat monitoring using the dead man's switch pattern](/articles/the-dead-mans-switch-pattern).

Consider an "API Health" alert that should fire when any of these conditions are true:

- Latency exceeds threshold
- Error rate exceeds threshold
- Request queue depth exceeds threshold
- Database connection pool is exhausted

Rather than creating four separate alerts that might fire simultaneously (overwhelming the on-call engineer), you create one alert that subscribes to all four monitors. The alert fires once, with context about which conditions triggered it.

This approach is particularly valuable for complex systems where problems manifest through multiple symptoms. Instead of receiving five alerts about the same underlying issue, you receive one alert that says "API Health degraded: high latency, elevated error rate, database connections exhausted." This also maps well to [the three states of service health](/articles/the-three-states-of-service-health), where degraded states might trigger different notification strategies than full outages.

## Different Audiences, Different Strategies

The real power of separation becomes clear when you consider different audiences.

**Engineering teams** need detailed, real-time alerts with technical context. They want to know exactly which service, which endpoint, which datacenter. They need links to dashboards and runbooks. They can handle high alert volume because responding to alerts is part of their job.

**Support teams** need alerts framed in terms of customer impact. They don't care that the database connection pool is exhausted: they care that customers might experience slow page loads. They need alerts that help them communicate with customers, not debug systems.

**Executives** need aggregated, summarized information. They don't want to be paged at 3 AM for a latency spike that the engineering team already resolved. They want to know about trends, patterns, and incidents that affected customers or revenue.

With decoupled systems, you can serve all these audiences from the same underlying monitors. The detection logic stays consistent while the notification strategy adapts to each audience's needs.

## Implementation Patterns

There are several ways to implement this separation:

**Event-driven architecture**: Monitors publish events to a message bus. Alert services subscribe to relevant events and apply their own rules before sending notifications. This provides maximum flexibility but requires more infrastructure.

**Alert routing rules**: A central alert manager receives all monitor outputs and applies routing rules to determine which notifications to send. This is simpler to operate but can become a bottleneck.

**Webhook fan-out**: Monitors send webhooks to a distribution service that forwards to multiple destinations based on configuration. This works well when you need to integrate with external systems. When implementing webhook-based notification, ensure you're [signing webhooks with HMAC](/articles/webhook-signing-hmac-for-notification-security) to prevent spoofed alerts.

The right choice depends on your scale and existing infrastructure. The important thing is maintaining the conceptual separation, even if the implementation is simple.

## Practical Benefits

Beyond flexibility, this separation provides concrete operational benefits:

**Easier testing**: You can test monitors and alerts independently. Verify that monitors detect conditions correctly without worrying about notification delivery. Test notification routing without needing to trigger actual incidents.

**Simpler maintenance**: When you need to add a new notification channel, you don't touch any monitors. When you need to adjust detection thresholds, you don't touch any alerts.

**Better observability**: You can track metrics separately for detection (how often do conditions occur?) and notification (how often do we alert? what's our alert-to-incident ratio?).

**Graceful degradation**: If your notification system has issues, your monitors keep running and recording data. You don't lose visibility into your systems just because Slack is down.

## The Path Forward

If you're starting fresh, design your monitoring system with this separation from the beginning. Define clear interfaces between detection and notification components.

If you have an existing coupled system, you can migrate incrementally. Start by adding an abstraction layer between your monitors and their notification logic. Route all notifications through this layer, then gradually add the flexibility you need.

The goal is a monitoring system where adding a new audience or notification channel is a configuration change, not a code change. Where adjusting detection thresholds doesn't require updating multiple places. Where the complexity of your notification requirements doesn't pollute the simplicity of your detection logic.
