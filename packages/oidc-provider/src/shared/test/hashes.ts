/**
 * Test-only hash construction for the stored values this provider must accept
 * but never writes: a hash derived with parameters below current policy, which
 * verifies correctly and is reported as needing a replacement.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url, randomBytes } from "@sdxc/crypto";

/** Iteration count standing in for one an earlier policy would have recorded. */
const UNDERPOWERED_ITERATIONS = 1_000;

/** Salt length the current policy expects, so only the cost trails it. */
const SALT_BYTES = 16;

/** Derived key length the current policy expects, so only the cost trails it. */
const KEY_BYTES = 32;

/** Converts the key length into the bit count Web Crypto asks for. */
const BITS_PER_BYTE = 8;

/**
 * Derives a hash of `secret` in the stored format, recording an iteration count
 * below current policy so verifying it both succeeds and asks for a replacement.
 *
 * @param secret Plaintext to derive from.
 * @returns Encoded hash such as `$pbkdf2-sha256$i=1000$<salt>$<key>`.
 * @example
 * let stored = await underpoweredHash("s3cret");
 */
export async function underpoweredHash(secret: string): Promise<string> {
	let salt = randomBytes(SALT_BYTES);
	let key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	let bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations: UNDERPOWERED_ITERATIONS, hash: "SHA-256" },
		key,
		KEY_BYTES * BITS_PER_BYTE,
	);

	let encodedSalt = Base64Url.encode(salt);
	let encodedKey = Base64Url.encode(new Uint8Array(bits));
	return `$pbkdf2-sha256$i=${UNDERPOWERED_ITERATIONS}$${encodedSalt}$${encodedKey}`;
}
