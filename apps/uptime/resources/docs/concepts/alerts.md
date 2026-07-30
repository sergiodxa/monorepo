---
title: Alerts & Notifications
description: Get notified when your monitors detect issues. Configure alerts via email, Slack, Discord, or custom webhooks.
section:
  title: Concepts
  order: 2
order: 6
lastUpdated: 2026-02-14
---

When a monitor detects an issue—a website goes down, an API returns errors, a cron job misses its schedule—alerts deliver that information to the right people through the right channels.

## How Alerts Work

Alerts connect monitors to notification channels. When a monitor's status changes (for example, from "up" to "down"), Uptime evaluates your alert configuration and sends notifications to the appropriate channels.

The flow is straightforward:

1. A monitor detects a status change
2. Uptime checks which alerts are configured for that monitor
3. Each matching alert sends a notification through its configured channel
4. The alert event is recorded in your alert history

You can link alerts to specific monitors or configure them to trigger for any monitor on your team. This flexibility lets you set up focused alerts for critical services while maintaining a catch-all alert for everything else.

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

Cooldown periods prevent alert fatigue by limiting how frequently an alert can fire. After an alert triggers, it won't trigger again until the cooldown period expires.

Available cooldown options:

- **None** — Alert on every status change (no cooldown)
- **5 minutes** — Good for critical services where you want frequent updates
- **15 minutes** — A reasonable default for most services
- **30 minutes** — Reduces noise for less critical services
- **1 hour** — For services where hourly updates are sufficient
- **2 hours** — Minimizes interruptions for low-priority monitors
- **Custom** — Set any duration that fits your needs

Cooldowns are especially valuable when services are "flapping"—rapidly alternating between up and down states. Without a cooldown, you might receive dozens of alerts in minutes. With a 15-minute cooldown, you get one alert and then silence until the situation stabilizes or the cooldown expires.

### Linked Monitor

Alerts can be configured in two ways:

- **Linked to a specific monitor** — The alert only fires for that one monitor
- **Not linked (all monitors)** — The alert fires for any monitor on your team

Linking to specific monitors is useful when:

- Different services have different on-call rotations
- You want different notification channels for different environments
- Critical services need dedicated alerting separate from general monitoring

Leaving alerts unlinked provides a safety net—even if you forget to configure specific alerts for a new monitor, the catch-all alert will notify you.

## Alert Events and History

Every time an alert fires (or would fire but is in cooldown), Uptime records an event. The alert history shows:

- **Timestamp** — When the event occurred
- **Monitor** — Which monitor triggered the alert
- **Event type** — Down, up, degraded, or recovery
- **Channel** — Which notification channel was used
- **Status** — Whether the notification was sent successfully

Alert history helps you:

- Audit past incidents and response times
- Identify patterns in service failures
- Verify that notifications are being delivered
- Debug integration issues with webhooks or chat platforms

Events are retained according to your plan's data retention policy.

## Best Practices

### Use Cooldowns to Prevent Alert Fatigue

Nothing burns out an on-call engineer faster than constant notifications. If a service is flapping, a 15-minute cooldown means you'll know something is wrong without being bombarded every 60 seconds.

Start with a 15-minute cooldown for most alerts and adjust based on how critical the service is and how quickly you need to respond.

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
