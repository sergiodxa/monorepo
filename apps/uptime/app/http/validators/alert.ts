/**
 * Form validation schemas for alert create/update/delete actions. One form posts every
 * channel's fields at once (the alert create/edit pages render them together); `.refine()`
 * enforces that only the fields for the selected `strategy` are actually required,
 * mirroring the content-check schema's inline-validation pattern.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

import { deliverableAddress, isEmailAddress } from "~/app/http/validators/email-address";
import { isDiscordWebhookUrl, isSlackWebhookUrl } from "~/app/http/validators/webhook-url";
import { DEFAULT_COOLDOWN_MINUTES } from "~/app/lib/alert-policy";

/**
 * PagerDuty issues 32-character integration keys; the ceiling leaves room for other key
 * formats while still refusing a pasted paragraph.
 */
export const MAX_ROUTING_KEY_LENGTH = 255;

const ALERT_STRATEGIES = ["email", "webhook", "slack", "discord", "pagerduty"] as const;

const isUrl = checks.url().check;

/** Whether a trimmed integration key is present and short enough to be one PagerDuty issued. */
function isRoutingKey(value: string | undefined): boolean {
	return !!value && value.length <= MAX_ROUTING_KEY_LENGTH;
}

/** Field shape shared by the create and update alert forms. */
const alertFields = {
	name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	strategy: f.field(s.enum_(ALERT_STRATEGIES)),
	/**
	 * The `(monitor_type, monitor_id)` pair encoded as one control value (see
	 * `~/app/lib/monitor-scope`). Resolved in the action, the only place that can
	 * confirm the monitor still exists and belongs to the team.
	 */
	scope: f.field(s.defaulted(s.string(), "")),
	notify_on_recovery: f.field(s.defaulted(coerce.boolean(), false)),
	/**
	 * Minutes an outage stays quiet between notifications; 60 by default repeats
	 * hourly. The 0 minimum keeps stored values editable — `app/services/alerts.ts`
	 * enforces the real floor at dispatch.
	 */
	cooldown_minutes: f.field(
		s.defaulted(coerce.number().pipe(checks.min(0), checks.max(1440)), DEFAULT_COOLDOWN_MINUTES),
	),
	/** Stored in its deliverable form; the `strategy` rule below decides whether it is required. */
	email_to: f.field(s.optional(s.string().transform(deliverableAddress))),
	email_subject_prefix: f.field(s.optional(s.string())),
	webhook_url: f.field(s.optional(s.string())),
	webhook_secret: f.field(s.optional(s.string())),
	slack_webhook_url: f.field(s.optional(s.string())),
	discord_webhook_url: f.field(s.optional(s.string())),
	/** Trimmed, since a key pasted from PagerDuty's settings page often carries whitespace. */
	pagerduty_routing_key: f.field(s.optional(s.string().transform((value) => value.trim()))),
};

interface AlertFieldValues {
	strategy: (typeof ALERT_STRATEGIES)[number];
	email_to?: string;
	webhook_url?: string;
	slack_webhook_url?: string;
	discord_webhook_url?: string;
	pagerduty_routing_key?: string;
}

/** Validates the `create-alert` action form body. */
export const CreateAlertSchema = f
	.object(alertFields)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "email" || (!!value.email_to && isEmailAddress(value.email_to)),
		"A valid recipient email is required for the email channel.",
	)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "webhook" || (!!value.webhook_url && isUrl(value.webhook_url)),
		"A valid URL is required for the webhook channel.",
	)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "slack" ||
			(!!value.slack_webhook_url && isSlackWebhookUrl(value.slack_webhook_url)),
		"A valid Slack webhook URL is required.",
	)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "discord" ||
			(!!value.discord_webhook_url && isDiscordWebhookUrl(value.discord_webhook_url)),
		"A valid Discord webhook URL is required.",
	)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "pagerduty" || isRoutingKey(value.pagerduty_routing_key),
		"A PagerDuty integration key is required.",
	);

export type CreateAlertValues = s.InferOutput<typeof CreateAlertSchema>;

/** Validates the `update-alert` action form body. */
export const UpdateAlertSchema = f
	.object({ alert_id: f.field(s.string()), ...alertFields })
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "email" || (!!value.email_to && isEmailAddress(value.email_to)),
		"A valid recipient email is required for the email channel.",
	)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "webhook" || (!!value.webhook_url && isUrl(value.webhook_url)),
		"A valid URL is required for the webhook channel.",
	)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "slack" ||
			(!!value.slack_webhook_url && isSlackWebhookUrl(value.slack_webhook_url)),
		"A valid Slack webhook URL is required.",
	)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "discord" ||
			(!!value.discord_webhook_url && isDiscordWebhookUrl(value.discord_webhook_url)),
		"A valid Discord webhook URL is required.",
	)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "pagerduty" || isRoutingKey(value.pagerduty_routing_key),
		"A PagerDuty integration key is required.",
	);

export type UpdateAlertValues = s.InferOutput<typeof UpdateAlertSchema>;

/** Validates the `delete-alert` action form body. */
export const AlertIdSchema = f.object({ alert_id: f.field(s.string()) });
