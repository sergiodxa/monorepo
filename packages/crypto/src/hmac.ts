/**
 * HMAC signing and verification over WebCrypto.
 *
 * Webhooks, signed URLs, and alert payloads all need a keyed MAC, and the risky
 * half is the comparison: `verify` derives the expected MAC and checks it in
 * constant time so no call site has to remember to avoid `===`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type { BinaryLike, Bytes } from "./lib/bytes";

import { Hex } from "./encoding";
import { CryptoError, UnsupportedAlgorithmError } from "./errors";
import { toBytes } from "./lib/bytes";
import { timingSafeEqual } from "./timing-safe-equal";

/** Hash functions WebCrypto exposes for HMAC keys. */
const SUPPORTED_HASHES = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;

/** Hash used when a caller does not ask for one. */
const DEFAULT_HASH = "SHA-256";

/**
 * Types for the `hmac` operations.
 */
export namespace hmac {
	/** Hash function backing an HMAC key. */
	export type Hash = (typeof SUPPORTED_HASHES)[number];

	/** Shared options for signing and verifying. */
	export interface Options {
		/**
		 * Hash function to key.
		 * @default "SHA-256"
		 */
		hash?: Hash;
	}
}

/**
 * Signs a payload with a secret, returning the raw MAC bytes.
 *
 * @param secret Key material; text is read as UTF-8.
 * @param payload Message to authenticate.
 * @param options Hash selection.
 * @returns MAC bytes, or a `CryptoError` when the hash is unsupported or the runtime refuses the key.
 */
async function sign(
	secret: BinaryLike,
	payload: BinaryLike,
	options: hmac.Options = {},
): Promise<Result<Bytes, CryptoError>> {
	let hash = options.hash ?? DEFAULT_HASH;
	if (!SUPPORTED_HASHES.includes(hash)) return failure(new UnsupportedAlgorithmError(hash));

	try {
		let key = await crypto.subtle.importKey("raw", toBytes(secret), { name: "HMAC", hash }, false, [
			"sign",
		]);
		let signature = await crypto.subtle.sign("HMAC", key, toBytes(payload));
		return success(new Uint8Array(signature));
	} catch {
		return failure(new CryptoError("HMAC signing failed"));
	}
}

/**
 * Recomputes the MAC for a payload and compares it in constant time.
 *
 * A signature given as a string is decoded as hex, the form `Hex.encode` produces
 * and the form signature headers usually carry. An undecodable string is reported
 * as a plain mismatch rather than an error, so a malformed header fails closed
 * without needing a second branch at the call site.
 *
 * @param secret Key material; text is read as UTF-8.
 * @param payload Message the signature is supposed to cover.
 * @param signature MAC to check, as bytes or as a hex string.
 * @param options Hash selection; must match the hash used to sign.
 * @returns Whether the signature matches, or a `CryptoError` when the MAC could not be computed.
 * @example
 * let ok = await hmac.verify(secret, body, request.headers.get("x-signature") ?? "");
 */
async function verify(
	secret: BinaryLike,
	payload: BinaryLike,
	signature: BinaryLike,
	options: hmac.Options = {},
): Promise<Result<boolean, CryptoError>> {
	let expected = await sign(secret, payload, options);
	if (isFailure(expected)) return expected;

	if (typeof signature === "string") {
		let decoded = Hex.decode(signature);
		if (isFailure(decoded)) return success(false);
		return success(timingSafeEqual(expected.data, decoded.data));
	}

	return success(timingSafeEqual(expected.data, toBytes(signature)));
}

/**
 * Keyed message authentication with a constant-time verifier.
 *
 * @example
 * let mac = await hmac.sign(secret, payload);
 * let ok = await hmac.verify(secret, payload, Hex.encode(unwrap(mac)));
 */
export const hmac = { sign, verify };
