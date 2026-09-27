/**
 * The common-password rule, checked offline against a bundled SecLists corpus. The list
 * ships as one string and becomes a `Set` on the first lookup, so importing this module
 * does no work at startup, which Workers require of global scope.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { COMMON_PASSWORDS } from "./common-passwords.data.js";
import { foldPassword } from "./normalize.js";
import { PasswordPolicyError } from "./password-policy-error.js";

export { COMMON_PASSWORDS_MIN_LENGTH, COMMON_PASSWORDS_NOTICE } from "./common-passwords.data.js";

/** The decoded list, filled on the first lookup and kept for the isolate's lifetime. */
const DECODED: { list: Set<string> | null } = { list: null };

/**
 * Whether the candidate, folded with NFKC and lowercase, is on the bundled list. The
 * list holds only entries of at least `COMMON_PASSWORDS_MIN_LENGTH` code points.
 */
export function isCommonPassword(candidate: string): boolean {
	DECODED.list ??= new Set(COMMON_PASSWORDS.split("\n"));
	return DECODED.list.has(foldPassword(candidate));
}

/** Refuses a candidate on the bundled common-password list with the `common` reason. */
export function checkCommonPassword(candidate: string): Result<void, PasswordPolicyError> {
	if (isCommonPassword(candidate)) return failure(new PasswordPolicyError({ reason: "common" }));
	return success(undefined);
}
