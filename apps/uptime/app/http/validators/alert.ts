/**
 * Form validation schemas for alert create/update/delete actions. One form posts all
 * four channels' fields at once (the alert create/edit pages render them together); `.refine()`
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

import { DEFAULT_COOLDOWN_MINUTES } from "~/app/lib/alert-policy";

const ALERT_STRATEGIES = ["email", "webhook", "slack", "discord"] as const;

const isEmail = checks.email().check;
const isUrl = checks.url().check;

/** Field shape shared by the create and update alert forms. */
const alertFields = {
	name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	strategy: f.field(s.enum_(ALERT_STRATEGIES)),
	monitor_id: f.field(s.optional(s.string())),
	notify_on_recovery: f.field(s.defaulted(coerce.boolean(), false)),
	/**
	 * Minutes an ongoing outage stays quiet between notifications; 60 by default, so an
	 * alert nobody configures repeats once an hour for as long as the outage lasts.
	 *
	 * The minimum stays 0 rather than being raised to the dispatch-time floor: the edit form
	 * is populated from the stored row, so a validator that rejected the values already in
	 * the database would make those alerts unsaveable. What a value below the floor buys is
	 * "as often as allowed", and the floor in `app/services/alerts.ts` is what decides that.
	 */
	cooldown_minutes: f.field(
		s.defaulted(coerce.number().pipe(checks.min(0), checks.max(1440)), DEFAULT_COOLDOWN_MINUTES),
	),
	email_to: f.field(s.optional(s.string())),
	email_subject_prefix: f.field(s.optional(s.string())),
	webhook_url: f.field(s.optional(s.string())),
	webhook_secret: f.field(s.optional(s.string())),
	slack_webhook_url: f.field(s.optional(s.string())),
	slack_channel: f.field(s.optional(s.string())),
	discord_webhook_url: f.field(s.optional(s.string())),
};

interface AlertFieldValues {
	strategy: (typeof ALERT_STRATEGIES)[number];
	email_to?: string;
	webhook_url?: string;
	slack_webhook_url?: string;
	discord_webhook_url?: string;
}

/** Validates the `create-alert` action form body. */
export const CreateAlertSchema = f
	.object(alertFields)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "email" || (!!value.email_to && isEmail(value.email_to)),
		"A valid recipient email is required for the email channel.",
	)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "webhook" || (!!value.webhook_url && isUrl(value.webhook_url)),
		"A valid URL is required for the webhook channel.",
	)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "slack" || (!!value.slack_webhook_url && isUrl(value.slack_webhook_url)),
		"A valid Slack webhook URL is required.",
	)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "discord" ||
			(!!value.discord_webhook_url && isUrl(value.discord_webhook_url)),
		"A valid Discord webhook URL is required.",
	);

export type CreateAlertValues = s.InferOutput<typeof CreateAlertSchema>;

/** Validates the `update-alert` action form body. */
export const UpdateAlertSchema = f
	.object({ alert_id: f.field(s.string()), ...alertFields })
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "email" || (!!value.email_to && isEmail(value.email_to)),
		"A valid recipient email is required for the email channel.",
	)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "webhook" || (!!value.webhook_url && isUrl(value.webhook_url)),
		"A valid URL is required for the webhook channel.",
	)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "slack" || (!!value.slack_webhook_url && isUrl(value.slack_webhook_url)),
		"A valid Slack webhook URL is required.",
	)
	.refine(
		(value: AlertFieldValues) =>
			value.strategy !== "discord" ||
			(!!value.discord_webhook_url && isUrl(value.discord_webhook_url)),
		"A valid Discord webhook URL is required.",
	);

export type UpdateAlertValues = s.InferOutput<typeof UpdateAlertSchema>;

/** Validates the `delete-alert` action form body. */
export const AlertIdSchema = f.object({ alert_id: f.field(s.string()) });
