/**
 * The fields the support form submits, validated before anything trusts them. Every
 * refusal is a key under `support.errors`, so the form says it in the reader's language.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseEmailAddress } from "@sdxc/email-address";
import { isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

/** What a message is about, in the order the form offers them. */
export const SUPPORT_TOPICS = ["question", "problem", "billing", "idea", "other"] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

/** The longest each field may be; past these a submission is refused, not truncated. */
export const SUPPORT_LIMITS = { name: 100, email: 254, message: 5000, page: 64 } as const;

/** The shortest message worth a reply. */
export const SUPPORT_MESSAGE_MIN = 10;

/** A field's trimmed text, with an absent field read as empty. */
function text() {
	return s.defaulted(s.string(), "").transform((value) => value.trim());
}

/** The address a reply goes to, normalised, or `null` when it is not one. */
function replyAddress(value: string): string | null {
	let parsed = parseEmailAddress(value);
	return isSuccess(parsed) ? parsed.data.address : null;
}

/** The support fields, as an action receives them. */
export const SupportSchema = f.object({
	name: f.field(
		text().refine((value) => value.length <= SUPPORT_LIMITS.name, "support.errors.nameLength"),
	),
	email: f.field(
		text()
			.refine((value) => value.length > 0, "support.errors.emailMissing")
			.refine(
				(value) => value.length <= SUPPORT_LIMITS.email && replyAddress(value) !== null,
				"support.errors.emailInvalid",
			)
			.transform((value) => replyAddress(value) ?? value),
	),
	topic: f.field(
		text().refine(
			(value): value is SupportTopic => SUPPORT_TOPICS.some((topic) => topic === value),
			"support.errors.topic",
		),
	),
	page: f.field(text().transform((value) => value.slice(0, SUPPORT_LIMITS.page))),
	message: f.field(
		text()
			.refine((value) => value.length >= SUPPORT_MESSAGE_MIN, "support.errors.messageShort")
			.refine((value) => value.length <= SUPPORT_LIMITS.message, "support.errors.messageLong"),
	),
});

/** A validated support submission. */
export type SupportInput = s.InferOutput<typeof SupportSchema>;
