---
title: Recovery Notifications Are Not Optional
excerpt: Knowing when something comes back up is as important as knowing when it goes down.
---

Your monitoring system pages you at 2 AM. The database connection pool is exhausted. You investigate, find the runaway query, kill it, and watch the metrics return to normal. Then you go back to bed.

But did you actually close the incident? Or did you just stop looking at it?

Without a recovery notification, you don't know for certain that the system recovered. You're trusting your interpretation of the metrics. You're assuming the fix worked. And tomorrow morning, you might discover the problem came back five minutes after you stopped watching.

## The Psychological Cost of Manual Verification

When alerts don't have corresponding recovery notifications, engineers develop a habit of manual verification. After addressing an issue, they watch dashboards, refresh metrics, and wait to see if things stabilize.

This manual verification has real costs:

**Extended incident duration**: Instead of confidently closing an incident and returning to other work, engineers spend extra time watching and waiting. A 10-minute fix becomes a 30-minute incident.

**Incomplete closure**: Without a definitive "all clear" signal, there's always lingering doubt. Did it really recover? Should I check again in an hour? This uncertainty creates cognitive load that persists long after the incident.

**Sleep disruption**: For overnight incidents, the difference between "fixed and recovered" and "fixed but still watching" is the difference between going back to sleep and lying awake wondering if you'll be paged again.

**Context switching costs**: When you can't confidently close an incident, you can't fully context-switch to other work. Part of your attention remains on the unresolved issue.

## Recovery Notifications Enable Confident Closure

A recovery notification is a definitive signal that the monitored condition has returned to normal. It's not just "the alert stopped firing": it's an explicit message that says "the system has recovered."

This distinction matters. An alert might stop firing because:

- The condition actually resolved
- The monitor itself failed
- Someone muted the alert
- The alerting system is having issues

A proper recovery notification confirms the first case. It tells you that the monitor is still running, still checking, and now observing healthy conditions.

With recovery notifications, incident closure becomes straightforward:

1. Receive alert
2. Investigate and remediate
3. Receive recovery notification
4. Close incident with confidence

No manual verification needed. No lingering doubt. No watching dashboards waiting for confirmation.

## Designing Effective Recovery Notifications

Not all recovery notifications are equally useful. A good recovery notification should:

**Include context about the original incident**: Don't just say "API latency recovered." Say "API latency recovered after 23 minutes. Peak latency was 2.3s, now 145ms." This context helps engineers understand the incident's scope without having to look up the original alert.

**Arrive promptly**: If recovery notifications are delayed, engineers will continue manual verification anyway. The notification should arrive within the same time window as the original alert detection.

**Go to the same channels**: If the alert went to Slack and PagerDuty, the recovery should too. Engineers shouldn't have to check multiple places to confirm recovery.

**Be clearly distinguishable from alerts**: Use different formatting, colors, or prefixes so recovery notifications don't cause momentary panic. Seeing a notification from your monitoring system shouldn't trigger an adrenaline response when it's good news.

## Handling Flapping Services

Recovery notifications become complicated when services flap between healthy and unhealthy states. You don't want to receive alert-recovery-alert-recovery sequences every few minutes.

The solution is hysteresis: require the healthy state to persist for some duration before sending a recovery notification. If your alert has a 5-minute cooldown, your recovery notification might require 5 minutes of sustained healthy state. This is another form of [designing for variance](/articles/grace-periods-designing-for-variance)—giving the system time to stabilize before declaring victory.

This prevents premature recovery notifications while still providing the definitive closure signal when the system truly stabilizes.

For more on handling flapping and alert design, see [Designing Alerts That Don't Cause Fatigue](/articles/designing-alerts-that-dont-cause-fatigue).

## Recovery Notifications in Incident Management

Recovery notifications also play a role in formal incident management processes. Many organizations require incidents to be formally closed with documentation of resolution and recovery.

A recovery notification provides:

- **Timestamp for recovery**: Essential for calculating incident duration and meeting SLA requirements. This data is also valuable for [status pages](/articles/status-pages-transparency-as-a-feature) that show incident timelines to customers
- **Confirmation of resolution**: Evidence that the fix worked, not just that someone said it did
- **Audit trail**: Documentation that the system returned to normal operation

Without recovery notifications, these data points must be manually recorded, introducing potential for error and delay.

## Implementation Considerations

When implementing recovery notifications, consider:

**State tracking**: Your monitoring system needs to track alert state to know when to send recovery notifications. This is more complex than stateless "fire and forget" alerting.

**Notification deduplication**: If an alert fires multiple times before recovery, you typically want one recovery notification, not one per alert.

**Channel reliability**: Recovery notifications are only useful if they're delivered. Consider [redundant notification channels](/articles/redundant-notification-channels) to ensure delivery.

**Graceful degradation**: If your notification system has issues, you should still be able to verify recovery through dashboards or direct metric queries.

## The Complete Picture

Recovery notifications complete the alerting lifecycle. An alert without a recovery notification is like a function that never returns: you can observe its effects, but you never get confirmation that it finished.

Some teams resist recovery notifications because they add noise. But this perspective misses the point. A recovery notification isn't noise: it's the resolution of a conversation your monitoring system started. It's the period at the end of the sentence.

If recovery notifications feel like noise, the problem is likely too many alerts in the first place. Fix the alert volume problem, and recovery notifications become the welcome confirmation they should be.
