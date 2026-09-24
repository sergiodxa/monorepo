/**
 * The types and errors both halves of WebSub share, so a subscriber and a publisher built on
 * this package agree on what a failed hub request or a refused signature looks like. The
 * protocol itself lives in `./subscriber` and `./publisher`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The hash a hub signed a delivery with, as `X-Hub-Signature` names it. The hub picks it and
 * the subscriber has no field to ask for one, so a verifier accepts all four by default.
 */
export type SignatureAlgorithm = "sha1" | "sha256" | "sha384" | "sha512";

/**
 * A request to a hub failed or was refused before it went out: an invalid hub or callback, a
 * secret past the limit, a network failure or timeout, or a status other than the one expected.
 */
export class WebSubRequestError extends Error {
	override name = "WebSubRequestError";

	/** The status the hub answered with; `null` when no response arrived or no request was sent. */
	status: number | null;

	/**
	 * @param message - What went wrong, naming the hub.
	 * @param status - The status the hub answered with, when it answered.
	 */
	constructor(message: string, status: number | null = null) {
		super(message);
		this.status = status;
	}
}

/** A verification request is missing a field WebSub requires, or carries an unknown mode. */
export class WebSubVerificationError extends Error {
	override name = "WebSubVerificationError";
}

/**
 * A delivery's signature is missing, malformed, of a refused algorithm or wrong, or its body
 * exceeded the size read. `reason` is what a caller logs; the response stays `received()`.
 */
export class WebSubSignatureError extends Error {
	override name = "WebSubSignatureError";

	/** Which check refused the delivery. */
	reason: WebSubSignatureError.Reason;

	/**
	 * @param message - What went wrong.
	 * @param reason - Which check refused the delivery.
	 */
	constructor(message: string, reason: WebSubSignatureError.Reason) {
		super(message);
		this.reason = reason;
	}
}

/** Types attached to {@link WebSubSignatureError}. */
export namespace WebSubSignatureError {
	/** The check a refused delivery failed. */
	export type Reason = "missing" | "malformed" | "algorithm" | "mismatch" | "too-large";
}
