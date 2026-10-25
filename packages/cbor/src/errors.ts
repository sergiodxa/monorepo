/**
 * The one error decoding and encoding report, with a code to branch on and, for a decode
 * failure, the byte offset of the item that failed so a caller can point at the bad input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * What went wrong. Decoding: `truncated` input, a `malformed` item, `trailing-bytes` after the
 * item, a `duplicate-key` in a map, a `limit-exceeded` on depth or item count, or an encoding
 * `not-deterministic` when that was required. Encoding: an `unencodable` value or a `duplicate-key`.
 */
export type CBORErrorCode =
	| "truncated"
	| "malformed"
	| "trailing-bytes"
	| "duplicate-key"
	| "limit-exceeded"
	| "not-deterministic"
	| "unencodable";

/** A CBOR decoding or encoding failure. */
export class CBORError extends Error {
	override name = "CBORError";

	/** Which rule failed, so a caller can branch without reading `message`. */
	code: CBORErrorCode;

	/** Byte offset of the item that failed to decode; `undefined` for an encoding failure. */
	offset: number | undefined;

	/**
	 * @param code What went wrong
	 * @param message The failure in words
	 * @param offset Byte offset of the failing item, for a decoding failure
	 */
	constructor(code: CBORErrorCode, message: string, offset?: number) {
		super(offset === undefined ? message : `${message} at byte ${offset}`);
		this.code = code;
		this.offset = offset;
	}
}
