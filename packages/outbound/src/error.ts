/**
 * The one failure every check, walk and read in this package answers with: a code a
 * caller maps to its own error, the URL it concerns, and whether asking again later
 * can change the outcome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why an outbound request was refused or failed. Each `refused-*` code is decided
 * before a request leaves; `timeout` and `network` are the only outcomes a retry can
 * change.
 */
export type OutboundErrorCode =
	| "invalid-url"
	| "refused-scheme"
	| "refused-credentials"
	| "refused-port"
	| "refused-host"
	| "refused-address"
	| "too-many-redirects"
	| "too-large"
	| "timeout"
	| "network";

/** The codes a later attempt can clear: the deadline and the transport. */
const RETRYABLE_CODES = new Set<OutboundErrorCode>(["timeout", "network"]);

/** Returned inside a `Failure` by every function in this package, never thrown. */
export class OutboundError extends Error {
	override name = "OutboundError";

	/** Machine-readable cause, for a caller that maps it to its own error type. */
	readonly code: OutboundErrorCode;

	/**
	 * The URL the failure concerns: the hop that was refused or failed, the input text
	 * for `invalid-url`, or an empty string for a body whose message carries no URL.
	 */
	readonly url: string;

	/**
	 * @param code - Why the request was refused or failed.
	 * @param url - The URL it concerns.
	 * @param message - The explanation a log shows.
	 * @param options - The underlying error, when one was thrown.
	 */
	constructor(code: OutboundErrorCode, url: string, message: string, options?: ErrorOptions) {
		super(message, options);
		this.code = code;
		this.url = url;
	}

	/** Whether asking again later can succeed, which holds only for `timeout` and `network`. */
	get retryable(): boolean {
		return RETRYABLE_CODES.has(this.code);
	}
}

/**
 * Classifies a thrown value from `fetch` or a body stream: a deadline reports itself
 * as a `TimeoutError`, a capped body errors with its own `OutboundError`, and every
 * other rejection is the transport's.
 *
 * @param url - The URL the failure concerns.
 * @param error - What was thrown.
 */
export function failedWith(url: string, error: unknown): OutboundError {
	if (error instanceof OutboundError) return error;

	let reason = error instanceof Error ? error.message : String(error);
	let label = url === "" ? "the body" : url;

	if (isTimeout(error)) {
		return new OutboundError("timeout", url, `Timed out reading ${label}`, { cause: error });
	}

	return new OutboundError("network", url, `Failed to read ${label}: ${reason}`, {
		cause: error,
	});
}

/** Whether a thrown value is a deadline's reason, which a `DOMException` carries by name. */
function isTimeout(error: unknown): boolean {
	return (
		typeof error === "object" && error !== null && "name" in error && error.name === "TimeoutError"
	);
}
