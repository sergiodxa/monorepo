/**
 * Standard base64, the alphabet the Standard Webhooks specification writes
 * signatures and secrets in, built on the package-wide base64url codec.
 *
 * Encoding emits `+`, `/`, and `=` padding so any receiver library reads the
 * signatures produced here; decoding accepts both alphabets and optional padding,
 * because senders and secret generators are not consistent about either.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BinaryLike, Bytes, InvalidEncodingError } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { Base64Url } from "@sdxc/crypto";

/** Characters per base64 group; the remainder decides how much padding is added. */
const GROUP_SIZE = 4;

/**
 * Encodes bytes (or UTF-8 text) as padded standard base64.
 *
 * @param data Payload to encode.
 * @returns Base64 string over `A-Z`, `a-z`, `0-9`, `+`, `/`, padded to a multiple of four.
 * @example
 * encodeBase64(new Uint8Array([251, 255])); // "+/8="
 */
export function encodeBase64(data: BinaryLike): string {
	let unpadded = Base64Url.encode(data).replaceAll("-", "+").replaceAll("_", "/");
	let remainder = unpadded.length % GROUP_SIZE;
	if (remainder === 0) return unpadded;
	return unpadded + "=".repeat(GROUP_SIZE - remainder);
}

/**
 * Decodes base64 text written in either the standard or the URL-safe alphabet.
 *
 * Both alphabets are accepted because a signature or secret can arrive in either,
 * and the bytes are what gets compared; padding may be present or absent.
 *
 * @param text Base64 or base64url string.
 * @returns Decoded bytes, or `InvalidEncodingError` when the text is neither.
 * @example
 * decodeBase64("+/8="); // success(Uint8Array [251, 255])
 */
export function decodeBase64(text: string): Result<Bytes, InvalidEncodingError> {
	return Base64Url.decode(text.replaceAll("+", "-").replaceAll("/", "_"));
}
