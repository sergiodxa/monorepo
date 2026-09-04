/**
 * Test-only hash construction for the stored values this provider must accept
 * but never writes: a hash derived with parameters below current policy, which
 * verifies correctly and is reported as needing a replacement.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scryptSync } from "node:crypto";

import { Base64Url, randomBytes } from "@sdxc/crypto";

/** Cost standing in for one an earlier policy would have recorded, cheap enough to keep tests fast. */
const UNDERPOWERED_LOG_N = 12;

/** Block size the current policy expects, so only the cost trails it. */
const BLOCK_SIZE = 8;

/** Repetitions this hash records, below the current policy so it asks for a replacement. */
const PARALLELISM = 1;

/** Salt length the current policy expects, so only the cost trails it. */
const SALT_BYTES = 16;

/** Derived key length the current policy expects, so only the cost trails it. */
const KEY_BYTES = 32;

/**
 * Derives a hash of `secret` in the stored format, recording a cost below current
 * policy so verifying it both succeeds and asks for a replacement.
 *
 * @param secret Plaintext to derive from.
 * @returns Encoded hash such as `$scrypt$ln=12,r=8,p=1$<salt>$<key>`.
 * @example
 * let stored = await underpoweredHash("s3cret");
 */
export async function underpoweredHash(secret: string): Promise<string> {
	let salt = randomBytes(SALT_BYTES);
	let key = scryptSync(secret, salt, KEY_BYTES, {
		N: 2 ** UNDERPOWERED_LOG_N,
		r: BLOCK_SIZE,
		p: PARALLELISM,
	});

	let encodedSalt = Base64Url.encode(salt);
	let encodedKey = Base64Url.encode(new Uint8Array(key));
	return `$scrypt$ln=${UNDERPOWERED_LOG_N},r=${BLOCK_SIZE},p=${PARALLELISM}$${encodedSalt}$${encodedKey}`;
}
