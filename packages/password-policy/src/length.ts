/**
 * The length rule, the one composition-free size bound NIST SP 800-63B allows: a
 * minimum and a maximum counted in code points of the NFKC form, so what a person
 * typed is measured the same whichever encoding their keyboard produced.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { countCodePoints, normalizePassword } from "./normalize.js";
import { PasswordPolicyError } from "./password-policy-error.js";

/**
 * NIST SP 800-63B-4's minimum for a password that is the only authenticator. A password
 * used only alongside a second factor may go as low as 8, and never below.
 */
export const DEFAULT_MIN_LENGTH = 15;

/**
 * Longest password accepted, so one submission cannot turn a password hash into an
 * arbitrarily long derivation; four times the 64 NIST asks a verifier to permit.
 */
export const DEFAULT_MAX_LENGTH = 256;

/** The bounds {@link checkLength} enforces, each in code points after NFKC. */
export interface LengthOptions {
	/** @default DEFAULT_MIN_LENGTH */
	minLength?: number;
	/** @default DEFAULT_MAX_LENGTH */
	maxLength?: number;
}

/**
 * Accepts a candidate whose NFKC form has between `minLength` and `maxLength` code
 * points, inclusive.
 *
 * @example checkLength(candidate, { minLength: 8 });
 */
export function checkLength(
	candidate: string,
	options: LengthOptions = {},
): Result<void, PasswordPolicyError> {
	let minLength = options.minLength ?? DEFAULT_MIN_LENGTH;
	let maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
	let length = countCodePoints(normalizePassword(candidate));

	if (length < minLength) {
		return failure(new PasswordPolicyError({ reason: "too-short", minLength, length }));
	}

	if (length > maxLength) {
		return failure(new PasswordPolicyError({ reason: "too-long", maxLength, length }));
	}

	return success(undefined);
}
