/**
 * The Slack and Discord webhook URL rules every form and API body that accepts one validates
 * with: exactly what the messaging providers accept at send time, so a URL that could never
 * deliver is refused when it is saved instead of failing on the first outage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Check } from "@sdxc/json-schema";

import { DiscordWebhook } from "@sdxc/messaging/discord";
import { SlackWebhook } from "@sdxc/messaging/slack";
import { isSuccess } from "@sdxc/result";

/**
 * Whether `value` is a Slack incoming webhook URL, on `https://hooks.slack.com/`.
 *
 * @param value - The pasted URL.
 */
export function isSlackWebhookUrl(value: string): boolean {
	return isSuccess(SlackWebhook.check(value));
}

/**
 * Whether `value` is a Discord webhook URL, under `https://discord.com/api/webhooks/` or
 * its legacy `discordapp.com` host.
 *
 * @param value - The pasted URL.
 */
export function isDiscordWebhookUrl(value: string): boolean {
	return isSuccess(DiscordWebhook.check(value));
}

/**
 * Accepts a URL {@link isSlackWebhookUrl} accepts, documented as `format: "uri"`.
 *
 * @returns A check for `schema.pipe(...)`, carrying `string.url` as its code.
 * @example s.string().pipe(slackWebhookUrl());
 */
export function slackWebhookUrl(): Check<string> {
	return {
		check: isSlackWebhookUrl,
		code: "string.url",
		message: "Expected a Slack incoming webhook URL on https://hooks.slack.com/",
		keywords: { format: "uri" },
	};
}

/**
 * Accepts a URL {@link isDiscordWebhookUrl} accepts, documented as `format: "uri"`.
 *
 * @returns A check for `schema.pipe(...)`, carrying `string.url` as its code.
 * @example s.string().pipe(discordWebhookUrl());
 */
export function discordWebhookUrl(): Check<string> {
	return {
		check: isDiscordWebhookUrl,
		code: "string.url",
		message: "Expected a Discord webhook URL on https://discord.com/api/webhooks/",
		keywords: { format: "uri" },
	};
}
