/**
 * Hex, base64, and base64url codecs used by every other module in this package.
 *
 * Encoding differences (padding, letter case, URL-safe alphabet) turn into
 * interoperability bugs when each call site rewrites them, so all three codecs
 * live here, each with one canonical output shape and a validating decoder.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { BinaryLike, Bytes } from "./lib/bytes";

import { InvalidEncodingError } from "./errors";
import { toBytes, toText } from "./lib/bytes";

/** Lowercase hex digits; encoding always emits from this alphabet. */
const HEX_ALPHABET = "0123456789abcdef";

/** Hex strings must have an even length and only hex digits, either case. */
const HEX_PATTERN = /^(?:[0-9a-fA-F]{2})*$/;

/** Base64url payloads allow the URL-safe alphabet plus optional trailing padding. */
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*={0,2}$/;

/** Standard base64 payloads come in whole quartets, the last one padded to length. */
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Bytes a base64 group carries; a length off this multiple leaves a short final group. */
const GROUP_BYTES = 3;

/** Characters a full base64 group spans; one character past a multiple holds no whole byte. */
const GROUP_CHARS = 4;

/** ASCII code of `=`, the character that fills a short final group out to four. */
const PADDING_CODE = 0x3d;

/** Code points a reverse lookup covers, which spans every base64 character. */
const ASCII_RANGE = 128;

/** Standard base64 alphabet (RFC 4648 §4); a character's index is the value it carries. */
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** URL-safe base64 alphabet (RFC 4648 §5); a character's index is the value it carries. */
const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Builds an alphabet's reverse lookup: a string whose character at each ASCII code
 * point carries the six-bit value that code point stands for.
 *
 * Keying by code point resolves a character in a single `charCodeAt`, which keeps
 * decoding linear in the input length for multi-megabyte payloads.
 */
function toValueLookup(alphabet: string): string {
	let values = Array.from<string>({ length: ASCII_RANGE }).fill("\0");
	for (let value = 0; value < alphabet.length; value++) {
		values[alphabet.charCodeAt(value)] = String.fromCharCode(value);
	}
	return values.join("");
}

/** Reverse lookup for the standard alphabet, keyed by ASCII code point. */
const BASE64_VALUES = toValueLookup(BASE64_ALPHABET);

/** Reverse lookup for the URL-safe alphabet, keyed by ASCII code point. */
const BASE64URL_VALUES = toValueLookup(BASE64URL_ALPHABET);

/**
 * Encodes bytes over a base64 alphabet, one character per six bits of input.
 *
 * Characters land in a single buffer sized from the input length, so a
 * multi-megabyte payload encodes in one pass and one allocation.
 *
 * @param bytes Payload to encode.
 * @param alphabet Alphabet supplying a character for each six-bit value.
 * @param padded Whether a short final group is filled out to four characters with `=`.
 * @returns Encoded text.
 */
function encodeBase64(bytes: Uint8Array, alphabet: string, padded: boolean): string {
	let remainder = bytes.length % GROUP_BYTES;
	let tail = remainder === 0 ? 0 : padded ? GROUP_CHARS : remainder + 1;
	let out = new Uint8Array(((bytes.length - remainder) / GROUP_BYTES) * GROUP_CHARS + tail);

	let accumulator = 0;
	let pending = 0;
	let cursor = 0;

	for (let byte of bytes) {
		accumulator = (accumulator << 8) | byte;
		pending += 8;
		while (pending >= 6) {
			pending -= 6;
			out[cursor++] = alphabet.charCodeAt((accumulator >> pending) & 0x3f);
		}
	}

	if (pending > 0) out[cursor++] = alphabet.charCodeAt((accumulator << (6 - pending)) & 0x3f);
	while (cursor < out.length) out[cursor++] = PADDING_CODE;

	return toText(out);
}

/**
 * Decodes base64 text written in the alphabet a reverse lookup describes.
 *
 * The bits a short final group leaves over must be zero, which maps the strings of
 * each payload length one-to-one onto byte strings, so a text whose final character
 * was altered fails the decode.
 *
 * @param text Text whose character set the caller has already validated.
 * @param values Reverse lookup for the alphabet the text is written in.
 * @param encoding Encoding name the error reports.
 * @returns Decoded bytes, or `InvalidEncodingError` when the text is not the canonical encoding of any byte string.
 */
function decodeBase64(
	text: string,
	values: string,
	encoding: string,
): Result<Bytes, InvalidEncodingError> {
	let end = text.length;
	while (end > 0 && text.charCodeAt(end - 1) === PADDING_CODE) end--;

	let remainder = end % GROUP_CHARS;
	if (remainder === 1) return failure(new InvalidEncodingError(encoding));

	let groups = (end - remainder) / GROUP_CHARS;
	let bytes = new Uint8Array(groups * GROUP_BYTES + (remainder === 0 ? 0 : remainder - 1));

	let accumulator = 0;
	let pending = 0;
	let cursor = 0;

	for (let index = 0; index < end; index++) {
		accumulator = (accumulator << 6) | values.charCodeAt(text.charCodeAt(index));
		pending += 6;
		if (pending >= 8) {
			pending -= 8;
			bytes[cursor++] = (accumulator >> pending) & 0xff;
		}
	}

	if ((accumulator & ((1 << pending) - 1)) !== 0) {
		return failure(new InvalidEncodingError(encoding));
	}

	return success(bytes);
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
		return encodeBase64(toBytes(data), BASE64URL_ALPHABET, false);
	}

	/**
	 * Decodes base64url text, tolerating present or absent `=` padding.
	 *
	 * The URL-safe alphabet is the whole accepted input set, and a short final
	 * group's leftover bits must be zero, so two accepted strings decode to the same
	 * bytes exactly when they differ only in trailing `=`.
	 *
	 * @param text Base64url string to decode.
	 * @returns Decoded bytes, or `InvalidEncodingError` when the input is not canonical base64url.
	 * @example
	 * Base64Url.decode("aGk"); // success(bytes for "hi")
	 */
	static decode(text: string): Result<Bytes, InvalidEncodingError> {
		if (!BASE64URL_PATTERN.test(text)) return failure(new InvalidEncodingError("base64url"));
		return decodeBase64(text, BASE64URL_VALUES, "base64url");
	}
}

/**
 * Padded standard base64, the alphabet RFC 4648 §4 defines.
 *
 * @example
 * Base64.encode(new Uint8Array([251, 255])); // "+/8="
 */
export class Base64 {
	/**
	 * Encodes bytes (or UTF-8 text) as standard base64 with `=` padding.
	 *
	 * Text becomes its UTF-8 bytes first, so a payload outside Latin-1 encodes to
	 * the octets a peer decodes it back from, as the `user:password` credentials of
	 * HTTP Basic authentication require (RFC 7617 §2.1).
	 *
	 * @param data Payload to encode.
	 * @returns Base64 string over `A-Z`, `a-z`, `0-9`, `+`, `/`, padded to a multiple of four characters.
	 * @example
	 * Base64.encode("Aladdin:open sesame"); // "QWxhZGRpbjpvcGVuIHNlc2FtZQ=="
	 */
	static encode(data: BinaryLike): string {
		return encodeBase64(toBytes(data), BASE64_ALPHABET, true);
	}

	/**
	 * Decodes standard base64 text carrying its full `=` padding.
	 *
	 * The standard alphabet with full padding is the whole accepted input set, and a
	 * short final group's leftover bits must be zero, so one byte string has exactly
	 * one accepted spelling.
	 *
	 * @param text Base64 string to decode.
	 * @returns Decoded bytes, or `InvalidEncodingError` when the input is not canonical padded base64.
	 * @example
	 * Base64.decode("aGk="); // success(bytes for "hi")
	 */
	static decode(text: string): Result<Bytes, InvalidEncodingError> {
		if (!BASE64_PATTERN.test(text)) return failure(new InvalidEncodingError("base64"));
		return decodeBase64(text, BASE64_VALUES, "base64");
	}
}
