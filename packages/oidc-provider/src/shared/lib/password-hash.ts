/**
 * Hashing and verification for the two credentials this provider stores at rest:
 * subject passwords and OAuth client secrets.
 *
 * Hashes are PBKDF2-HMAC-SHA256. A correct plaintext checked against a hash whose
 * parameters trail current policy comes back with a replacement, so stored values
 * reach the current cost as they are used.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CryptoError } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { MalformedHashError, password, UnsupportedAlgorithmError } from "@sdxc/crypto";
import { isFailure, success } from "@sdxc/result";

/**
 * Outcome of checking a plaintext against a stored hash; `rehashed` is set
 * only when the plaintext matched and the stored hash trails current policy —
 * the one chance to derive a replacement, which callers must persist themselves.
 */
export interface VerifiedSecret {
	/** Whether the plaintext matched the stored hash. */
	matches: boolean;
	/** Replacement hash to persist, or `null` when the stored one is current. */
	rehashed: string | null;
}

/**
 * Recognizes a failure caused by a stored value that cannot be read as a hash
 * at all, which verification reports as a mismatch so a corrupt row denies
 * access instead of surfacing an error the caller would have to classify.
 *
 * @param error Failure returned by the verifier.
 * @returns Whether the stored value should count as a mismatch.
 */
function isUnreadable(error: CryptoError): boolean {
	return error instanceof MalformedHashError || error instanceof UnsupportedAlgorithmError;
}

/**
 * Derives a replacement hash for a plaintext already known to be correct.
 *
 * When re-hashing fails, the match still stands and the stored value keeps its
 * current parameters, ready to be upgraded on a later check.
 *
 * @param plaintext Secret that just verified.
 * @returns A match, carrying the replacement hash when one could be derived.
 */
async function upgrade(plaintext: string): Promise<Result<VerifiedSecret, CryptoError>> {
	let rehashed = await password.hash(plaintext);
	if (isFailure(rehashed)) return success({ matches: true, rehashed: null });
	return success({ matches: true, rehashed: rehashed.data });
}

/**
 * Hashes a secret with the current scheme.
 *
 * The encoded output carries its own cost parameters, so raising them later
 * only changes the hashing defaults, leaving each hash self-describing.
 *
 * @param plaintext Secret to hash.
 * @returns Encoded hash such as `$pbkdf2-sha256$i=600000$<salt>$<key>`.
 * @example
 * let stored = unwrap(await hashSecret(plainSecret));
 */
export function hashSecret(plaintext: string): Promise<Result<string, CryptoError>> {
	return password.hash(plaintext);
}

/**
 * Checks a plaintext against a stored hash; a wrong secret, and a stored value
 * too damaged to read, both resolve to `matches: false` rather than a failure.
 *
 * @param stored Hash read from the database.
 * @param plaintext Presented secret.
 * @returns The match, plus a replacement hash the caller must persist when set.
 * @example
 * let checked = await verifySecret(row.password_hash, form.password);
 * if (isSuccess(checked) && checked.data.rehashed) await persist(checked.data.rehashed);
 */
export async function verifySecret(
	stored: string,
	plaintext: string,
): Promise<Result<VerifiedSecret, CryptoError>> {
	let checked = await password.verify(stored, plaintext);

	if (isFailure(checked)) {
		if (!isUnreadable(checked.error)) return checked;
		return success({ matches: false, rehashed: null });
	}

	if (!checked.data) return success({ matches: false, rehashed: null });
	if (!password.needsRehash(stored)) return success({ matches: true, rehashed: null });
	return await upgrade(plaintext);
}

/**
 * Performs one hashing operation and discards the result, so checking a
 * missing secret takes the same time as checking one that does not match,
 * keeping the two indistinguishable to an outside observer.
 *
 * @param plaintext Presented secret, hashed only to spend the work.
 * @example
 * await spendVerificationCost(presented); // nothing stored to compare against
 */
export async function spendVerificationCost(plaintext: string): Promise<void> {
	await password.hash(plaintext);
}
