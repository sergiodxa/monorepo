/**
 * The failures Security Event Token delivery reports: the RFC 8935 error a recipient
 * answers or reports about a SET, a transmission that reached no verdict, and a key set
 * that could not be fetched, each telling the caller whether retrying can help.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityEvents } from "../../security-events.js";

/**
 * A SET the recipient refused, with an RFC 8935 §2.4 error code and a description in
 * English. A recipient answers it as a `400` JSON body; a poll recipient reports it in
 * `setErrs`. Retrying the same SET fails the same way, except for `authentication_failed`
 * and `access_denied`, which fresh credentials can fix.
 *
 * @example return setRejected(new SecurityEventError("access_denied", "Not subscribed to this issuer"));
 */
export class SecurityEventError extends Error {
	override name = "SecurityEventError";

	readonly code: SecurityEvents.ErrorCode;

	/** The human-readable reason, sent to the transmitter as `description`. */
	readonly description: string;

	/**
	 * @param code - The error code a transmitter acts on
	 * @param description - Diagnostic text, safe to show the transmitter
	 */
	constructor(code: SecurityEvents.ErrorCode, description: string) {
		super(`${code}: ${description}`);
		this.code = code;
		this.description = description;
	}

	/**
	 * The error as RFC 8935 §2.3 writes it on the wire.
	 *
	 * @returns The `err` and `description` members
	 */
	toJSON(): SecurityEvents.ErrorBody {
		return { err: this.code, description: this.description };
	}
}

/**
 * A request that reached no verdict on the SETs it carried: the network failed, or the
 * other side answered a status the delivery method does not define, or a body it cannot
 * read. Retrying later may succeed.
 */
export class TransmissionError extends Error {
	override name = "TransmissionError";

	/** The status the other side answered, or `null` when no response arrived. */
	readonly status: number | null;

	/**
	 * @param message - What went wrong
	 * @param status - The response status, when there was one
	 * @param cause - The underlying failure, kept for diagnostics
	 */
	constructor(message: string, status: number | null, cause?: unknown) {
		super(message, { cause });
		this.status = status;
	}
}

/**
 * The issuer's key set could not be read, so the SET is neither valid nor invalid yet. A
 * push recipient answers `503` so the transmitter retries; a poll recipient leaves the SET
 * unacknowledged so it is delivered again.
 */
export class KeysUnavailableError extends Error {
	override name = "KeysUnavailableError";

	/** @param cause - The failure the key lookup raised */
	constructor(cause?: unknown) {
		super("The issuer's keys could not be read", { cause });
	}
}
