/**
 * Hashing and verification for the two credentials this provider stores at rest:
 * subject passwords and OAuth client secrets.
 *
 * New hashes are PBKDF2-HMAC-SHA256. Hashes written by the previous bcrypt scheme
 * still verify, and a correct plaintext checked against one comes back with a
 * replacement hash, so stored values leave the old format as they are used.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CryptoError } from "@pkg/crypto";
import type { Result } from "@pkg/result";

import { MalformedHashError, password, UnsupportedAlgorithmError } from "@pkg/crypto";
import { isFailure, success } from "@pkg/result";
import bcrypt from "bcryptjs";

/**
 * Outcome of checking a plaintext against a stored hash.
 *
 * `rehashed` is the whole migration: it is set only when the plaintext was
 * correct and the stored value is behind current policy, and it is the only
 * moment the plaintext is available to derive a replacement from. A caller that
 * ignores it leaves the old hash in place, so the value is returned here rather
 * than written anywhere by this module.
 */
export interface VerifiedSecret {
	/** Whether the plaintext matched the stored hash. */
	matches: boolean;
	/** Replacement hash to persist, or `null` when the stored one is current. */
	rehashed: string | null;
}

/**
 * Whether a failure means "not written by the current scheme" rather than
 * "the check could not run".
 *
 * A bcrypt hash has too few fields to parse as the current format, so it arrives
 * as a malformed value; that is the signal to route it to the legacy comparison
 * instead of treating it as an error.
 *
 * @param error Failure returned by the current-scheme verifier.
 * @returns Whether the stored value should be retried against bcrypt.
 */
function isForeignFormat(error: CryptoError): boolean {
	return error instanceof MalformedHashError || error instanceof UnsupportedAlgorithmError;
}

/**
 * Compares a plaintext against a bcrypt hash written before the migration.
 *
 * A stored value that is neither format reaches this point too, so a rejected
 * comparison is reported as a plain mismatch and the check fails closed.
 *
 * @param stored Hash read from the database.
 * @param plaintext Presented secret.
 * @returns Whether the plaintext matches.
 */
async function compareLegacy(stored: string, plaintext: string): Promise<boolean> {
	try {
		return await bcrypt.compare(plaintext, stored);
	} catch {
		return false;
	}
}

/**
 * Derives a replacement hash for a plaintext already known to be correct.
 *
 * A failed re-hash never rejects the secret: the caller keeps its match and the
 * stored value stays in its old format, to be upgraded on a later check.
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
 * The encoded output carries its own cost parameters, so raising them later does
 * not need a schema change or a stored-format flag.
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
 * Checks a plaintext against a stored hash in either supported format.
 *
 * Values in the current format are checked with the parameters they record;
 * anything else is routed to bcrypt, which is what every hash written before the
 * migration looks like. A wrong secret is `matches: false`, never a failure, so
 * "wrong secret" and "could not check" stay distinguishable.
 *
 * @param stored Hash read from the database, in either format.
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
		if (!isForeignFormat(checked.error)) return checked;
		if (!(await compareLegacy(stored, plaintext))) {
			return success({ matches: false, rehashed: null });
		}
		return await upgrade(plaintext);
	}

	if (!checked.data) return success({ matches: false, rehashed: null });
	if (!password.needsRehash(stored)) return success({ matches: true, rehashed: null });
	return await upgrade(plaintext);
}

/**
 * Performs one hashing operation and discards the result.
 *
 * Called where there is nothing to compare against, so that "no stored secret"
 * costs the same as "stored secret that did not match" and the difference cannot
 * be timed from outside.
 *
 * @param plaintext Presented secret, hashed only to spend the work.
 * @example
 * await spendVerificationCost(presented); // nothing stored to compare against
 */
export async function spendVerificationCost(plaintext: string): Promise<void> {
	await password.hash(plaintext);
}
