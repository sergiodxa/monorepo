/**
 * Field schemas the site's contact forms share: one-line text, a choice from a fixed list,
 * and the reply address. Each trims and bounds its value, so a request that validates
 * carries readable, single-line mail headers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseEmailAddress } from "@sdxc/email-address";
import { isSuccess } from "@sdxc/result";
import { defaulted, string } from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

/**
 * The address the reply goes to, in the form mail headers carry: NFKC-normalized with an ASCII
 * domain. Only its syntax is checked, since the reply itself proves the mailbox receives mail.
 *
 * @returns The parsed address, or `null` when it is no mailbox address at all.
 */
export function replyAddress(value: string): string | null {
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
export function optionalLine(label: string, max: number) {
	return f.field(
		defaulted(string(), "")
			.transform((value) => value.trim())
			.refine((value) => value.length <= max, `${label} must be ${max} characters or fewer.`)
			.refine((value) => !hasControlCharacter(value), `${label} must fit on one line.`),
	);
}

/**
 * A one-line text field that must be filled in, trimmed and capped at `max` characters.
 *
 * @param label How the error message names the field.
 * @param max The longest value accepted.
 */
export function requiredLine(label: string, max: number) {
	return f.field(
		defaulted(string(), "")
			.transform((value) => value.trim())
			.refine((value) => value.length > 0, `${label} is required.`)
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
export function choice<const Option extends string>(
	options: ReadonlyArray<Option>,
	message: string,
) {
	let isOption = (value: string): value is Option =>
		(options as ReadonlyArray<string>).includes(value);

	return f.field(
		defaulted(string(), "")
			.refine(isOption, message)
			.transform((value) => (isOption(value) ? value : options[0]!)),
	);
}
