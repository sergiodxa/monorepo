/**
 * The one call that applies a whole password policy: the local rules in a fixed order,
 * cheapest first, then the breached-password lookup when the caller enabled it. The
 * first rule to refuse the candidate decides the result.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, success } from "@sdxc/result";

import type { BreachedPasswordOptions } from "./breached.js";
import type { LengthOptions } from "./length.js";
import type { PasswordPolicyError } from "./password-policy-error.js";

import { checkBreachedPassword } from "./breached.js";
import { checkCommonPassword } from "./common.js";
import { checkDeniedTerms, checkIdentifiers } from "./context.js";
import { checkLength } from "./length.js";

/** The policy {@link checkPassword} applies. */
export interface CheckPasswordOptions extends LengthOptions {
	/**
	 * Whether to refuse a password on the bundled common list.
	 * @default true
	 */
	common?: boolean;
	/** The account's identifiers (emails, usernames) a password may not be built from. */
	identifiers?: string[];
	/** Terms a password may not contain, such as the service's own name. */
	deniedTerms?: string[];
	/**
	 * Enables the Pwned Passwords lookup, sending five hex characters of the password's
	 * SHA-1 to a third party; `true` uses the default options.
	 * @default false
	 */
	breached?: boolean | BreachedPasswordOptions;
}

/**
 * Applies length, then the common list, then identifiers, then denied terms, then the
 * breached lookup. A `breach-check-unavailable` failure therefore always means every
 * local rule accepted the candidate, so treating it as success fails open safely.
 *
 * @returns Success, or the first rule that refused the candidate.
 * @example await checkPassword(candidate, { identifiers: [email], deniedTerms: ["acme"] });
 */
export async function checkPassword(
	candidate: string,
	options: CheckPasswordOptions = {},
): Promise<Result<void, PasswordPolicyError>> {
	let length = checkLength(candidate, options);
	if (isFailure(length)) return length;

	if (options.common ?? true) {
		let common = checkCommonPassword(candidate);
		if (isFailure(common)) return common;
	}

	let identifiers = checkIdentifiers(candidate, options.identifiers ?? []);
	if (isFailure(identifiers)) return identifiers;

	let deniedTerms = checkDeniedTerms(candidate, options.deniedTerms ?? []);
	if (isFailure(deniedTerms)) return deniedTerms;

	if (options.breached) {
		return checkBreachedPassword(candidate, options.breached === true ? {} : options.breached);
	}

	return success(undefined);
}
