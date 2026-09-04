/**
 * Password hashing with scrypt through `node:crypto`, the memory-hard derivation
 * every runtime this package targets implements natively.
 *
 * Hashes are stored in a self-describing string that carries its own cost
 * parameters, so those can be raised without a schema change: verification uses
 * the parameters found in the stored value, and `needsRehash` reports when that
 * value is behind current policy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scrypt } from "node:crypto";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Bytes } from "./lib/bytes.js";

import { Base64Url } from "./encoding.js";
import { CryptoError, MalformedHashError, UnsupportedAlgorithmError } from "./errors.js";
import { toBytes } from "./lib/bytes.js";
import { randomBytes } from "./random.js";
import { timingSafeEqual } from "./timing-safe-equal.js";

/**
 * Base-2 logarithm of `N` for new hashes: 32 MiB of scratch at the block size below,
 * one of the published equivalents of a 128 MiB single-repetition baseline, sized so
 * several derivations fit at once in a 128 MB isolate.
 */
const SCRYPT_LOG_N = 15;

/** Block size `r` for new hashes, the 1 KiB per block every published parameter set assumes. */
const SCRYPT_BLOCK_SIZE = 8;

/** Repetitions `p` for new hashes, restoring the cost the smaller `N` gives up. */
const SCRYPT_PARALLELISM = 3;

/** Salt length for new hashes, in bytes. */
const SCRYPT_SALT_BYTES = 16;

/** Derived key length for new hashes, in bytes. */
const SCRYPT_KEY_BYTES = 32;

/** Algorithm tag written into, and required by, the encoded format. */
const SCRYPT_ALGORITHM_ID = "scrypt";

/** Scratch memory one block costs, fixed by the algorithm at `128 * r` bytes. */
const BLOCK_MEMORY_UNIT = 128;

/**
 * Upper bound on the scratch memory a stored hash may ask for, so cost parameters
 * read out of the database are refused while they are still numbers.
 */
const MAX_MEMORY_BYTES = 128 * 1024 * 1024;

/** Number of fields in the encoded format, counting the leading empty one. */
const ENCODED_FIELDS = 5;

/** Cost parameters as the encoded format spells them. */
const PARAMS_PATTERN = /^ln=(\d+),r=(\d+),p=(\d+)$/;

/** Cost parameters as the encoded format spells them; scrypt reads them as `N`, `r` and `p`. */
interface Cost {
	logN: number;
	blockSize: number;
	parallelism: number;
}

/**
 * Cost parameters and material recovered from an encoded hash.
 *
 * `key` keeps the length it was stored with, so hashes written under older settings
 * still verify byte for byte.
 */
interface StoredHash extends Cost {
	salt: Bytes;
	/** Derived key bytes to compare a fresh derivation against. */
	key: Bytes;
}

/**
 * Scratch memory a derivation with these parameters asks for, passed as `maxmem` so
 * the runtime allows a cost above its own 32 MiB default; the two extra blocks are
 * the ones scrypt holds beside the `2^logN` it fills.
 *
 * @param cost Parameters the derivation will run with.
 * @returns Bytes of scratch memory the derivation needs.
 */
function memoryBytes(cost: Cost): number {
	return BLOCK_MEMORY_UNIT * cost.blockSize * (2 ** cost.logN + 2 + cost.parallelism);
}

/**
 * Parses an encoded hash into its cost parameters and material.
 *
 * Anything not written by this module is a failure, the signal a caller needs to
 * force a reset.
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
	if (algorithm !== SCRYPT_ALGORITHM_ID) return failure(new UnsupportedAlgorithmError(algorithm));

	let match = PARAMS_PATTERN.exec(params);
	if (!match?.[1] || !match[2] || !match[3]) {
		return failure(new MalformedHashError("unreadable parameters"));
	}

	let cost: Cost = {
		logN: Number.parseInt(match[1], 10),
		blockSize: Number.parseInt(match[2], 10),
		parallelism: Number.parseInt(match[3], 10),
	};
	if (cost.logN < 1 || cost.blockSize < 1 || cost.parallelism < 1) {
		return failure(new MalformedHashError("cost parameters out of range"));
	}
	if (memoryBytes(cost) > MAX_MEMORY_BYTES) {
		return failure(new MalformedHashError("cost parameters out of range"));
	}

	let decodedSalt = Base64Url.decode(salt);
	if (isFailure(decodedSalt) || decodedSalt.data.length === 0) {
		return failure(new MalformedHashError("unreadable salt"));
	}

	let decodedKey = Base64Url.decode(key);
	if (isFailure(decodedKey) || decodedKey.data.length === 0) {
		return failure(new MalformedHashError("unreadable derived key"));
	}

	return success({ ...cost, salt: decodedSalt.data, key: decodedKey.data });
}

/**
 * Runs scrypt over a secret with the given cost parameters.
 *
 * @param secret Plaintext password.
 * @param salt Salt to derive with.
 * @param cost Parameters to apply.
 * @param length Output length in bytes.
 * @returns Derived bytes, or a `CryptoError` if the runtime refuses the derivation.
 */
function derive(
	secret: string,
	salt: Bytes,
	cost: Cost,
	length: number,
): Promise<Result<Bytes, CryptoError>> {
	return new Promise((resolve) => {
		let options = {
			N: 2 ** cost.logN,
			r: cost.blockSize,
			p: cost.parallelism,
			maxmem: memoryBytes(cost),
		};

		try {
			scrypt(toBytes(secret), salt, length, options, (error, derived) => {
				if (error) resolve(failure(new CryptoError("Password derivation failed")));
				else resolve(success(new Uint8Array(derived)));
			});
		} catch {
			resolve(failure(new CryptoError("Password derivation failed")));
		}
	});
}

/**
 * Hashes a password with the current policy and a fresh random salt.
 *
 * @param secret Plaintext password.
 * @returns Encoded hash such as `$scrypt$ln=15,r=8,p=3$<salt>$<key>`, or a `CryptoError`.
 * @example
 * let stored = await password.hash(form.password);
 */
async function hash(secret: string): Promise<Result<string, CryptoError>> {
	let cost: Cost = {
		logN: SCRYPT_LOG_N,
		blockSize: SCRYPT_BLOCK_SIZE,
		parallelism: SCRYPT_PARALLELISM,
	};

	let salt = randomBytes(SCRYPT_SALT_BYTES);
	let derived = await derive(secret, salt, cost, SCRYPT_KEY_BYTES);
	if (isFailure(derived)) return derived;

	let params = `ln=${cost.logN},r=${cost.blockSize},p=${cost.parallelism}`;
	let encodedSalt = Base64Url.encode(salt);
	let encodedKey = Base64Url.encode(derived.data);
	return success(`$${SCRYPT_ALGORITHM_ID}$${params}$${encodedSalt}$${encodedKey}`);
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

	let derived = await derive(secret, parsed.data.salt, parsed.data, parsed.data.key.length);
	if (isFailure(derived)) return derived;

	return success(timingSafeEqual(derived.data, parsed.data.key));
}

/**
 * Reports whether a stored hash is behind current policy.
 *
 * True for any cost parameter below the current one, a shorter salt or key, or a
 * value this module cannot parse, matching how upgrade-on-login replaces foreign
 * hashes.
 *
 * @param stored Encoded hash to inspect.
 * @returns Whether the value should be replaced after the next successful login.
 * @example
 * if (isValid && password.needsRehash(user.passwordHash)) await rehash(form.password);
 */
function needsRehash(stored: string): boolean {
	let parsed = parse(stored);
	if (isFailure(parsed)) return true;
	if (parsed.data.logN < SCRYPT_LOG_N) return true;
	if (parsed.data.blockSize < SCRYPT_BLOCK_SIZE) return true;
	if (parsed.data.parallelism < SCRYPT_PARALLELISM) return true;
	if (parsed.data.salt.length < SCRYPT_SALT_BYTES) return true;
	return parsed.data.key.length < SCRYPT_KEY_BYTES;
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
