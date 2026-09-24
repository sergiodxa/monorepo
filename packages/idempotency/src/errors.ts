/**
 * The two failures the package reports: a key the client sent that the server cannot
 * accept, and a store that could not answer, which the middleware turns into a `503`
 * or an unprotected run depending on its failure policy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The `Idempotency-Key` value is not a non-empty sf-string Item (`invalid`), or it exceeds
 * the server's length bound (`too-long`). Either way the client has to change the key.
 */
export class IdempotencyKeyError extends Error {
	override name = "IdempotencyKeyError" as const;

	/** Which rule the key broke, so a response can say how to fix it. */
	readonly reason: "invalid" | "too-long";

	/**
	 * @param message - Human readable description of the failure
	 * @param reason - Which rule the key broke
	 * @param options - The underlying failure, when there is one
	 */
	constructor(message: string, reason: "invalid" | "too-long", options?: ErrorOptions) {
		super(message, options);
		this.reason = reason;
	}
}

/** The store could not be reached, or answered with a record it could not read back. */
export class IdempotencyStoreError extends Error {
	override name = "IdempotencyStoreError" as const;
}
