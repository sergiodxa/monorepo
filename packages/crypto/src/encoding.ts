/**
 * Hex and base64url codecs used by every other module in this package.
 *
 * Encoding differences (padding, letter case, URL-safe alphabet) turn into
 * interoperability bugs when each call site rewrites them, so both codecs live
 * here with one canonical output shape and a lenient, validating decoder.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";

import type { BinaryLike, Bytes } from "./lib/bytes";

import { InvalidEncodingError } from "./errors";
import { toBytes } from "./lib/bytes";

/** Lowercase hex digits; encoding always emits from this alphabet. */
const HEX_ALPHABET = "0123456789abcdef";

/** Hex strings must have an even length and only hex digits, either case. */
const HEX_PATTERN = /^(?:[0-9a-fA-F]{2})*$/;

/** Base64url payloads allow the URL-safe alphabet plus optional trailing padding. */
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*={0,2}$/;

/** Bytes converted per `String.fromCharCode` call, to stay under argument limits. */
const CHUNK_SIZE = 0x8000;

/**
 * Builds the binary string `btoa` expects, in chunks so large inputs are safe.
 *
 * Spreading a whole multi-megabyte array into `String.fromCharCode` overflows the
 * call stack, so the conversion walks the bytes in fixed windows instead.
 */
function toBinaryString(bytes: Uint8Array): string {
	let parts: string[] = [];
	for (let index = 0; index < bytes.length; index += CHUNK_SIZE) {
		parts.push(String.fromCharCode(...bytes.subarray(index, index + CHUNK_SIZE)));
	}
	return parts.join("");
}

/**
 * Lowercase hexadecimal encoding, the canonical text form for digests and MACs.
 *
 * @example
 * Hex.encode(new Uint8Array([255, 0])); // "ff00"
 */
export class Hex {
	/**
	 * Encodes bytes (or UTF-8 text) as lowercase hex.
	 *
	 * @param data Payload to encode.
	 * @returns Hex string, two characters per byte, never padded or uppercased.
	 * @example
	 * Hex.encode("hi"); // "6869"
	 */
	static encode(data: BinaryLike): string {
		let bytes = toBytes(data);
		let out = "";
		for (let byte of bytes) {
			out += HEX_ALPHABET.charAt(byte >> 4);
			out += HEX_ALPHABET.charAt(byte & 0x0f);
		}
		return out;
	}

	/**
	 * Decodes a hex string, accepting either letter case.
	 *
	 * An odd length or a non-hex character rejects the whole input up front, so a
	 * truncated signature always fails verification against a prefix.
	 *
	 * @param text Hex string to decode.
	 * @returns Decoded bytes, or `InvalidEncodingError` when the input is not hex.
	 * @example
	 * Hex.decode("ff00"); // success(Uint8Array [255, 0])
	 */
	static decode(text: string): Result<Bytes, InvalidEncodingError> {
		if (!HEX_PATTERN.test(text)) return failure(new InvalidEncodingError("hex"));

		let bytes = new Uint8Array(text.length / 2);
		for (let index = 0; index < bytes.length; index++) {
			bytes[index] = Number.parseInt(text.slice(index * 2, index * 2 + 2), 16);
		}

		return success(bytes);
	}
}

/**
 * Unpadded base64url encoding, safe in URLs, headers, and file names.
 *
 * @example
 * Base64Url.encode(new Uint8Array([251, 255])); // "-_8"
 */
export class Base64Url {
	/**
	 * Encodes bytes (or UTF-8 text) as base64url without `=` padding.
	 *
	 * Padding is dropped because these values travel in URLs and query strings,
	 * where `=` needs escaping; `decode` accepts it back either way.
	 *
	 * @param data Payload to encode.
	 * @returns Base64url string using only `A-Z`, `a-z`, `0-9`, `-`, and `_`.
	 * @example
	 * Base64Url.encode("hi"); // "aGk"
	 */
	static encode(data: BinaryLike): string {
		return btoa(toBinaryString(toBytes(data)))
			.replaceAll("+", "-")
			.replaceAll("/", "_")
			.replaceAll("=", "");
	}

	/**
	 * Decodes base64url text, tolerating present or absent `=` padding.
	 *
	 * Standard base64 (`+`/`/`) is rejected: accepting both alphabets would make
	 * two different strings decode to the same bytes, which defeats comparisons.
	 *
	 * @param text Base64url string to decode.
	 * @returns Decoded bytes, or `InvalidEncodingError` when the input is not base64url.
	 * @example
	 * Base64Url.decode("aGk"); // success(bytes for "hi")
	 */
	static decode(text: string): Result<Bytes, InvalidEncodingError> {
		if (!BASE64URL_PATTERN.test(text)) return failure(new InvalidEncodingError("base64url"));

		let normalized = text.replaceAll("-", "+").replaceAll("_", "/").replace(/=+$/, "");
		let padding = normalized.length % 4;
		if (padding === 1) return failure(new InvalidEncodingError("base64url"));
		if (padding > 0) normalized += "=".repeat(4 - padding);

		try {
			let binary = atob(normalized);
			let bytes = new Uint8Array(binary.length);
			for (let index = 0; index < binary.length; index++) {
				bytes[index] = binary.charCodeAt(index);
			}
			return success(bytes);
		} catch {
			return failure(new InvalidEncodingError("base64url"));
		}
	}
}
