# Alerts

## Purpose

Alerts notify users when monitors detect problems and, when enabled, when the monitored service recovers.

## Supported Channels

- Email
- Generic webhook
- Slack webhook
- Discord webhook

## What Users Configure

- Alert name
- Delivery channel
- Channel-specific settings
- Optional monitor-specific targeting
- Whether recovery notifications are enabled
- Cooldown duration in minutes

Channel-specific settings:

- Email: recipient address and optional subject prefix
- Webhook: destination URL and optional secret
- Slack: webhook URL and optional channel override
- Discord: webhook URL

## How It Works

1. Users create one or more alerts for a team.
2. Alerts may apply to the whole team or to a specific monitor.
3. When monitor state changes into a problem state, the relevant alerts fire.
4. If recovery notifications are enabled, alerts also fire when the service returns to a healthy state.
5. Alert delivery attempts are recorded in alert history.

## Event Types

- `down`
- `up` for recovery
- `degraded`

## Alert History

Each alert event records:

- Which alert was used
- Which monitor triggered it
- The event type
- Whether delivery succeeded, failed, or was skipped
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
