---
title: Alerts & Notifications
description: Get notified when your monitors detect issues. Configure alerts via email, Slack, Discord, or custom webhooks.
section:
  title: Concepts
  order: 2
order: 7
lastUpdated: 2026-08-04
---

When a monitor detects an issue—a website goes down, an API returns errors, a cron job misses its schedule—alerts deliver that information to the right people through the right channels.

## How Alerts Work

Alerts connect monitors to notification channels. When a monitor's status changes (for example, from "up" to "down"), Uptime evaluates your alert configuration and sends notifications to the appropriate channels.

The flow is straightforward:

1. A monitor detects a status change
2. Uptime checks which alerts are configured for that monitor
3. Each matching alert sends a notification through its configured channel
4. The alert event is recorded in your alert history

Every alert has a **scope** that decides which monitors it hears about: every monitor on the team, every monitor of one kind, or a single monitor. This lets you set up focused alerts for critical services while maintaining a catch-all alert for everything else.

### When an Alert Fires During an Outage

For any single outage, an alert follows the same three-part pattern:

1. **Immediately, as soon as the monitor is detected down.** The first notification of an outage is never held back—no confirming second check, and no cooldown applies to it. Whatever cooldown you configure, the news that something just broke reaches you on the first failing check.
2. **Again, each time the cooldown expires while the monitor is still down.** An ongoing outage keeps reminding you at your configured interval for as long as it lasts. There is no limit on how many notifications one outage can produce: a monitor that stays down for three days on a one-hour cooldown sends roughly one notification an hour for three days.
3. **Once more when it recovers**, if "notify on recovery" is enabled.

Between those, failing checks that fall inside the cooldown window are recorded in your alert history as skipped rather than sent, and the recovery notification reports how many were held back—so a quiet incident never looks like dropped alerts.

## Alert Channels

Uptime supports four notification channels, each suited for different workflows and team setups.

### Email

Email alerts are the simplest option—enter an email address, and Uptime sends notifications when issues occur.

**Configuration options:**

- **Email address** — Where to send notifications (can be any valid email, not just team members)
- **Subject prefix** (optional) — Add a custom prefix to email subjects for easier filtering (e.g., `[PROD]` or `[CRITICAL]`)

Email works well for:

- Personal notifications to on-call engineers
- Team distribution lists
- Integration with email-based ticketing systems
- Backup notifications when other channels might be unavailable

### Webhook

Webhooks send HTTP POST requests to your endpoint when alerts trigger. This is the most flexible option, enabling integration with virtually any system.

**Configuration options:**

- **URL** — Your endpoint that will receive the POST request
- **Secret** (optional) — A shared secret used to sign requests, allowing you to verify they came from Uptime

When an alert fires, Uptime sends a JSON payload containing:

- Monitor details (name, type, URL/target)
- Event type (down, up, degraded)
- Timestamp
- Additional context based on monitor type

If you configure a secret, Uptime includes a signature header that you can use to verify the request's authenticity. This prevents malicious actors from spoofing alert notifications.

Webhooks are ideal for:

- Custom dashboards and internal tools
- Integration with PagerDuty, OpsGenie, or other incident management platforms
- Triggering automated remediation workflows
- Feeding data into logging or analytics systems

### Slack

Send alerts directly to Slack channels using an incoming webhook URL.

**Configuration options:**

- **Webhook URL** — Your Slack incoming webhook URL
- **Channel override** (optional) — Send to a different channel than the webhook's default

To set up Slack integration:

1. Create an incoming webhook in your Slack workspace (Apps → Incoming Webhooks)
2. Copy the webhook URL
3. Paste it into your Uptime alert configuration
4. Optionally specify a channel override (e.g., `#incidents` or `#oncall`)

Slack alerts include formatted messages with:

- Monitor name and status
- Direct link to the monitor in Uptime
- Timestamp and relevant details

### Discord

Send alerts to Discord channels using a webhook URL.

**Configuration options:**

- **Webhook URL** — Your Discord channel webhook URL

To set up Discord integration:

1. Open your Discord server settings
2. Navigate to Integrations → Webhooks
3. Create a new webhook and copy the URL
4. Paste it into your Uptime alert configuration

Discord alerts are formatted as embeds with clear status indicators and monitor details.

## Alert Configuration

Every alert has several configuration options beyond the channel settings.

### Name

Give your alert a descriptive name that makes it easy to identify in your alert list and in notification messages. Good names describe what the alert covers:

- "Production API - Engineering Team"
- "All Monitors - Email Backup"
- "Critical Services - PagerDuty"

### Notify on Recovery

When enabled, Uptime sends a notification when a service comes back up, not just when it goes down. This helps you:

- Know when issues resolve without manually checking
- Close incident tickets automatically (via webhooks)
- Reduce anxiety during outages—you'll know when things are fixed

Recovery notifications are strongly recommended for most alert configurations.

### Cooldown Period

The cooldown is how far apart repeat notifications are spaced while a monitor stays broken. It does not delay the first notification of an outage—that one always goes out immediately—it only decides how often the outage keeps reminding you afterwards.

Cooldown is set per alert, in minutes, anywhere from 0 to 1440 (24 hours). When you don't choose one, Uptime uses **60 minutes**: an ongoing outage reports itself once an hour, which is frequent enough to stay in front of you and quiet enough that a day-long outage is 24 notifications rather than hundreds.

Common choices:

- **5 minutes** — Critical services where you want frequent updates during an outage
- **15 minutes** — Tighter than the default, for services with short recovery targets
- **60 minutes** — The default; hourly reminders for as long as the outage lasts
- **120 minutes or more** — Minimizes interruptions for low-priority monitors
- **0** — As often as allowed, for an alert you want to hear from on nearly every failing check

Repeat notifications are never sent more often than **once every five minutes**, whatever the cooldown says. That floor is why a cooldown of `0` means "as often as allowed" rather than "one notification per check"—the fastest monitor interval is 60 seconds, so a `0` cooldown produces at most 12 notifications an hour instead of 60.

Cooldowns are especially valuable when services are "flapping"—rapidly alternating between up and down states. With a 60-minute cooldown, you get one notification and then silence for an hour, however many times the monitor bounces in between.

Recovery notifications are spaced by the cooldown you configured, and the five-minute floor does not apply to them. Setting a very low cooldown on a flapping monitor can therefore produce a "recovered" message per flap; raising the cooldown is what stops that.

Changing an alert's cooldown only affects that alert. Alerts you configured before the one-hour default existed keep the cooldown you gave them, including `0`.

### Scope

Every alert is scoped one of three ways, chosen from a single dropdown on the alert form:

- **Team-wide** — The alert fires for every monitor on your team, of every kind. This is the default, and it is what every alert created before scoping existed still does.
- **Every monitor of one kind** — The alert fires for all your HTTP monitors, or all your DNS monitors, or all your TCP monitors, or all your cron jobs, and for nothing else. The choice covers monitors you add later too, so a new domain is watched the moment you create it.
- **One monitor** — The alert fires only for that monitor, whichever kind it is.

Narrowing the scope is useful when:

- Different services have different on-call rotations
- You want different notification channels for different environments
- Critical services need dedicated alerting separate from general monitoring
- One kind of monitor is noisier than the rest and deserves its own channel

That last case is what DNS monitoring usually runs into. A domain monitor reports every record that stops resolving, every record that changes, and every record it newly discovers across the whole zone, so a busy domain can produce far more notifications than a website going down. Scoping a DNS-only alert to its own channel keeps that traffic away from the one your on-call phone is attached to.

Leaving an alert team-wide provides a safety net—even if you forget to configure a specific alert for a new monitor, the catch-all alert will notify you.

Certificate expiry warnings follow the HTTP monitor they belong to: an alert scoped to that monitor, or to HTTP monitors as a kind, receives them.

If an alert is scoped to a monitor you later delete, its scope reads as an unknown monitor and it stops firing. Editing it makes you pick a new scope before it can be saved, rather than silently widening it back to everything.

## Alert Events and History

Every time an alert fires (or would fire but is in cooldown), Uptime records an event. The alert history shows:

- **Timestamp** — When the event occurred
- **Monitor** — Which monitor triggered the alert
- **Event type** — Down, up, degraded, or recovery
- **Channel** — Which notification channel was used
- **Status** — Whether the notification was sent, skipped because the cooldown had not expired, or failed

Older events may show a "Skipped (Repeat Limit)" status. That came from a previous policy that stopped notifying after a fixed number of notifications per incident; nothing produces it any more, and the label is kept only so historical events still read correctly.

Alert history helps you:

- Audit past incidents and response times
- Identify patterns in service failures
- Verify that notifications are being delivered
- Debug integration issues with webhooks or chat platforms

Events are retained according to your plan's data retention policy.

## Best Practices

### Use Cooldowns to Prevent Alert Fatigue

Nothing burns out an on-call engineer faster than constant notifications. You will always hear about a new outage on the first failing check, so the cooldown is purely about how insistently the same outage repeats itself.

Start with the 60-minute default and shorten it for the services where an hour of silence is too long. Lengthening it never costs you the initial notification, and shortening it never gets you more than one notification every five minutes.

### Enable Recovery Notifications

Always enable "notify on recovery" for alerts. Knowing when a service comes back up is just as important as knowing when it goes down. Recovery notifications:

- Let you close incidents confidently
- Reduce the need to constantly check dashboards
- Provide clear incident timelines for post-mortems

### Set Up Multiple Channels for Redundancy

Don't rely on a single notification channel. If Slack is down, you won't get your Slack alerts. Configure at least two channels:

- **Primary**: Slack or Discord for team visibility
- **Backup**: Email for guaranteed delivery

For critical services, consider adding a third channel like PagerDuty or OpsGenie that can escalate to phone calls.

### Use Webhooks for Custom Integrations

Webhooks unlock powerful workflows beyond basic notifications:

- **PagerDuty/OpsGenie** — Create incidents automatically with proper severity levels
- **Incident management** — Update status pages or create tickets
- **Auto-remediation** — Trigger runbooks or restart services
- **Analytics** — Feed alert data into your observability stack

When using webhooks, always configure a secret to verify request authenticity.

### Stay Within Limits

Each team can configure a maximum of **10 alerts**. This limit encourages thoughtful alert design rather than creating an alert for every possible scenario.

If you find yourself needing more alerts, consider:

- Using unlinked alerts that cover multiple monitors
- Consolidating similar monitors under single alerts
- Using webhooks to fan out to multiple destinations from one alert

## Next Steps

- [Understanding Monitors](/docs/concepts/monitors) — Learn about the different monitor types
- [HTTP Monitors](/docs/concepts/http-monitors) — Deep dive into monitoring web endpoints
- [Status Pages](/docs/concepts/status-pages) — Share service health with your users
