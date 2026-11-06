/**
 * Validates a submission of the Wakaba support form. Every field is trimmed and bounded
 * here, so the email built from a request that passes carries readable, single-line
 * headers and a message no larger than an inbox should receive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { InferOutput } from "remix/data-schema";

import { defaulted, string } from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import { choice, optionalLine, replyAddress } from "~/app/http/validators/fields";

/** The topics a visitor picks from, in the order the form lists them. */
export const WAKABA_SUPPORT_TOPICS = [
	"Bug report",
	"Question",
	"Feature request",
	"Vocabulary correction",
	"Other",
] as const;

/** The devices Wakaba ships on, plus a fallback for anything else. */
export const WAKABA_SUPPORT_PLATFORMS = ["iPhone", "iPad", "Other"] as const;

/**
 * Character limits the form's `maxlength` attributes repeat, so a browser stops the visitor
 * at the same point the server would reject. The email bound is RFC 5321's path limit.
 */
export const WAKABA_SUPPORT_LIMITS = {
	name: 100,
	email: 254,
	version: 50,
	message: 5000,
} as const;

/** The shortest message worth sending: enough for one sentence describing the problem. */
export const WAKABA_SUPPORT_MESSAGE_MIN = 10;

/**
 * The support request as the form posts it. The honeypot fields post alongside it and are
 * verified before this schema runs, so they never reach a validated request.
 */
export const WakabaSupportRequestSchema = f.object({
	name: optionalLine("Name", WAKABA_SUPPORT_LIMITS.name),
	email: f.field(
		defaulted(string(), "")
			.transform((value) => value.trim())
			.refine((value) => value.length > 0, "Enter your email address so I can reply.")
			.refine(
				(value) => value.length <= WAKABA_SUPPORT_LIMITS.email,
				`Email must be ${WAKABA_SUPPORT_LIMITS.email} characters or fewer.`,
			)
			.refine(
				(value) => value.length === 0 || replyAddress(value) !== null,
				"Enter a valid email address, like name@example.com.",
			)
			.transform((value) => replyAddress(value) ?? value),
	),
	topic: choice(WAKABA_SUPPORT_TOPICS, "Choose a topic."),
	platform: choice(WAKABA_SUPPORT_PLATFORMS, "Choose the device you're using."),
	osVersion: optionalLine("OS version", WAKABA_SUPPORT_LIMITS.version),
	appVersion: optionalLine("App version", WAKABA_SUPPORT_LIMITS.version),
	message: f.field(
		defaulted(string(), "")
			.transform((value) => value.trim())
			.refine((value) => value.length > 0, "Enter a message describing how I can help.")
			.refine(
				(value) => value.length === 0 || value.length >= WAKABA_SUPPORT_MESSAGE_MIN,
				`Your message must be at least ${WAKABA_SUPPORT_MESSAGE_MIN} characters.`,
			)
			.refine(
				(value) => value.length <= WAKABA_SUPPORT_LIMITS.message,
				`Your message must be ${WAKABA_SUPPORT_LIMITS.message} characters or fewer.`,
			),
	),
});

/** A validated Wakaba support request, ready to be mailed. */
export type WakabaSupportRequest = InferOutput<typeof WakabaSupportRequestSchema>;
