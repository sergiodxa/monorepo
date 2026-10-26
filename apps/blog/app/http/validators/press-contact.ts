/**
 * Validates a submission of the press kit's contact form, where organizers invite the author
 * to an event or show. Every field is trimmed and bounded, so the email it becomes carries
 * readable headers and a message no larger than an inbox should receive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { InferOutput } from "remix/data-schema";

import { defaulted, string } from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import { choice, optionalLine, replyAddress, requiredLine } from "~/app/http/validators/fields";

/** What an organizer can be inviting the author to, in the order the form lists them. */
export const PRESS_KINDS = ["conference", "meetup", "podcast", "workshop", "other"] as const;

/** Character limits the form's `maxlength` attributes repeat. */
export const PRESS_LIMITS = { name: 100, email: 254, event: 150, message: 5000 } as const;

/** The shortest message worth sending: one sentence about the invitation. */
export const PRESS_MESSAGE_MIN = 10;

/**
 * The invitation as the form posts it. The honeypot fields post alongside it and are verified
 * before this schema runs. The page shows its own message per field in the reader's language,
 * so these messages reach only the logs.
 */
export const PressContactSchema = f.object({
	name: requiredLine("Name", PRESS_LIMITS.name),
	email: f.field(
		defaulted(string(), "")
			.transform((value) => value.trim())
			.refine((value) => value.length <= PRESS_LIMITS.email, "Email is too long.")
			.refine((value) => replyAddress(value) !== null, "Email is not a valid address.")
			.transform((value) => replyAddress(value) ?? value),
	),
	kind: choice(PRESS_KINDS, "Kind is required."),
	event: optionalLine("Event", PRESS_LIMITS.event),
	message: f.field(
		defaulted(string(), "")
			.transform((value) => value.trim())
			.refine((value) => value.length >= PRESS_MESSAGE_MIN, "Message is too short.")
			.refine((value) => value.length <= PRESS_LIMITS.message, "Message is too long."),
	),
});

/** A validated invitation, ready to be mailed. */
export type PressContact = InferOutput<typeof PressContactSchema>;
