---
title: Designing Alerts That Do Not Cause Fatigue
excerpt: Alert fatigue is a design failure that reveals gaps in your system architecture.
---

Every on-call engineer has experienced it: the constant stream of notifications that eventually becomes background noise. You stop reading them. You start ignoring them. And then, buried in the noise, a critical alert goes unnoticed.

Alert fatigue isn't a configuration problem you can solve by adjusting thresholds. It's a design failure that reveals fundamental gaps in how you think about system observability.

## The Real Cost of Too Many Alerts

When engineers receive hundreds of alerts per day, they develop coping mechanisms. They mute channels, ignore notifications, or create filters that hide alerts from view. This isn't laziness: it's a rational response to an irrational situation.

The danger is that these coping mechanisms don't distinguish between noise and signal. A critical production outage looks the same as the hundredth "disk space warning" of the week. Both get ignored.

Studies in healthcare have shown that alert fatigue leads to missed critical events. The same principle applies to software systems. If your team ignores 90% of alerts, you're effectively operating without monitoring for 90% of your failure modes.

## Flapping Services Reveal Architecture Problems

A "flapping" service, one that rapidly alternates between healthy and unhealthy states, generates a storm of alerts. The instinct is to add hysteresis or cooldown periods to reduce the noise. But this treats the symptom, not the disease.

Flapping usually indicates one of several problems:

1. **Thresholds set too close to normal operating parameters.** If your service normally uses 75% CPU and you alert at 80%, minor fluctuations will trigger constant alerts.

2. **Missing health check grace periods.** Services that take time to warm up will fail health checks during startup, triggering alerts that resolve seconds later. Implementing [grace periods](/articles/designing-grace-periods-for-variance) can eliminate this noise.

3. **Cascading failures.** When Service A depends on Service B, and B has intermittent issues, A will flap in response. The alert on A is noise: the real problem is B.

4. **Insufficient capacity.** A service operating at the edge of its capacity will oscillate between healthy and overloaded states under normal traffic variation.

Each of these is an architecture problem, not an alerting problem. Cooldown periods hide the symptom while the underlying issue continues to degrade your system. And remember that services exist in [three states—up, down, and degraded](/articles/the-three-states-of-service-health)—not just the binary healthy/unhealthy that causes flapping.

## Cooldown Periods: Necessary but Not Sufficient

That said, cooldown periods serve an important purpose when used correctly. They prevent alert storms during known transient conditions and give engineers time to respond before being interrupted again.

A well-designed cooldown should:

- Be long enough to prevent duplicate alerts for the same incident
- Be short enough that a new, distinct incident still triggers promptly
- Reset when the underlying condition changes significantly

The key insight is that cooldowns should be tuned per alert type based on the expected resolution time. A disk space alert might have a 24-hour cooldown because adding storage takes time. A latency spike alert might have a 5-minute cooldown because it often resolves quickly. For a practical implementation, see the tutorial on [building an alert cooldown system](/tutorials/build-an-alert-cooldown-system).

## Limiting Alert Count Forces Better Architecture

Here's a counterintuitive approach: impose a hard limit on the number of active alerts your team will maintain. Say, 20 alerts total.

This constraint forces difficult conversations. Which failure modes actually matter? Which alerts have never fired, or fire constantly without action? Which problems should be fixed rather than monitored?

When you can only have 20 alerts, you stop alerting on things that don't require immediate human intervention. You start fixing the underlying issues that cause frequent alerts. You combine related alerts into higher-level health checks.

The result is a monitoring system where every alert means something. Engineers learn to trust the alerts because they know each one represents a real problem that requires their attention.

## Recovery Notifications Complete the Loop

An often-overlooked aspect of alert design is the recovery notification. Knowing when a problem resolves is just as important as knowing when it occurs. Without recovery notifications, engineers must manually check whether issues have resolved, adding cognitive load and delaying incident closure.

I've written more about this in [Recovery Notifications Are Not Optional](/articles/recovery-notifications-are-not-optional).

## Actionable Alerts Only

Every alert should have a clear action associated with it. If an engineer receives an alert and their response is "I don't know what to do with this," the alert has failed.

Before creating an alert, answer these questions:

- What specific action should the on-call engineer take?
- Is this action something that must happen immediately, or can it wait?
- Does this alert provide enough context to take that action?

If the action can wait until business hours, it's not an alert: it's a ticket. If there's no action to take, it's not an alert: it's a metric to watch on a dashboard.

## The Path Forward

Fixing alert fatigue requires treating it as a design problem, not a tuning problem. This means:

1. Auditing existing alerts and removing those that don't drive action
2. Investigating flapping services as architecture issues
3. Implementing appropriate cooldowns based on expected resolution times
4. Adding recovery notifications to enable confident incident closure
5. Setting constraints that force prioritization

The goal isn't fewer alerts for the sake of fewer alerts. The goal is a monitoring system that engineers trust, where every notification represents a real problem that requires their attention. When you achieve that, alert fatigue disappears because there's no fatigue-inducing noise to begin with.
