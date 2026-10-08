/**
 * The one failure every destination answers with: a code an app branches on, the
 * provider and host it concerns, and whether a later attempt can succeed. It never
 * carries a webhook URL or a token, since either is a credential.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why a send failed. `gone` asks the app to stop sending to the destination and tell
 * its owner; `rate-limited`, `unavailable`, `timeout` and `network` are the codes a
 * retry can clear.
 */
export type MessagingErrorCode =
	| "invalid-message"
	| "invalid-destination"
	| "invalid-ref"
	| "unauthorized"
	| "gone"
	| "outside-window"
	| "rejected"
	| "rate-limited"
	| "unavailable"
	| "timeout"
	| "network";

/** The codes a later attempt can clear. */
const RETRYABLE_CODES: ReadonlySet<MessagingErrorCode> = new Set<MessagingErrorCode>([
	"rate-limited",
	"unavailable",
	"timeout",
	"network",
]);

/** What a provider states about a failure when it constructs the error. */
export interface MessagingErrorOptions extends ErrorOptions {
	code: MessagingErrorCode;
	provider: string;
	/** The host the request went to, which is the most of a destination an error may name. */
	host?: string | null;
	/** The HTTP status, when the platform answered. */
	status?: number | null;
	/** Milliseconds the platform asked the caller to wait. */
	retryAfter?: number | null;
}

/**
 * Returned inside a `Failure` by every send, never thrown.
 *
 * @example failure(new MessagingError("Slack answered no_service", { code: "gone", provider: "slack-webhook" }));
 */
export class MessagingError extends Error {
	override name = "MessagingError";

	readonly code: MessagingErrorCode;

	/** The provider that failed, as its `Destination.provider` names it. */
	readonly provider: string;

	readonly host: string | null;

	/** The HTTP status, or `null` when no response arrived. */
	readonly status: number | null;

	/**
	 * Milliseconds to wait before the next attempt, from `Retry-After` or the body's
	 * `retry_after`; `null` leaves the delay to the caller's backoff.
	 */
	readonly retryAfter: number | null;

	/**
	 * @param message - What went wrong, in words a log line can use as is.
	 * @param options - The code, provider, host, status and delay.
	 */
	constructor(message: string, options: MessagingErrorOptions) {
		super(message, options);
		this.code = options.code;
		this.provider = options.provider;
		this.host = options.host ?? null;
		this.status = options.status ?? null;
		this.retryAfter = options.retryAfter ?? null;
	}

	/**
	 * Whether a later attempt can succeed. A chat platform has no idempotency key, so a
	 * retry after a `timeout` whose request did land posts the message twice.
	 */
	get retryable(): boolean {
		return RETRYABLE_CODES.has(this.code);
	}
}
