/**
 * The checks a browser's push subscription passes before it is stored: an endpoint the
 * reader's object may `POST` to, and key material the payload can be encrypted under.
 * A registration is the only way a URL reaches delivery, so this is where one is refused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url } from "@sdxc/crypto";
import { checkUrl } from "@sdxc/outbound";
import { isSuccess } from "@sdxc/result";

/** Bytes of an uncompressed P-256 point: the `0x04` prefix, then 32 bytes each of x and y. */
const P256_POINT_LENGTH = 65;

/** Bytes of the auth secret RFC 8291 has the user agent generate. */
const AUTH_SECRET_LENGTH = 16;

/** The prime the P-256 field is taken over. */
const P256_PRIME = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;

/** The `b` coefficient of P-256's curve, `y² = x³ − 3x + b`. */
const P256_B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn;

/**
 * Whether delivery may be addressed to `value`: an absolute `https:` URL, without
 * credentials, on a host the public internet reaches. Private, loopback, link-local and
 * reserved-suffix hosts all fail, which keeps the Worker's own network out of reach.
 */
export function isPushEndpoint(value: string): boolean {
	let checked = checkUrl(value);
	return isSuccess(checked) && checked.data.protocol === "https:";
}

/** The big-endian unsigned integer a run of bytes spells. */
function toBigInt(bytes: Uint8Array): bigint {
	let value = 0n;
	for (let byte of bytes) value = (value << 8n) | BigInt(byte);
	return value;
}

/**
 * Whether `value` is the base64url of an uncompressed P-256 point that lies on the curve,
 * which is exactly what the ECDH import during encryption accepts.
 */
export function isP256PublicKey(value: string): boolean {
	let decoded = Base64Url.decode(value);
	if (!isSuccess(decoded)) return false;

	let bytes = decoded.data;
	if (bytes.length !== P256_POINT_LENGTH || bytes[0] !== 0x04) return false;

	let x = toBigInt(bytes.subarray(1, 33));
	let y = toBigInt(bytes.subarray(33));
	if (x >= P256_PRIME || y >= P256_PRIME) return false;

	let left = (y * y) % P256_PRIME;
	let right = (((x * x * x - 3n * x + P256_B) % P256_PRIME) + P256_PRIME) % P256_PRIME;

	return left === right;
}

/** Whether `value` is the base64url of a 16-byte auth secret. */
export function isAuthSecret(value: string): boolean {
	let decoded = Base64Url.decode(value);
	return isSuccess(decoded) && decoded.data.length === AUTH_SECRET_LENGTH;
}
