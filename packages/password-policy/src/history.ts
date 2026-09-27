/**
 * The reuse rule: whether a new password matches one the account held before. The caller
 * loads the stored hashes and passes them in, so the rule stays storage-free; each hash
 * costs one password-hash verification, which is why the history is capped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { password } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import { PasswordPolicyError } from "./password-policy-error.js";

/**
 * Stored hashes checked by default. Each is one scrypt verification (about 100 ms of
 * CPU), so five keeps a password change within a few sign-ins' worth of work.
 */
export const DEFAULT_MAX_HISTORY = 5;

/** How a caller bounds the reuse check. */
export interface PasswordHistoryOptions {
	/**
	 * How many of the newest hashes to verify; later entries are ignored.
	 * @default DEFAULT_MAX_HISTORY
	 */
	maxHistory?: number;
}

/**
 * Refuses a candidate that verifies against one of the account's previous hashes, passed
 * newest first. Hashes are verified one at a time, so a match stops the work early.
 * A confirmed match wins over a hash that failed to verify earlier in the list.
 *
 * @param candidate - The password exactly as submitted, the form its hashes were made from.
 * @param previousHashes - Stored hashes, newest first.
 * @returns `reused` with the matching position, `history-check-unavailable` with the first
 * position that could not be verified, or success.
 */
export async function checkPasswordHistory(
	candidate: string,
	previousHashes: string[],
	options: PasswordHistoryOptions = {},
): Promise<Result<void, PasswordPolicyError>> {
	let checked = previousHashes.slice(0, Math.max(options.maxHistory ?? DEFAULT_MAX_HISTORY, 0));
	let unverifiable: PasswordPolicyError | null = null;

	for (let [index, stored] of checked.entries()) {
		let verified = await password.verify(stored, candidate);

		if (isFailure(verified)) {
			unverifiable ??= new PasswordPolicyError(
				{ reason: "history-check-unavailable", index },
				{ cause: verified.error },
			);
			continue;
		}

		if (verified.data) return failure(new PasswordPolicyError({ reason: "reused", index }));
	}

	if (unverifiable) return failure(unverifiable);
	return success(undefined);
}
