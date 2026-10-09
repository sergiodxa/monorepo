/**
 * Decoding of the base64url key material Web Push exchanges: uncompressed P-256 points,
 * checked to lie on the curve, and fixed-length secrets. Both the subscription and the
 * VAPID identity go through here, so a key WebCrypto would refuse is caught as data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url } from "@sdxc/crypto/encoding";
import { isFailure } from "@sdxc/result";

/** Bytes of an uncompressed P-256 point: the `0x04` prefix, then 32 bytes each of x and y. */
export const P256_POINT_LENGTH = 65;

/** Bytes of one P-256 coordinate, and of a private scalar. */
export const P256_COORDINATE_LENGTH = 32;

/** The prefix SEC 1 writes before an uncompressed point. */
const UNCOMPRESSED_PREFIX = 0x04;

/** The prime the P-256 field is taken over. */
const P256_PRIME = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;

/** The `b` coefficient of P-256's curve, `y² = x³ − 3x + b`. */
const P256_B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn;

/**
 * The text without its trailing `=` padding, found by one backward scan so a run of
 * thousands of `=` before another character costs linear time.
 *
 * @param value - Base64url text, padded or not.
 * @returns The text up to its last non-`=` character.
 * @example trimPadding("AQID==") // "AQID"
 */
export function trimPadding(value: string): string {
	let end = value.length;
	while (end > 0 && value[end - 1] === "=") end--;
	return value.slice(0, end);
}

/**
 * Reads unpadded or padded base64url, answering `null` for anything else, so a caller
 * branches on malformed key material without a `Result` per field.
 *
 * @param value - The text as a browser or an environment variable carried it.
 */
export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
	let decoded = Base64Url.decode(trimPadding(value));
	return isFailure(decoded) ? null : Uint8Array.from(decoded.data);
}

/** The big-endian unsigned integer a run of bytes spells. */
function toBigInt(bytes: Uint8Array): bigint {
	let value = 0n;
	for (let byte of bytes) value = (value << 8n) | BigInt(byte);
	return value;
}

/**
 * Decodes an uncompressed P-256 point and checks it lies on the curve, which is exactly
 * what WebCrypto's raw ECDH import accepts.
 *
 * @param value - The point, base64url.
 * @returns The 65 bytes, or `null` when the text spells anything else.
 */
export function decodePoint(value: string): Uint8Array<ArrayBuffer> | null {
	let bytes = decodeBase64Url(value);
	if (bytes === null || bytes.length !== P256_POINT_LENGTH) return null;
	if (bytes[0] !== UNCOMPRESSED_PREFIX) return null;

	let x = toBigInt(bytes.subarray(1, 1 + P256_COORDINATE_LENGTH));
	let y = toBigInt(bytes.subarray(1 + P256_COORDINATE_LENGTH));
	if (x >= P256_PRIME || y >= P256_PRIME) return null;

	let left = (y * y) % P256_PRIME;
	let right = (((x * x * x - 3n * x + P256_B) % P256_PRIME) + P256_PRIME) % P256_PRIME;

	return left === right ? bytes : null;
}

/**
 * Whether two base64url spellings name the same key, so a padded value stored by one
 * app and an unpadded one from a browser compare equal.
 *
 * @param left - One key, base64url.
 * @param right - The other.
 */
export function sameKey(left: string, right: string): boolean {
	return trimPadding(left) === trimPadding(right);
}
