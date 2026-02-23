---
title: What Happens When Your Notification Channel Is Down
excerpt: If your alerting depends on a single channel, you have a single point of failure.
---

It's 3 AM. Your production database is failing over. Your monitoring system detects the issue and sends an alert to Slack. But Slack is also having an outage. The alert never arrives. Your on-call engineer sleeps through a major incident.

This scenario isn't hypothetical. Every notification channel has downtime. Slack, PagerDuty, email providers, SMS gateways: they all experience outages. If your alerting system depends on any single channel, you've introduced a single point of failure into your incident response.

## The Irony of Monitoring Dependencies

There's a certain irony in building sophisticated monitoring systems that depend on third-party services for delivery. You've instrumented your application, set up health checks, configured alert thresholds, and created runbooks. But all of that work is worthless if the alert never reaches a human.

Your monitoring system is only as reliable as its least reliable notification channel. If you send alerts exclusively through Slack, your effective monitoring uptime is bounded by Slack's uptime. If Slack is down 0.1% of the time, your monitoring is effectively down 0.1% of the time.

And Murphy's Law suggests that correlated failures are more common than you'd expect. Major internet outages often affect multiple services simultaneously. The same network issues that take down your application might also affect your notification provider.

## Email as the Reliable Backup

Email is the cockroach of notification channels: it survives everything. While modern chat platforms have complex real-time infrastructure that can fail in interesting ways, email is built on decades-old protocols designed for unreliable networks.

Email's advantages as a backup channel:

**Store and forward**: If your mail server can't reach the recipient immediately, it queues the message and retries. Messages don't disappear into the void.

**Multiple providers**: You can configure backup MX records. If your primary email provider is down, messages route to a secondary.

**Offline access**: Engineers can access email on their phones even with degraded connectivity. Many email clients cache messages locally.

**Universal availability**: Every engineer has email. Not everyone has every chat platform installed.

The tradeoff is latency. Email isn't real-time. But for critical alerts, a 30-second delay is acceptable if the alternative is no delivery at all.

## Webhook Fan-Out for Flexibility

Webhooks provide the most flexible approach to redundant notifications. Instead of your monitoring system knowing about every notification channel, it sends webhooks to a distribution service that handles fan-out.

This architecture enables:

**Easy channel addition**: Adding a new notification channel is a configuration change in your distribution service, not a change to every monitor.

**Channel-specific formatting**: The distribution service can transform the generic webhook payload into channel-specific formats. Slack gets rich formatting, email gets plain text, PagerDuty gets structured incident data.

**Retry logic**: The distribution service can implement sophisticated retry logic per channel, handling transient failures without losing alerts. For robust retry handling, consider [building a job framework](/tutorials/build-a-job-framework-for-cloudflare-queues) that handles [error classification](/articles/error-classification-in-background-job-systems) to distinguish retryable failures from permanent ones.

**Delivery tracking**: Centralized fan-out makes it easy to track which channels successfully received each alert.

A simple implementation might look like:

```ts
interface AlertPayload {
	severity: "critical" | "warning" | "info";
	title: string;
	message: string;
	timestamp: Date;
	metadata: Record<string, unknown>;
}

async function fanOutAlert(alert: AlertPayload): Promise<void> {
	const channels = getChannelsForSeverity(alert.severity);

	const deliveryPromises = channels.map(async (channel) => {
		try {
			await deliverToChannel(channel, alert);
			await recordDeliverySuccess(channel, alert);
		} catch (error) {
			await recordDeliveryFailure(channel, alert, error);
			await scheduleRetry(channel, alert);
		}
	});

	await Promise.allSettled(deliveryPromises);
}
```

## Your Monitoring System Needs Monitoring

Here's the uncomfortable truth: your monitoring system is itself a system that can fail. And if it fails silently, you won't know until you miss an alert.

This creates a meta-problem: how do you monitor your monitoring?

**Heartbeat checks**: Your monitoring system should send regular "I'm alive" signals to an external service. If the heartbeat stops, the external service alerts through independent channels. This is the [dead man's switch pattern](/articles/the-dead-man-s-switch-pattern) applied to your monitoring infrastructure itself.

**Synthetic alerts**: Periodically trigger test alerts that must be acknowledged. If a test alert isn't acknowledged within the expected timeframe, escalate through backup channels.

**Cross-monitoring**: If you have multiple monitoring systems (application monitoring, infrastructure monitoring, synthetic monitoring), have them monitor each other.

**External monitoring services**: Services like Pingdom or UptimeRobot can monitor your monitoring infrastructure from outside your network.

The goal is ensuring that no single failure can prevent alerts from reaching humans.

## Designing for Degraded Operation

Your notification system should degrade gracefully when channels fail. This means:

**No blocking on failed channels**: If Slack is down, don't let that prevent email delivery. Send to all channels in parallel and handle failures independently.

**Automatic failover**: If the primary channel fails, automatically escalate to backup channels without manual intervention.

**Clear failure indication**: When a channel fails, log it clearly so you can investigate later. But don't let the logging failure prevent the alert from going out through other channels.

**Regular testing**: Periodically test each channel to verify it's working. Don't wait for a real incident to discover that your PagerDuty integration broke three weeks ago.

## Channel Selection by Severity

Not every alert needs every channel. A reasonable strategy:

**Critical alerts**: All channels simultaneously. Slack, email, PagerDuty, SMS. Redundancy is more important than avoiding duplicate notifications.

**Warning alerts**: Primary channel plus one backup. Slack and email, for example.

**Informational alerts**: Primary channel only. If Slack is down, these can wait.

This approach balances redundancy against notification fatigue. Critical alerts justify the noise of multiple channels. Informational alerts don't.

## The Cost of Redundancy

Redundant notification channels have costs:

**Duplicate notifications**: Engineers might receive the same alert through multiple channels. This can be annoying but is generally preferable to missing alerts. If duplicate fatigue becomes a problem, revisit your [alert design](/articles/designing-alerts-that-do-not-cause-fatigue) to ensure you're only sending critical alerts through multiple channels.

**Configuration complexity**: More channels mean more configuration to maintain, more integrations to keep working, more credentials to manage.

**Cost**: Some notification channels charge per message. Sending every alert through five channels multiplies your costs.

These costs are real but manageable. The cost of missing a critical alert during a major incident is almost always higher than the cost of maintaining redundant channels.

## Practical Implementation

Start with the basics:

1. **Audit your current channels**: List every notification channel you use. Identify single points of failure.

2. **Add email as a backup**: If you're not already sending critical alerts to email, start. It's the easiest redundancy to add.

3. **Implement delivery tracking**: Know when notifications fail to deliver. You can't fix what you can't see.

4. **Test your backup channels**: Don't assume they work. Trigger test alerts through each channel regularly.

5. **Document your notification architecture**: Make sure your team knows what channels exist and how they're configured.

The goal isn't perfect redundancy: it's eliminating obvious single points of failure. If your monitoring system can survive the failure of any single notification channel, you've dramatically improved your incident response reliability.
