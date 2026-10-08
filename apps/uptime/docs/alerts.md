# Alerts

## Purpose

Alerts notify users when monitors detect problems and, when enabled, when the monitored service recovers.

## Supported Channels

- Email
- Generic webhook
- Slack webhook
- Discord webhook
- PagerDuty (Events API v2)

## What Users Configure

- Alert name
- Delivery channel
- Channel-specific settings
- Optional monitor-specific targeting
- Whether recovery notifications are enabled
- Cooldown duration in minutes

Channel-specific settings:

- Email: recipient address, on a domain that receives email, and optional subject prefix
- Webhook: destination URL and optional secret
- Slack: incoming webhook URL on `hooks.slack.com`; the message posts to the channel the webhook was created for
- Discord: webhook URL on `discord.com/api/webhooks/`
- PagerDuty: Events API v2 integration (routing) key

Slack and Discord URLs are checked against the platform's own host when the alert is saved, so a mistyped URL is refused before any alert is sent.

## How It Works

1. Users create one or more alerts for a team.
2. Alerts may apply to the whole team or to a specific monitor.
3. When monitor state changes into a problem state, the relevant alerts fire.
4. If recovery notifications are enabled, alerts also fire when the service returns to a healthy state.
5. Email is sent immediately. Slack, Discord, PagerDuty and webhook alerts are recorded as `pending` and delivered by a background job, which retries a rate-limited or unavailable destination with backoff, up to four attempts, before recording the alert as failed.
6. Every delivery is recorded in alert history.

## Delivery Details

- Slack, Discord and PagerDuty receive a rich message: a title naming the monitor and its state, the check's details, a severity color, the monitor type, and an "Open dashboard" link.
- A recovery closes the loop: PagerDuty resolves the incident it opened (both share the dedup key `<monitor type>:<monitor id>`), and a platform that can edit a sent message updates the original alert in place; elsewhere the recovery is sent as its own message.
- Webhooks keep their JSON body (`monitorId`, `monitorType`, `monitorName`, `eventType`, `snapshot`, `message`, `timestamp`) and, when a secret is set, the `Webhook-Signature: sha256=<hex HMAC-SHA256 of the body>` header. Webhook URLs must resolve to a public host.
- When a destination answers that it no longer exists (a deleted Slack channel or Discord webhook, a `410` from a webhook), the alert is marked broken and the alert list shows the reason. Saving the alert's channel again clears the mark.

## Event Types

- `down`
- `up` for recovery
- `degraded`

## Alert History

Each alert event records:

- Which alert was used
- Which monitor triggered it
- The event type
- Whether delivery is pending, succeeded, failed, or was skipped
- When it happened
- Any delivery error message

## Cooldown Behavior

- Cooldowns prevent repeated notifications for the same issue within a configured time window.
- A cooldown of `0` means no cooldown.
- Cooldowns are intended to reduce alert fatigue during prolonged incidents.

## Recovery Behavior

- Recovery notifications are enabled by default.
- Recovery should be treated as a separate event, not as a silent state reset.
- Recovery messages are especially important for HTTP and TCP monitoring.

## Interaction With Monitor Types

- HTTP monitors mainly alert on outages and recoveries.
- DNS monitors distinguish between changed records and outright failures.
- Cron job monitors distinguish between late and missed runs.
- SSL monitoring alerts on expiring and expired certificates.

## Defaults and Limits

- Recovery notifications default to enabled.
- Cooldown defaults to `0` minutes.
- Cooldown should support at least `0` through `1440` minutes.
- The product uses a team-level limit of `10` alerts.

## Important Behavior Notes

- Alerting is event-driven. Repeated identical failures should not necessarily create repeated notifications.
- Delivery history is part of the feature, not just an internal log.
- A reimplementation should define clearly when degraded states notify and when only hard failures notify.

## Reimplementation Guidance

Preserve these product rules:

- Alerts need team scope, optional monitor scope, recovery support, cooldowns, and event history.
- Delivery channels should be interchangeable from the user perspective.
- Alert history should explain both sent and suppressed outcomes.
