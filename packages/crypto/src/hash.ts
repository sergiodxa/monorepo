/**
 * SHA-256 digests over text or binary payloads.
 *
 * This is the lookup hash for values that must stay searchable, such as API keys
 * stored as digests: the same input always produces the same bytes, so a row can
 * be found by hashing the presented secret instead of storing it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";

import type { BinaryLike, Bytes } from "./lib/bytes";

import { CryptoError } from "./errors";
import { toBytes } from "./lib/bytes";

/** Digest algorithm name as WebCrypto spells it. */
const SHA256 = "SHA-256";

/**
 * Hashes a payload with SHA-256.
 *
 * Unsalted and deterministic by design, which makes it right for lookups and
 * fingerprints and wrong for passwords; use `password.hash` for those.
 *
 * @param data Text (read as UTF-8) or bytes to digest.
 * @returns The 32 digest bytes, or a `CryptoError` if the runtime rejects the operation.
 * @example
 * let digest = await sha256(apiKey);
 * if (isSuccess(digest)) lookupBy(Hex.encode(digest.data));
 */
export async function sha256(data: BinaryLike): Promise<Result<Bytes, CryptoError>> {
	try {
		let digest = await crypto.subtle.digest(SHA256, toBytes(data));
		return success(new Uint8Array(digest));
	} catch {
		return failure(new CryptoError("SHA-256 digest failed"));
	}
}
