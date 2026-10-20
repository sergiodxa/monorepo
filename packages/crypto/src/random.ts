/**
 * Cryptographically strong random bytes and the strings built from them.
 *
 * `randomToken` is the URL-safe default for secrets; `randomString` is for a
 * caller-chosen alphabet (CSRF cookies, honeypot field names) where base64url
 * would change an existing format.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "./lib/bytes.js";

import { Base64Url } from "./encoding.js";

/** Largest buffer `crypto.getRandomValues` fills in a single call. */
const MAX_RANDOM_BYTES = 65536;

/** Entropy used when a caller does not pick a size: 256 bits. */
const DEFAULT_TOKEN_BYTES = 32;

/** Character count used when a caller does not pick a length. */
const DEFAULT_STRING_LENGTH = 32;

/**
 * Default alphabet for {@link randomString}: A–Z, a–z, 0–9, no punctuation.
 * Callers that need symbols (or a smaller set) pass `alphabet` explicitly.
 */
const DEFAULT_STRING_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Character joining a token prefix to its random part. */
const PREFIX_SEPARATOR = "_";

/**
 * Fills a new buffer with cryptographically strong random bytes.
 *
 * @param size Number of bytes to generate; must be an integer in 0..65536.
 * @returns A fresh buffer of exactly `size` random bytes.
 * @throws {RangeError} If `size` is not an integer within the range the runtime can fill.
 * @example
 * let iv = randomBytes(12);
 */
export function randomBytes(size: number): Bytes {
	if (!Number.isInteger(size) || size < 0 || size > MAX_RANDOM_BYTES) {
		throw new RangeError(`randomBytes size must be an integer between 0 and ${MAX_RANDOM_BYTES}`);
	}

	return crypto.getRandomValues(new Uint8Array(size));
}

/**
 * Types for `randomToken`.
 */
export namespace randomToken {
	/** Token shape and entropy. */
	export interface Options {
		/**
		 * Bytes of entropy behind the token.
		 * @default 32
		 */
		bytes?: number;
		/**
		 * Prefix joined with `_`, so a leaked key is searchable and attributable.
		 * @example "sk"
		 */
		prefix?: string;
	}
}

/**
 * Generates a URL-safe random token, optionally namespaced by a prefix.
 *
 * Unpadded base64url avoids escaping in a URL, header, or file name; the
 * prefix lets a leaked token be recognized and revoked by kind.
 *
 * @param options Entropy and prefix.
 * @returns The token, as `<prefix>_<random>` when a prefix is given.
 * @throws {RangeError} If `options.bytes` is not an integer the runtime can fill.
 * @example
 * randomToken({ bytes: 32, prefix: "sk" }); // "sk_9f1...".
 */
export function randomToken(options: randomToken.Options = {}): string {
	let token = Base64Url.encode(randomBytes(options.bytes ?? DEFAULT_TOKEN_BYTES));
	if (!options.prefix) return token;
	return `${options.prefix}${PREFIX_SEPARATOR}${token}`;
}

/**
 * Types for `randomString`.
 */
export namespace randomString {
	/** Output length and the alphabet to sample from. */
	export interface Options {
		/**
		 * Number of characters to return.
		 * @default 32
		 */
		length?: number;
		/**
		 * Characters to sample from uniformly. Length must be 1..256; a repeated
		 * character raises that character's odds relative to the others.
		 * @default "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
		 */
		alphabet?: string;
	}
}

/**
 * Draws a string of the requested length by sampling an alphabet uniformly.
 *
 * Uses rejection sampling over `crypto.getRandomValues` so every alphabet index
 * is equally likely. Prefer {@link randomToken} for URL-safe secrets; reach for
 * this when an existing format requires a custom character set.
 *
 * @param options Length and alphabet; both optional.
 * @returns Exactly `options.length` characters drawn from the alphabet.
 * @throws {RangeError} If `length` is not an integer in 0..65536, or `alphabet` is empty or longer than 256 characters.
 * @example
 * randomString({ length: 10, alphabet: "abcdef" });
 */
export function randomString(options: randomString.Options = {}): string {
	let length = options.length ?? DEFAULT_STRING_LENGTH;
	let alphabet = options.alphabet ?? DEFAULT_STRING_ALPHABET;

	if (!Number.isInteger(length) || length < 0 || length > MAX_RANDOM_BYTES) {
		throw new RangeError(
			`randomString length must be an integer between 0 and ${MAX_RANDOM_BYTES}`,
		);
	}

	let alphabetSize = alphabet.length;
	if (alphabetSize === 0 || alphabetSize > 256) {
		throw new RangeError("randomString alphabet must contain between 1 and 256 characters");
	}

	if (length === 0) return "";

	let rejectionCeiling = 256 - (256 % alphabetSize);
	let characters = "";

	while (characters.length < length) {
		let candidates = randomBytes(length - characters.length);

		for (let byte of candidates) {
			if (byte >= rejectionCeiling) continue;
			characters += alphabet[byte % alphabetSize];
			if (characters.length === length) break;
		}
	}

	return characters;
}
