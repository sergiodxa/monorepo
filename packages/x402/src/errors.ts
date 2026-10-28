/**
 * Typed failures for header codecs and facilitator calls, so a seller branches on
 * `code` instead of string-matching messages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Stable codes a caller can switch on. */
export type X402ErrorCode =
	| "invalid_header"
	| "invalid_payload"
	| "facilitator_unreachable"
	| "facilitator_rejected"
	| "settlement_failed";

/**
 * One x402 failure. `code` is stable; `message` is for logs and problem details.
 */
export class X402Error extends Error {
	/** Discriminator for Result failures. */
	override name = "X402Error";

	/**
	 * @param code - Stable machine code
	 * @param message - Human description for logs
	 */
	constructor(
		readonly code: X402ErrorCode,
		message: string,
	) {
		super(message);
	}
}
