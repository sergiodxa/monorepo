/**
 * Maps an alert's stored channel to the `@sdxc/messaging` destination that delivers to
 * it. Building one does no I/O, so the delivery job builds one per run from the row it
 * just read, and the credential never leaves the database for the queue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Destination } from "@sdxc/messaging";

import { DiscordWebhook } from "@sdxc/messaging/discord";
import { PagerDuty } from "@sdxc/messaging/pagerduty";
import { SlackWebhook } from "@sdxc/messaging/slack";

import type { MessagingAlertConfig } from "~/database/schema";

import { APP_ORIGIN } from "~/app/lib/origin";
import { UptimeWebhook } from "~/app/services/uptime-webhook";

/**
 * Turns a channel into its destination. The delivery job reads one from its context, so a
 * test installs a factory answering a `MemoryDestination` instead.
 */
export interface DestinationFactory {
	(config: MessagingAlertConfig): Destination;
}

/**
 * The production factory. A Slack row saved with a `channel` override posts to the
 * webhook's own channel, which is where Slack app webhooks always post.
 *
 * @param config - The alert's stored channel.
 * @returns The destination for it.
 */
export function destinationFor(config: MessagingAlertConfig): Destination {
	switch (config.strategy) {
		case "slack":
			return new SlackWebhook({ url: config.config.webhookUrl });
		case "discord":
			return new DiscordWebhook({ url: config.config.webhookUrl });
		case "pagerduty":
			return new PagerDuty({
				routingKey: config.config.routingKey,
				source: new URL(APP_ORIGIN).host,
			});
		case "webhook":
			return new UptimeWebhook({ url: config.config.url, secret: config.config.secret });
	}
}
