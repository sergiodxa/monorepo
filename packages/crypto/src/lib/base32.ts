/**
 * RFC 4648 base32 codec, kept internal to serve TOTP secrets.
 *
 * Authenticator apps and `otpauth://` URIs only speak base32, so shared secrets
 * need this alphabet even though the rest of the package standardizes on hex and
 * base64url for its public encoding surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { InvalidEncodingError } from "../errors.js";

import type { Bytes } from "./bytes.js";

/** RFC 4648 base32 alphabet, uppercase and without the padding character. */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Bits contributed by one base32 character. */
const BITS_PER_CHAR = 5;

/** Bits in one byte, the width drained from the accumulator per output byte. */
const BITS_PER_BYTE = 8;

/**
 * Encodes bytes as unpadded uppercase base32.
 *
 * Padding is omitted because authenticator apps reject or mangle `=` inside the
 * `secret` parameter of an enrollment URI.
 *
 * @param bytes Secret material to encode.
 * @returns Base32 string over `A-Z` and `2-7`.
 */
export function encode(bytes: Uint8Array): string {
	let out = "";
	let buffer = 0;
	let bits = 0;

	for (let byte of bytes) {
		buffer = (buffer << BITS_PER_BYTE) | byte;
		bits += BITS_PER_BYTE;
		while (bits >= BITS_PER_CHAR) {
			bits -= BITS_PER_CHAR;
			out += BASE32_ALPHABET.charAt((buffer >> bits) & 0x1f);
		}
	}

	if (bits > 0) out += BASE32_ALPHABET.charAt((buffer << (BITS_PER_CHAR - bits)) & 0x1f);

	return out;
}

/**
 * Decodes base32 text, ignoring case, padding, and separating whitespace.
 *
 * Users retype secrets by hand and apps present them in spaced groups; any other
 * character fails, so a typo never silently decodes differently.
 *
 * @param text Base32 string to decode.
 * @returns Decoded bytes, or `InvalidEncodingError` when a character is invalid.
 */
export function decode(text: string): Result<Bytes, InvalidEncodingError> {
	let normalized = text.replaceAll(/[\s-]/g, "").replace(/=+$/, "").toUpperCase();
	let bytes: number[] = [];
	let buffer = 0;
	let bits = 0;

	for (let char of normalized) {
		let value = BASE32_ALPHABET.indexOf(char);
		if (value === -1) return failure(new InvalidEncodingError("base32"));

		buffer = (buffer << BITS_PER_CHAR) | value;
		bits += BITS_PER_CHAR;

		if (bits >= BITS_PER_BYTE) {
			bits -= BITS_PER_BYTE;
			bytes.push((buffer >> bits) & 0xff);
		}
	}

	return success(new Uint8Array(bytes));
}
