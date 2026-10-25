/**
 * The failure every function in this package returns: a neutral `code` that separates a
 * token the client must replace from an issuer that could not be reached, so an origin
 * decides whether to challenge again or let the request through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why a structure was refused or a redemption failed. `issuer-unavailable` is the only code
 * the client cannot fix; every other one answers a request with a fresh challenge.
 */
export type PrivacyPassErrorCode =
	| "invalid-challenge"
	| "missing-token"
	| "malformed-token"
	| "unsupported-token-type"
	| "invalid-key"
	| "unknown-key"
	| "invalid-signature"
	| "unknown-challenge"
	| "double-spend"
	| "issuer-unavailable";

/**
 * A refused structure or redemption, returned inside a `Failure`, never thrown.
 *
 * @example if (error.code === "issuer-unavailable") log.warn("privacy-pass.issuer", { cause: error.cause });
 */
export class PrivacyPassError extends Error {
	override name = "PrivacyPassError";

	/** The value to branch on. */
	readonly code: PrivacyPassErrorCode;

	/**
	 * @param code - The neutral reason
	 * @param message - What was wrong, for logs
	 * @param options - The underlying failure, when one caused this
	 */
	constructor(code: PrivacyPassErrorCode, message: string, options?: ErrorOptions) {
		super(message, options);
		this.code = code;
	}
}
