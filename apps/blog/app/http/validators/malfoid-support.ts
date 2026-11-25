/**
 * Validates a submission of the Malfoid Stickers support form. Every field is trimmed and
 * bounded here, so the email built from a request that passes carries readable, single-line
 * headers and a message no larger than an inbox should receive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { InferOutput } from "remix/data-schema";

import { defaulted, string } from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import { choice, replyAddress } from "~/app/http/validators/fields";

/** The topics a visitor picks from, in the order the form lists them. */
export const MALFOID_SUPPORT_TOPICS = [
	"Stickers not showing",
	"Bug report",
	"Question",
	"Sticker idea",
	"Other",
] as const;

/** The devices the sticker pack runs on, plus a fallback for anything else. */
export const MALFOID_SUPPORT_PLATFORMS = ["iPhone", "iPad", "Other"] as const;

/**
 * Character limits the form's `maxlength` attributes repeat, so a browser stops the visitor
 * at the same point the server would reject. The email bound is RFC 5321's path limit.
 */
export const MALFOID_SUPPORT_LIMITS = {
	name: 100,
	email: 254,
	version: 50,
	message: 5000,
} as const;

/** The shortest message worth sending: enough for one sentence describing the problem. */
export const MALFOID_SUPPORT_MESSAGE_MIN = 10;

/** Whether `value` holds a line break or another control character, out of place in a one-line field. */
function hasControlCharacter(value: string): boolean {
	return Array.from(value).some((character) => {
		let code = character.codePointAt(0) ?? 0;
		return code < 0x20 || code === 0x7f;
	});
}

/** A one-line field that may be left blank, trimmed and capped at `max` characters. */
function line(max: number, label: string) {
	return f.field(
		defaulted(string(), "")
			.transform((value) => value.trim())
			.refine((value) => value.length <= max, `${label} must be ${max} characters or fewer.`)
			.refine((value) => !hasControlCharacter(value), "This field must fit on one line."),
	);
}

/**
 * The support request as the form posts it. The honeypot fields post alongside it and are
 * verified before this schema runs, so they never reach a validated request.
 */
export const MalfoidSupportRequestSchema = f.object({
	name: line(MALFOID_SUPPORT_LIMITS.name, "Name"),
	email: f.field(
		defaulted(string(), "")
			.transform((value) => value.trim())
			.refine((value) => value.length > 0, "Enter your email address so I can reply.")
			.refine(
				(value) => value.length <= MALFOID_SUPPORT_LIMITS.email,
				`Email must be ${MALFOID_SUPPORT_LIMITS.email} characters or fewer.`,
			)
			.refine(
				(value) => value.length === 0 || replyAddress(value) !== null,
				"Enter a valid email address, like name@example.com.",
			)
			.transform((value) => replyAddress(value) ?? value),
	),
	topic: choice(MALFOID_SUPPORT_TOPICS, "Choose a topic."),
	platform: choice(MALFOID_SUPPORT_PLATFORMS, "Choose the device you're using."),
	osVersion: line(MALFOID_SUPPORT_LIMITS.version, "OS version"),
	appVersion: line(MALFOID_SUPPORT_LIMITS.version, "App version"),
	message: f.field(
		defaulted(string(), "")
			.transform((value) => value.trim())
			.refine((value) => value.length > 0, "Enter a message describing how I can help.")
			.refine(
				(value) => value.length === 0 || value.length >= MALFOID_SUPPORT_MESSAGE_MIN,
				`Your message must be at least ${MALFOID_SUPPORT_MESSAGE_MIN} characters.`,
			)
			.refine(
				(value) => value.length <= MALFOID_SUPPORT_LIMITS.message,
				`Your message must be ${MALFOID_SUPPORT_LIMITS.message} characters or fewer.`,
			),
	),
});

/** A validated Malfoid Stickers support request, ready to be mailed. */
export type MalfoidSupportRequest = InferOutput<typeof MalfoidSupportRequestSchema>;
