/**
 * SHA-2 digests over text or binary payloads.
 *
 * These are the lookup hashes for values that must stay searchable, such as API
 * keys stored as digests: the same input always produces the same bytes, so a row
 * can be found by hashing the presented secret instead of storing it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";

import type { BinaryLike, Bytes } from "./lib/bytes";

import { CryptoError } from "./errors";
import { toBytes } from "./lib/bytes";

/** SHA-2 digests this module computes, spelled the way WebCrypto expects them. */
type DigestAlgorithm = "SHA-256" | "SHA-384" | "SHA-512";

/**
 * Digests a payload with one WebCrypto hash, reporting a refusal as a value.
 *
 * Every exported digest routes through here, so the three of them agree on how
 * text is encoded and on what a runtime failure looks like to a caller.
 *
 * @param algorithm Digest name as WebCrypto spells it.
 * @param data Text (read as UTF-8) or bytes to digest.
 * @returns The digest bytes, or a `CryptoError` if the runtime rejects the operation.
 */
async function digest(
	algorithm: DigestAlgorithm,
	data: BinaryLike,
): Promise<Result<Bytes, CryptoError>> {
	try {
		let hashed = await crypto.subtle.digest(algorithm, toBytes(data));
		return success(new Uint8Array(hashed));
	} catch {
		return failure(new CryptoError(`${algorithm} digest failed`));
	}
}

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
export function sha256(data: BinaryLike): Promise<Result<Bytes, CryptoError>> {
	return digest("SHA-256", data);
}

/**
 * Hashes a payload with SHA-384.
 *
 * The digest an OpenID Connect token hash claim needs when the ID token is signed
 * with an `ES384`, `RS384`, or `PS384` algorithm (OpenID Connect Core §3.1.3.6).
 *
 * @param data Text (read as UTF-8) or bytes to digest.
 * @returns The 48 digest bytes, or a `CryptoError` if the runtime rejects the operation.
 * @example
 * let digest = unwrap(await sha384(accessToken));
 * let atHash = Base64Url.encode(digest.subarray(0, digest.length / 2));
 */
export function sha384(data: BinaryLike): Promise<Result<Bytes, CryptoError>> {
	return digest("SHA-384", data);
}

/**
 * Hashes a payload with SHA-512.
 *
 * The digest an OpenID Connect token hash claim needs when the ID token is signed
 * with an `ES512`, `RS512`, or `PS512` algorithm (OpenID Connect Core §3.1.3.6).
 *
 * @param data Text (read as UTF-8) or bytes to digest.
 * @returns The 64 digest bytes, or a `CryptoError` if the runtime rejects the operation.
 * @example
 * let digest = unwrap(await sha512(accessToken));
 * let atHash = Base64Url.encode(digest.subarray(0, digest.length / 2));
 */
export function sha512(data: BinaryLike): Promise<Result<Bytes, CryptoError>> {
	return digest("SHA-512", data);
}
