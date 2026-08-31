---
title: Maintenance Windows
description: Schedule maintenance windows to prevent false alerts during planned downtime and communicate with your users.
section:
  title: Concepts
  order: 2
order: 9
lastUpdated: 2026-08-11
---

By defining maintenance windows in advance, you prevent false alerts during planned work and keep your team focused on real incidents.

## Why Maintenance Windows Matter

Without maintenance windows, planned downtime creates problems:

- **Alert fatigue** — Your team gets paged for expected outages, reducing trust in the alerting system
- **Skewed statistics** — Planned maintenance counts against your uptime metrics
- **Poor communication** — Users see incidents on your status page that aren't really incidents

Maintenance windows solve these issues by telling Uptime when downtime is intentional.

### Prevent False Alerts

When a monitor is in a maintenance window with alert suppression enabled, Uptime continues checking the service but won't send alerts. Your team stays focused on real problems instead of dismissing expected outages.

### Communicate with Users

Maintenance windows can be displayed on your public status page, letting users know about planned work before it happens. This reduces support tickets and builds trust through transparency.

### Keep Accurate Statistics

Checks during maintenance windows can be excluded from uptime calculations, so your metrics reflect actual service reliability rather than planned maintenance events.

## Configuration Options

When creating a maintenance window, you can configure the following options.

### Name

A descriptive name for the maintenance window, such as "Database migration" or "Weekly infrastructure updates". This name appears in alerts, on status pages, and in maintenance history.

### Scope

Choose how wide the maintenance window reaches:

- **All monitors** — Every monitor you have, of every kind
- **A kind of monitor** — Every HTTP, DNS, TCP or cron monitor, including ones you create later
- **A single monitor** — One monitor, picked from the monitors of its kind

Narrow the scope when only some services are affected. If you're upgrading a database server, apply the window to the monitor that depends on that database.

A whole kind is the right choice when the work happens below your services rather than inside one of them. Migrating a zone to a new nameserver puts every DNS monitor in doubt at once, and a DNS-wide window quiets all of them — including the records you add mid-migration — without touching the HTTP checks that should still page you if the site itself goes down.

### Start Time

The date and time when the maintenance window begins. You can schedule maintenance windows in advance—set them up days or weeks before the actual work.

### Duration

How long the maintenance window lasts. Available durations:

- 15 minutes
- 30 minutes
- 1 hour
- 2 hours
- 4 hours
- 8 hours

Choose a duration that covers your expected maintenance plus some buffer time. You can always end early if you finish ahead of schedule.

### Suppress Alerts

When enabled, no alerts are sent for monitors covered by this maintenance window. Uptime still performs checks and records results, but your team won't be notified.

Keep this enabled for routine maintenance. Disable it only if you want to monitor the maintenance process itself and get alerts if something goes unexpectedly wrong.

### Show on Status Page

When enabled, the maintenance window appears on your public status page. Users see:

- Upcoming maintenance with the scheduled time
- Active maintenance while work is in progress
- The maintenance name and affected services

Enable this for any user-facing maintenance. Disable it for internal work that doesn't affect user experience.

### Recurring Maintenance

For regular maintenance schedules, you can set up recurring windows:

- Daily
- Weekly (select specific days)
- Monthly (select specific dates)

Recurring windows are useful for:

- Weekly deployment windows
- Nightly backup windows
- Monthly patching schedules

Each occurrence creates a separate maintenance window instance that you can end early or modify independently.

## Maintenance States

Maintenance windows move through three states.

### Upcoming

The maintenance window is scheduled but hasn't started yet. During this state:

- The window appears on status pages (if configured)
- Monitors operate normally and send alerts
- You can edit or delete the window

### Active

The maintenance window is currently in progress. During this state:

- Alerts are suppressed (if configured)
- Status pages show maintenance in progress
- Uptime continues monitoring and recording check results
- You can end the window early

### Past

The maintenance window has ended. Past windows:

- Are kept in your maintenance history
- Can be reviewed for auditing purposes
- Show which checks occurred during the window

## Ending Maintenance Early

If you complete maintenance ahead of schedule, use the "End Early" option to:

- Resume normal alerting immediately
- Update status pages to show services are operational
- Accurately reflect the actual maintenance duration

Don't leave maintenance windows running longer than necessary. Ending early ensures you're alerted to any real issues that might occur after maintenance completes.

## Best Practices

### Always Schedule Before Work Begins

Create maintenance windows before starting planned work, not during. This ensures:

- Status pages are updated before users notice downtime
- Your team knows not to respond to expected alerts
- Maintenance is documented in your history

### Enable Status Page Visibility

For any maintenance that affects users, enable "Show on status page". Proactive communication:

- Reduces support ticket volume
- Builds user trust
- Demonstrates operational maturity

### Use the End Early Feature

When maintenance completes, end the window immediately. This:

- Restores normal monitoring and alerting
- Shows users that services are back online
- Keeps your maintenance records accurate

### Set Up Recurring Windows for Regular Maintenance

If you have scheduled maintenance periods (weekly deployments, nightly backups), create recurring windows. This:

- Reduces manual work
- Ensures maintenance is never forgotten
- Provides consistent communication to users

### Apply to Specific Monitors When Possible

If only some services are affected, select specific monitors rather than applying to all:

- Other services remain fully monitored
- Status pages accurately reflect what's affected
- Uptime metrics stay precise

## Next Steps

- [Understanding Monitors](/docs/concepts/monitors) — Learn about the different monitor types
- [Understanding Alerts](/docs/concepts/alerts) — Configure how you get notified
- [Status Pages](/docs/concepts/status-pages) — Communicate service status to your users
