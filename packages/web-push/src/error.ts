/**
 * The one failure every send, request and subscription check answers with: a code an
 * app maps to what it does with the stored subscription, and whether a later attempt
 * can succeed. It names the push service's host only, since an endpoint is a credential.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why a push failed. The `invalid-*` codes and `payload-too-large` are decided before
 * any request; `gone` asks the app to delete the subscription; `rate-limited`,
 * `unavailable`, `timeout` and `network` are the codes a retry can clear.
 */
export type WebPushErrorCode =
	| "invalid-subscription"
	| "invalid-vapid"
	| "invalid-options"
	| "payload-too-large"
	| "gone"
	| "unauthorized"
	| "rejected"
	| "rate-limited"
	| "unavailable"
	| "timeout"
	| "network";

/** The codes a later attempt can clear. */
const RETRYABLE_CODES: ReadonlySet<WebPushErrorCode> = new Set<WebPushErrorCode>([
	"rate-limited",
	"unavailable",
	"timeout",
	"network",
]);

/** What a failure states when it is constructed. */
export interface WebPushErrorOptions extends ErrorOptions {
	code: WebPushErrorCode;
	/** The push service's host, which is the most of an endpoint an error may name. */
	host?: string | null;
	/** The HTTP status, when the push service answered. */
	status?: number | null;
	/** Milliseconds the push service asked the caller to wait. */
	retryAfter?: number | null;
}

/**
 * Returned inside a `Failure` by every operation in this package, never thrown.
 *
 * @example if (isFailure(sent) && sent.error.code === "gone") await deleteSubscription(row.id);
 */
export class WebPushError extends Error {
	override name = "WebPushError";

	readonly code: WebPushErrorCode;

	/** The push service's host, or `null` when the endpoint did not parse. */
	readonly host: string | null;

	/** The HTTP status, or `null` when no response arrived. */
	readonly status: number | null;

	/** Milliseconds to wait from `Retry-After`; `null` leaves the delay to the caller's backoff. */
	readonly retryAfter: number | null;

	/**
	 * @param message - What went wrong, in words a log line can use as is.
	 * @param options - The code, host, status and delay.
	 */
	constructor(message: string, options: WebPushErrorOptions) {
		super(message, options);
		this.code = options.code;
		this.host = options.host ?? null;
		this.status = options.status ?? null;
		this.retryAfter = options.retryAfter ?? null;
	}

	/**
	 * Whether a later attempt can succeed. A push service has no idempotency key, so a
	 * retry after a `timeout` whose request did land shows the notification twice.
	 */
	get retryable(): boolean {
		return RETRYABLE_CODES.has(this.code);
	}
}
