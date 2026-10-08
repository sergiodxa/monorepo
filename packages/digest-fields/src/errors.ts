/**
 * The one failure every function in this package answers with, carrying a code a caller
 * branches on, so a missing field, a malformed one and a body that does not match stay
 * distinguishable without parsing messages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why a digest field could not be read, written or verified. `mismatch` is the only code
 * that says the content changed; every other code is about the field itself.
 */
export type DigestErrorCode =
	| "missing"
	| "malformed"
	| "invalid"
	| "unsupported-algorithm"
	| "mismatch"
	| "crypto";

/** Returned inside a `Failure` by every function in this package, never thrown. */
export class DigestError extends Error {
	override name = "DigestError";

	/** Machine-readable cause, for a caller that maps it to its own error or status. */
	readonly code: DigestErrorCode;

	/**
	 * @param code - Why the field failed.
	 * @param message - The explanation a log shows.
	 * @param options - The underlying error, when one was raised.
	 */
	constructor(code: DigestErrorCode, message: string, options?: ErrorOptions) {
		super(message, options);
		this.code = code;
	}
}
