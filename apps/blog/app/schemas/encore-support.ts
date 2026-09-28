/**
 * Validates a submission of the Encore support form. Every field is trimmed and bounded
 * here, so the email built from a request that passes carries readable, single-line
 * headers and a message no larger than an inbox should receive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { InferOutput } from "remix/data-schema";

import { parseEmailAddress } from "@sdxc/email-address";
import { isSuccess } from "@sdxc/result";
import { defaulted, string } from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

/** The topics a visitor picks from, in the order the form lists them. */
export const SUPPORT_TOPICS = ["Bug report", "Question", "Feature request", "Other"] as const;

/** The devices Encore ships on, plus a fallback for anything else. */
export const SUPPORT_PLATFORMS = ["iPhone", "iPad", "Apple Watch", "Mac", "Other"] as const;

/**
 * Character limits the form's `maxlength` attributes repeat, so a browser stops the visitor
 * at the same point the server would reject. The email bound is RFC 5321's path limit.
 */
export const SUPPORT_LIMITS = {
	name: 100,
	email: 254,
	version: 50,
	message: 5000,
} as const;

/** The shortest message worth sending: enough for one sentence describing the problem. */
export const SUPPORT_MESSAGE_MIN = 10;

/**
 * The address the reply goes to, in the form mail headers carry: NFKC-normalized with an ASCII
 * domain. Only its syntax is checked, since the reply itself proves the mailbox receives mail.
 *
 * @returns The parsed address, or `null` when it is no mailbox address at all.
 */
function replyAddress(value: string): string | null {
	let parsed = parseEmailAddress(value);
	return isSuccess(parsed) ? parsed.data.address : null;
}

/** Whether `value` holds a line break or another control character, out of place in a one-line field. */
function hasControlCharacter(value: string): boolean {
	return Array.from(value).some((character) => {
		let code = character.codePointAt(0) ?? 0;
		return code < 0x20 || code === 0x7f;
	});
}

/**
 * A one-line text field that may be left blank, trimmed and capped at `max` characters.
 *
 * @param label How the error message names the field.
 * @param max The longest value accepted.
 */
function optionalLine(label: string, max: number) {
	return f.field(
		defaulted(string(), "")
			.transform((value) => value.trim())
			.refine((value) => value.length <= max, `${label} must be ${max} characters or fewer.`)
			.refine((value) => !hasControlCharacter(value), `${label} must fit on one line.`),
	);
}

/**
 * One value out of a fixed list, with a message asking the visitor to choose. A missing value
 * becomes the empty string, so it fails the membership check and reports that message too.
 *
 * @param options The accepted values.
 * @param message What the field shows when nothing valid was chosen.
 */
function choice<const Option extends string>(options: ReadonlyArray<Option>, message: string) {
	let isOption = (value: string): value is Option =>
		(options as ReadonlyArray<string>).includes(value);

	return f.field(
		defaulted(string(), "")
			.refine(isOption, message)
			.transform((value) => (isOption(value) ? value : options[0]!)),
	);
}

/**
 * The support request as the form posts it. `website` is the honeypot: a field hidden from
 * people that a form-filling bot completes, which the controller checks before anything else.
 */
export const SupportRequestSchema = f.object({
	name: optionalLine("Name", SUPPORT_LIMITS.name),
	email: f.field(
		defaulted(string(), "")
			.transform((value) => value.trim())
			.refine((value) => value.length > 0, "Enter your email address so we can reply.")
			.refine(
				(value) => value.length <= SUPPORT_LIMITS.email,
				`Email must be ${SUPPORT_LIMITS.email} characters or fewer.`,
			)
			.refine(
				(value) => value.length === 0 || replyAddress(value) !== null,
				"Enter a valid email address, like name@example.com.",
			)
			.transform((value) => replyAddress(value) ?? value),
	),
	topic: choice(SUPPORT_TOPICS, "Choose a topic."),
	platform: choice(SUPPORT_PLATFORMS, "Choose the device you're using."),
	osVersion: optionalLine("OS version", SUPPORT_LIMITS.version),
	appVersion: optionalLine("App version", SUPPORT_LIMITS.version),
	message: f.field(
		defaulted(string(), "")
			.transform((value) => value.trim())
			.refine((value) => value.length > 0, "Enter a message describing how we can help.")
			.refine(
				(value) => value.length === 0 || value.length >= SUPPORT_MESSAGE_MIN,
				`Your message must be at least ${SUPPORT_MESSAGE_MIN} characters.`,
			)
			.refine(
				(value) => value.length <= SUPPORT_LIMITS.message,
				`Your message must be ${SUPPORT_LIMITS.message} characters or fewer.`,
			),
	),
});

/** A validated support request, ready to be mailed. */
export type SupportRequest = InferOutput<typeof SupportRequestSchema>;
