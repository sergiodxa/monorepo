/**
 * Computes the digest of a body with one of the algorithms the digest fields name, the
 * value a sender writes into `Content-Digest` or `Digest` and a receiver recomputes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BinaryLike, Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { sha256, sha512 } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import type { DigestAlgorithm } from "./types.js";

import { DigestError } from "./errors.js";

/** The algorithms this package computes, for narrowing a name read from a field. */
export const DIGEST_ALGORITHMS: readonly DigestAlgorithm[] = ["sha-256", "sha-512"];

/**
 * Whether a lowercase algorithm name is one `digest` computes.
 *
 * @param name - An algorithm name as a field spells it, already lowercased.
 */
export function isDigestAlgorithm(name: string): name is DigestAlgorithm {
	return (DIGEST_ALGORITHMS as readonly string[]).includes(name);
}

/**
 * Digests a body. Text is read as UTF-8, so pass the exact bytes sent on the wire when a
 * body is not UTF-8 text.
 *
 * @param bytes - The content (for `Content-Digest`) or representation (for `Repr-Digest`).
 * @param algorithm - `sha-256` or `sha-512`.
 * @returns The digest bytes, `unsupported-algorithm` for any other name, or `crypto` when
 *   the runtime refuses the hash.
 * @example
 * let bytes = await digest(body, "sha-256"); // success(32 bytes)
 */
export async function digest(
	bytes: BinaryLike,
	algorithm: DigestAlgorithm,
): Promise<Result<Bytes, DigestError>> {
	if (!isDigestAlgorithm(algorithm)) {
		return failure(new DigestError("unsupported-algorithm", "Unsupported digest algorithm"));
	}

	let hashed = algorithm === "sha-256" ? await sha256(bytes) : await sha512(bytes);
	if (isFailure(hashed)) {
		return failure(new DigestError("crypto", hashed.error.message, { cause: hashed.error }));
	}
	return success(hashed.data);
}
