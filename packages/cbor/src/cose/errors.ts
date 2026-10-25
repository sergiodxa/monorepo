/**
 * The one error COSE key handling and COSE_Sign1 signing and verification report, with a
 * code to branch on, so a verifier can tell a forged signature from a message it cannot read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * What went wrong: a `malformed` message or key, an `unsupported-algorithm`, an
 * `unsupported-key` that cannot run the message's algorithm, a header listed in `crit` that
 * the verifier does not `understand` (`unknown-critical`), or an `invalid-signature`.
 */
export type COSEErrorCode =
	| "malformed"
	| "unsupported-algorithm"
	| "unsupported-key"
	| "unknown-critical"
	| "invalid-signature";

/** A COSE key or COSE_Sign1 failure. */
export class COSEError extends Error {
	override name = "COSEError";

	/** Which rule failed, so a caller can branch without reading `message`. */
	code: COSEErrorCode;

	/**
	 * @param code What went wrong
	 * @param message The failure in words
	 */
	constructor(code: COSEErrorCode, message: string) {
		super(message);
		this.code = code;
	}
}

/**
 * A header or key value as it reads in an error message: numbers and text as written, any
 * other CBOR value by its kind, so a message never prints `[object Object]`.
 */
export function describeValue(value: unknown): string {
	if (typeof value === "number" || typeof value === "bigint" || typeof value === "string") {
		return String(value);
	}
	if (value === undefined) return "(none)";
	return value === null ? "null" : typeof value;
}
