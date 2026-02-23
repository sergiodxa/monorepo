---
title: Maintenance Windows as a First-Class Concept
excerpt: Treating maintenance windows as structured data improves uptime accuracy and operational clarity.
---

"Just disable the alert" is the most common approach to handling planned maintenance. It works, technically. But it creates a gap in your monitoring history, skews your uptime calculations, and leaves your status page showing green when users might actually experience degraded service.

Maintenance windows deserve to be a first-class concept in your monitoring system, not an afterthought bolted on through alert suppression.

## The Problem with Alert Suppression

When you disable an alert during maintenance, you're essentially telling your monitoring system to lie. The service might be down, but the system pretends everything is fine. This creates several problems.

Your uptime calculations become inaccurate. If you're reporting 99.9% uptime to customers or stakeholders, that number should reflect actual availability, not availability minus the times you told the system to look away.

Your incident history has gaps. When you review what happened last month, you see nothing during maintenance windows. Did everything go smoothly? Did the maintenance take longer than expected? The data isn't there.

Your status page shows green when it shouldn't. Users checking your status page during a maintenance window see "All Systems Operational" while the service is actually unavailable. This erodes trust.

## Maintenance as Structured Data

A proper maintenance window should be a data structure with specific properties: a start time, an expected end time, affected services, a reason, and a status. This turns maintenance from "a period when we ignore problems" into "a documented operational event."

With this approach, your monitoring system can distinguish between [three states: operational, incident, and maintenance](/articles/the-three-states-of-service-health). Each state has different implications for uptime calculations, status page display, and alerting behavior.

During maintenance, alerts are still collected but not dispatched. This [separation between detection and notification](/articles/separating-detection-from-notification) means the data exists. You can review it later. If something unexpected happens during maintenance, you have the information to understand what went wrong.

## Uptime Calculations That Make Sense

How should maintenance affect uptime? There are two reasonable approaches.

The first approach excludes maintenance from the calculation entirely. If you have a 30-minute maintenance window in a month, your uptime is calculated against the remaining time. This makes sense when maintenance is truly planned and communicated to users in advance.

The second approach counts maintenance as downtime but tracks it separately. Your "raw uptime" might be 99.5%, but your "unplanned downtime" is 99.9%. This distinction matters for SLA reporting and helps you understand how much of your downtime is within your control.

Either approach is better than pretending the maintenance didn't happen.

## Status Page Accuracy

A status page that shows "Operational" during maintenance is worse than useless. Users learn they can't trust it, so they stop checking it and go straight to support tickets. [Transparency on your status page](/articles/status-pages-as-a-transparency-feature) is how you build trust.

Maintenance windows should appear on your status page with their own visual treatment. Users should see that the service is in maintenance, when it started, and when it's expected to end. This is transparency that builds trust.

Some teams worry that showing maintenance on the status page looks bad. The opposite is true. Planned maintenance shows that you're actively maintaining your infrastructure. It's a sign of a healthy operation, not a failure.

## The "End Early" Feature

Maintenance windows have an expected duration, but reality doesn't always match expectations. Sometimes maintenance finishes early. Sometimes it runs long.

The ability to end a maintenance window early is surprisingly important. Without it, your status page shows "Maintenance" for the full scheduled duration even if you finished in half the time. Users see degraded status when the service is actually fine.

Ending maintenance early also creates valuable data. If you consistently finish maintenance faster than scheduled, you can adjust your estimates. If you frequently run over, that's a signal to investigate why.

## Maintenance Duration as a Data Point

How long does your weekly deployment actually take? How much time do you spend on monthly patching? Most teams can't answer these questions accurately because they don't track maintenance as structured data. Tracking recurring maintenance helps automate this for scheduled operations.

When maintenance windows are first-class concepts, you accumulate data about your operational overhead. You can see trends: is deployment time increasing as the codebase grows? Is patching taking longer as you add more servers?

This data informs capacity planning and process improvement. You might discover that your "30-minute deployment window" actually averages 45 minutes, which affects how you schedule maintenance and communicate with users.

## Alert History During Maintenance

Even during planned maintenance, your monitoring system should continue collecting data. Alerts that would have fired should be logged, just not dispatched.

This serves two purposes. First, it helps you verify that maintenance went as expected. If no alerts fired during the window, the maintenance was clean. If alerts fired, you know something unexpected happened.

Second, it helps you distinguish between maintenance-related issues and unrelated problems. If an alert fires during maintenance but for a service that wasn't part of the maintenance scope, that's a real incident that needs attention.

## Communicating Maintenance

Maintenance windows create natural communication points. When a window starts, affected users should be notified. When it ends, they should be notified again. If it runs over the expected duration, that's another notification.

This communication can be automated. Your monitoring system knows when maintenance starts and ends, so it can trigger notifications without manual intervention. This reduces the operational burden and ensures consistent communication.

## Conclusion

Treating maintenance windows as first-class concepts rather than alert suppression periods improves every aspect of your monitoring: uptime calculations become accurate, status pages become trustworthy, and you accumulate valuable operational data.

The investment is minimal. You're already doing maintenance. You're already suppressing alerts. The only change is capturing that information in a structured way and using it to improve your operations.
