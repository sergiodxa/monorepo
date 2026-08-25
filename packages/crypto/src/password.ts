/**
 * Password hashing with PBKDF2-HMAC-SHA256 through WebCrypto.
 *
 * Hashes are stored in a self-describing string that carries its own cost
 * parameters, so the iteration count can be raised without a schema change:
 * verification uses the parameters found in the stored value, and `needsRehash`
 * reports when that value is behind current policy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type { Bytes } from "./lib/bytes";

import { Base64Url } from "./encoding";
import { CryptoError, MalformedHashError, UnsupportedAlgorithmError } from "./errors";
import { toBytes } from "./lib/bytes";
import { randomBytes } from "./random";
import { timingSafeEqual } from "./timing-safe-equal";

/**
 * Current iteration count for new hashes.
 *
 * PBKDF2 is not memory-hard, so this number carries the entire cost budget;
 * raising it is the whole upgrade, since `needsRehash` reports the change.
 */
const PBKDF2_ITERATIONS = 600_000;

/** Salt length for new hashes, in bytes. */
const PBKDF2_SALT_BYTES = 16;

/** Derived key length for new hashes, in bytes. */
const PBKDF2_KEY_BYTES = 32;

/** Algorithm tag written into, and required by, the encoded format. */
const PBKDF2_ALGORITHM_ID = "pbkdf2-sha256";

/** Hash function inside PBKDF2, fixed by the algorithm tag. */
const PBKDF2_HASH = "SHA-256";

/** Upper bound on a stored iteration count, so a bad value cannot stall a request. */
const PBKDF2_MAX_ITERATIONS = 10_000_000;

/** Number of fields in the encoded format, counting the leading empty one. */
const ENCODED_FIELDS = 5;

/** Only supported parameter field: the iteration count. */
const ITERATIONS_PARAM = /^i=(\d+)$/;

/** Bits per byte, used to turn a key length into a `deriveBits` length. */
const BITS_PER_BYTE = 8;

/**
 * Cost parameters and material recovered from an encoded hash.
 *
 * `key` keeps its stored length rather than the current policy length, so hashes
 * written under older settings still verify byte for byte.
 */
interface StoredHash {
	/** Iteration count the stored hash was produced with. */
	iterations: number;
	/** Salt the stored hash was produced with. */
	salt: Bytes;
	/** Derived key bytes to compare against. */
	key: Bytes;
}

/**
 * Parses an encoded hash into its cost parameters and material.
 *
 * Anything not written by this module is a failure, which is the signal a caller
 * needs to route the value to a legacy verifier instead of guessing.
 *
 * @param stored Encoded hash string.
 * @returns Parsed parameters, or the reason the value is unusable.
 */
function parse(stored: string): Result<StoredHash, MalformedHashError | UnsupportedAlgorithmError> {
	let fields = stored.split("$");
	if (fields.length !== ENCODED_FIELDS || fields[0] !== "") {
		return failure(new MalformedHashError("unexpected field count"));
	}

	let [, algorithm = "", params = "", salt = "", key = ""] = fields;
	if (algorithm !== PBKDF2_ALGORITHM_ID) return failure(new UnsupportedAlgorithmError(algorithm));

	let match = ITERATIONS_PARAM.exec(params);
	if (!match?.[1]) return failure(new MalformedHashError("unreadable parameters"));

	let iterations = Number.parseInt(match[1], 10);
	if (iterations < 1 || iterations > PBKDF2_MAX_ITERATIONS) {
		return failure(new MalformedHashError("iteration count out of range"));
	}

	let decodedSalt = Base64Url.decode(salt);
	if (isFailure(decodedSalt) || decodedSalt.data.length === 0) {
		return failure(new MalformedHashError("unreadable salt"));
	}

	let decodedKey = Base64Url.decode(key);
	if (isFailure(decodedKey) || decodedKey.data.length === 0) {
		return failure(new MalformedHashError("unreadable derived key"));
	}

	return success({ iterations, salt: decodedSalt.data, key: decodedKey.data });
}

/**
 * Runs PBKDF2-HMAC-SHA256 over a secret with the given cost parameters.
 *
 * @param secret Plaintext password.
 * @param salt Salt to derive with.
 * @param iterations Iteration count to apply.
 * @param length Output length in bytes.
 * @returns Derived bytes, or a `CryptoError` if the runtime refuses the derivation.
 */
async function derive(
	secret: string,
	salt: Bytes,
	iterations: number,
	length: number,
): Promise<Result<Bytes, CryptoError>> {
	try {
		let key = await crypto.subtle.importKey("raw", toBytes(secret), "PBKDF2", false, [
			"deriveBits",
		]);
		let bits = await crypto.subtle.deriveBits(
			{ name: "PBKDF2", salt, iterations, hash: PBKDF2_HASH },
			key,
			length * BITS_PER_BYTE,
		);
		return success(new Uint8Array(bits));
	} catch {
		return failure(new CryptoError("Password derivation failed"));
	}
}

/**
 * Hashes a password with the current policy and a fresh random salt.
 *
 * @param secret Plaintext password.
 * @returns Encoded hash such as `$pbkdf2-sha256$i=600000$<salt>$<key>`, or a `CryptoError`.
 * @example
 * let stored = await password.hash(form.password);
 */
async function hash(secret: string): Promise<Result<string, CryptoError>> {
	let salt = randomBytes(PBKDF2_SALT_BYTES);
	let derived = await derive(secret, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_BYTES);
	if (isFailure(derived)) return derived;

	let encodedSalt = Base64Url.encode(salt);
	let encodedKey = Base64Url.encode(derived.data);
	return success(`$${PBKDF2_ALGORITHM_ID}$i=${PBKDF2_ITERATIONS}$${encodedSalt}$${encodedKey}`);
}

/**
 * Checks a password against an encoded hash using the hash's own parameters.
 *
 * A wrong password is `success(false)`; only an unusable stored value or a runtime
 * failure is a `Failure`, which keeps "wrong password" and "cannot check" apart.
 *
 * @param stored Encoded hash previously produced by `hash`.
 * @param secret Plaintext password to check.
 * @returns Whether the password matches, or why the check could not run.
 * @example
 * let ok = await password.verify(user.passwordHash, form.password);
 */
async function verify(stored: string, secret: string): Promise<Result<boolean, CryptoError>> {
	let parsed = parse(stored);
	if (isFailure(parsed)) return parsed;

	let derived = await derive(
		secret,
		parsed.data.salt,
		parsed.data.iterations,
		parsed.data.key.length,
	);
	if (isFailure(derived)) return derived;

	return success(timingSafeEqual(derived.data, parsed.data.key));
}

/**
 * Reports whether a stored hash is behind current policy.
 *
 * True for a lower iteration count, a shorter salt or key, or a value this
 * module cannot parse, matching how upgrade-on-login replaces foreign hashes.
 *
 * @param stored Encoded hash to inspect.
 * @returns Whether the value should be replaced after the next successful login.
 * @example
 * if (isValid && password.needsRehash(user.passwordHash)) await rehash(form.password);
 */
function needsRehash(stored: string): boolean {
	let parsed = parse(stored);
	if (isFailure(parsed)) return true;
	if (parsed.data.iterations < PBKDF2_ITERATIONS) return true;
	if (parsed.data.salt.length < PBKDF2_SALT_BYTES) return true;
	return parsed.data.key.length < PBKDF2_KEY_BYTES;
}

/**
 * Password hashing, verification, and upgrade detection.
 *
 * @example
 * let stored = unwrap(await password.hash("secret"));
 * let ok = unwrap(await password.verify(stored, "secret")); // true
 * password.needsRehash(stored); // false
 */
export const password = { hash, verify, needsRehash };
