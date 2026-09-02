/**
 * The single failure type every billing call reports: one normalized code, the
 * platform's own code kept beside it, and whether a retry is safe. It is the
 * error inside every `Result` the contract returns, so no billing path throws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Normalized reason a billing call failed. A caller branches on this; the
 * platform's own code travels alongside for logs and support tickets.
 */
export type BillingErrorCode =
	| "not_found"
	| "invalid_request"
	| "unauthenticated"
	| "forbidden"
	| "conflict"
	| "rate_limited"
	/** The platform answered `2xx` in a shape these models cannot express. */
	| "invalid_response"
	/** The platform cannot do this at all. */
	| "unsupported"
	/** This provider has not implemented it yet. */
	| "not_implemented"
	/** A timeout or 5xx: the operation may or may not have taken effect. */
	| "unknown";

/**
 * Codes a retry can safely resolve. Every other code either describes a
 * request a retry would repeat verbatim or an outcome nobody knows yet.
 */
const RETRYABLE_CODES: ReadonlySet<BillingErrorCode> = new Set<BillingErrorCode>(["rate_limited"]);

/** What a provider states about a failure when it constructs the error. */
export interface BillingErrorOptions extends ErrorOptions {
	code: BillingErrorCode;
	/** The configured credential set the call was made against. */
	connection: string;
	/** The platform's own code, when the response carried one. */
	providerCode?: string | null;
	/**
	 * Whether the same call can be repeated safely. Omitted lets the code decide,
	 * which is the answer a provider rarely needs to override.
	 */
	retryable?: boolean;
	/** Seconds the platform asked the caller to wait, when it named a delay. */
	retryAfter?: number | null;
}

/**
 * Failure carried by every billing `Result`. `unknown` is the correctness-critical
 * code: the operation may have taken effect, so recovery is a reconciliation
 * against the platform.
 *
 * @example
 * failure(new BillingError("No such customer", { code: "not_found", connection: "polar" }));
 */
export class BillingError extends Error {
	override name = "BillingError";

	readonly code: BillingErrorCode;

	/** The configured credential set the failing call was made against. */
	readonly connection: string;

	/** The platform's own code, for logs and support tickets. */
	readonly providerCode: string | null;

	/**
	 * Whether repeating the call is safe. Always `false` for `unknown`, because a
	 * retry of an operation that may already have taken effect duplicates it.
	 */
	readonly retryable: boolean;

	/**
	 * Seconds to wait before repeating the call, from the platform's own
	 * `Retry-After`; `null` when it named none, which leaves the backoff to the
	 * caller.
	 */
	readonly retryAfter: number | null;

	/**
	 * Creates a billing error.
	 *
	 * @param message - What went wrong, in terms a log line can use directly.
	 * @param options - The normalized code, the connection, and the platform's own code.
	 */
	constructor(message: string, options: BillingErrorOptions) {
		super(message, options);

		this.code = options.code;
		this.connection = options.connection;
		this.providerCode = options.providerCode ?? null;
		this.retryable =
			options.code === "unknown" ? false : (options.retryable ?? RETRYABLE_CODES.has(options.code));
		this.retryAfter = options.retryAfter ?? null;
	}
}
