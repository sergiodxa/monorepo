/**
 * The signature scheme itself: the exact string a delivery signs, the MAC over
 * it, the header value that carries the MAC, and the reverse parse.
 *
 * Signing and verifying share every one of these steps through one shared
 * implementation; a difference of one separator between the two sides is an
 * authentication bypass or a permanent rejection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BinaryLike, Bytes } from "@pkg/crypto";
import type { Result } from "@pkg/result";

import { hmac } from "@pkg/crypto";
import { failure, isFailure, success } from "@pkg/result";

import { MalformedSignatureError, SignatureComputationError } from "./errors";
import { decodeBase64, encodeBase64 } from "./lib/base64";

/** Scheme tag for a symmetric HMAC-SHA256 signature, the only one this package produces. */
const SYMMETRIC_SCHEME = "v1";

/** Separator between the scheme tag and the encoded MAC inside one signature value. */
const SCHEME_SEPARATOR = ",";

/** Signature values are space-separated, so a sender mid-rotation can send several. */
const VALUE_SEPARATOR = /\s+/;

/**
 * Builds the exact message a signature covers: id, timestamp, and raw body,
 * joined with dots; the body must be the exact text sent, since two JSON
 * encodings of the same value sign differently.
 *
 * @param id Delivery id from the `webhook-id` header.
 * @param timestamp Send time in whole seconds since the epoch.
 * @param body Exact body text.
 * @returns The string the MAC is computed over.
 * @example
 * signedContent("msg_1", 1614265330, '{"test": 1}'); // 'msg_1.1614265330.{"test": 1}'
 */
export function signedContent(id: string, timestamp: number, body: string): string {
	return `${id}.${timestamp}.${body}`;
}

/**
 * Computes the HMAC-SHA256 of signed content with decoded key material.
 *
 * @param secret Key bytes from `decodeSecret()`.
 * @param content Result of `signedContent()`.
 * @returns MAC bytes, or `SignatureComputationError` when the runtime refuses the key.
 */
export async function computeSignature(
	secret: Bytes,
	content: string,
): Promise<Result<Bytes, SignatureComputationError>> {
	let mac = await hmac.sign(secret, content, { hash: "SHA-256" });
	if (isFailure(mac)) return failure(new SignatureComputationError(mac.error));
	return success(mac.data);
}

/**
 * Formats MAC bytes as a `webhook-signature` header value.
 *
 * @param mac MAC bytes to encode.
 * @returns The scheme-prefixed value, such as `v1,g0hM9SsE...`.
 * @example
 * formatSignature(mac); // "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE="
 */
export function formatSignature(mac: BinaryLike): string {
	return `${SYMMETRIC_SCHEME}${SCHEME_SEPARATOR}${encodeBase64(mac)}`;
}

/**
 * Parses a `webhook-signature` header into the MACs worth comparing against.
 *
 * Reading each space-separated value independently keeps a good `v1` MAC
 * usable even when a sibling value uses another scheme or is unreadable.
 *
 * @param header Raw header value, one or more space-separated signatures.
 * @returns Candidate MACs in the order presented, or `MalformedSignatureError` when none is readable.
 * @example
 * parseSignatures("v1a,AAAA v1,g0hM..."); // success([bytes for the v1 value])
 */
export function parseSignatures(header: string): Result<Bytes[], MalformedSignatureError> {
	let candidates: Bytes[] = [];

	for (let value of header.trim().split(VALUE_SEPARATOR)) {
		let separator = value.indexOf(SCHEME_SEPARATOR);
		if (separator < 0) continue;
		if (value.slice(0, separator) !== SYMMETRIC_SCHEME) continue;

		let decoded = decodeBase64(value.slice(separator + 1));
		if (isFailure(decoded) || decoded.data.length === 0) continue;

		candidates.push(decoded.data);
	}

	if (candidates.length === 0) return failure(new MalformedSignatureError());

	return success(candidates);
}
