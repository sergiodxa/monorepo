/**
 * The one failure every function in this package answers with. Its code says which check
 * failed, so an inbox can answer `401` for any of them and still log why, and a sender
 * can tell a scheme mismatch from a bad key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why a request could not be signed or verified:
 *
 * - `unsigned`: neither `Signature-Input` nor a cavage `Signature` is present.
 * - `malformed`: a signature field, a covered component or a parameter breaks its grammar.
 * - `insufficient-coverage`: the signature leaves out the method, the target, the host, a
 *   time, or the body digest.
 * - `missing-component`: a covered component is absent from the request.
 * - `unsupported-component`: a covered component this package cannot derive for a request.
 * - `digest-mismatch`: the body differs from the covered digest field, or that field is unusable.
 * - `stale-signature`: `created`/`Date` is older than `maxAge`, in the future, or past `expires`.
 * - `key-unavailable`: the key lookup failed or found no key.
 * - `unsupported-algorithm`: the algorithm is unknown or does not fit the key.
 * - `invalid-signature`: the signature does not verify with the key.
 * - `crypto`: the runtime refused a Web Crypto operation while signing.
 */
export type HttpSignatureErrorCode =
	| "unsigned"
	| "malformed"
	| "insufficient-coverage"
	| "missing-component"
	| "unsupported-component"
	| "digest-mismatch"
	| "stale-signature"
	| "key-unavailable"
	| "unsupported-algorithm"
	| "invalid-signature"
	| "crypto";

/** Returned inside a `Failure` by every function in this package, never thrown. */
export class HttpSignatureError extends Error {
	override name = "HttpSignatureError";

	/** Machine-readable cause, for a caller that maps it to a status or its own error. */
	readonly code: HttpSignatureErrorCode;

	/**
	 * @param code - Which check failed.
	 * @param message - The explanation a log shows.
	 * @param options - The underlying error, when one was raised.
	 */
	constructor(code: HttpSignatureErrorCode, message: string, options?: ErrorOptions) {
		super(message, options);
		this.code = code;
	}
}
