/**
 * The error a provider throws when throwing is the only option left, carrying
 * the code the client would otherwise have had to guess at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ErrorCode } from "../core/error.js";

/**
 * An error with an evaluation error code on it. Resolvers answer with a details
 * structure instead, so this is for `initialize`, which signals failure by
 * rejecting, and for a provider written elsewhere that throws from a resolver:
 * the client reads `code` off it rather than reporting `GENERAL`.
 *
 * @example throw new ProviderError("PROVIDER_FATAL", "The flag service refused the key.");
 */
export class ProviderError extends Error {
	override name = "ProviderError";

	readonly code: ErrorCode;

	constructor(code: ErrorCode, message: string = code, options?: ErrorOptions) {
		super(message, options);
		this.code = code;
	}
}
