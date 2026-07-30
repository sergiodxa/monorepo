/**
 * Cryptographically strong random bytes and the tokens built from them.
 *
 * `randomToken` is the shape most secrets in the repository need: enough entropy
 * to be unguessable, base64url so it survives URLs and headers, and an optional
 * prefix that makes a leaked key greppable and revocable by kind.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "./lib/bytes";

import { Base64Url } from "./encoding";

/** Largest buffer `crypto.getRandomValues` fills in a single call. */
const MAX_RANDOM_BYTES = 65536;

/** Entropy used when a caller does not pick a size: 256 bits. */
const DEFAULT_TOKEN_BYTES = 32;

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
 * The random part is unpadded base64url, so the token needs no escaping in a URL,
 * a header, or a file name. The prefix is not entropy: it exists so a token found
 * in a log can be recognized and revoked by kind.
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
