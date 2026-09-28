/**
 * The email-address rule every form and API body that accepts an address validates with:
 * exactly what `parseEmailAddress()` accepts, documented as `format: "email"`, and the
 * normalized form it yields, so every channel stores and sends to the same spelling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Check } from "@sdxc/json-schema";

import { parseEmailAddress } from "@sdxc/email-address";
import { isSuccess } from "@sdxc/result";

/**
 * Accepts an address the parser accepts: a dot-atom local part and a hostname of at least
 * two labels, so IP literals, single-label domains and control characters are refused.
 *
 * @returns A check for `schema.pipe(...)`, carrying `string.email` as its code.
 * @example s.string().pipe(emailAddress()).transform(deliverableAddress);
 */
export function emailAddress(): Check<string> {
	return {
		check: (value) => isSuccess(parseEmailAddress(value)),
		code: "string.email",
		message: "Expected valid email",
		keywords: { format: "email" },
	};
}

/**
 * Whether `value` is an address {@link emailAddress} accepts, for a rule that reads one
 * field conditionally on another.
 *
 * @param value - The submitted text.
 * @returns Whether the parser accepts it.
 */
export function isEmailAddress(value: string): boolean {
	return isSuccess(parseEmailAddress(value));
}

/**
 * The form of an accepted address to store and send to: trimmed, NFKC-normalized, with its
 * domain lowercased and in ASCII, and the local part's case kept, since a mail host may
 * treat it as significant. Text the parser refuses comes back unchanged.
 *
 * @param value - Text {@link emailAddress} already accepted.
 * @returns The deliverable address.
 */
export function deliverableAddress(value: string): string {
	let parsed = parseEmailAddress(value);
	return isSuccess(parsed) ? parsed.data.address : value;
}
