/**
 * The single failure type every newsletter call reports: one normalized code,
 * the platform's own code beside it, and whether a retry is safe. It is the
 * error inside every `Result` the contract returns, so no newsletter path throws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { currentLog } from "@sdxc/logger";

/**
 * Normalized reason a newsletter call failed. `invalid_address` and
 * `suppressed` are the two refusals a visitor can act on, so a form branches on
 * them; every other code is the app's to log.
 */
export type NewsletterErrorCode =
	| "not_found"
	/** The platform refused the address itself as undeliverable or malformed. */
	| "invalid_address"
	/** The platform holds the address as blocked, bounced or complained. */
	| "suppressed"
	| "invalid_request"
	| "unauthenticated"
	| "forbidden"
	| "rate_limited"
	/** The platform answered `2xx` in a shape these models cannot express. */
	| "invalid_response"
	/** The platform cannot do this at all. */
	| "unsupported"
	/** A timeout or 5xx: the write may or may not have landed. */
	| "unknown";

/** What a provider states about a failure when it constructs the error. */
export interface NewsletterErrorOptions extends ErrorOptions {
	code: NewsletterErrorCode;
	/** The configured credential set the call was made against. */
	connection: string;
	/** The platform's own code, when the response carried one. */
	providerCode?: string | null;
	/** Seconds the platform asked the caller to wait, when it named a delay. */
	retryAfter?: number | null;
}

/**
 * Failure carried by every newsletter `Result`. Only `rate_limited` is
 * retryable, and the provider never retries on its own, so a job decides when
 * with its own backoff.
 *
 * @example
 * failure(new NewsletterError("No such subscriber", { code: "not_found", connection: "memory" }));
 */
export class NewsletterError extends Error {
	override name = "NewsletterError";

	readonly code: NewsletterErrorCode;

	/** The configured credential set the failing call was made against. */
	readonly connection: string;

	/** The platform's own code, for logs and support tickets. */
	readonly providerCode: string | null;

	/** Whether repeating the same call later can succeed where this one failed. */
	readonly retryable: boolean;

	/**
	 * Seconds to wait before repeating the call, from the platform's own
	 * `Retry-After`; `null` when it named none.
	 */
	readonly retryAfter: number | null;

	/**
	 * Creates a newsletter error.
	 *
	 * @param message - What went wrong, in terms a log line can use directly.
	 * @param options - The normalized code, the connection, and the platform's own code.
	 */
	constructor(message: string, options: NewsletterErrorOptions) {
		super(message, options);

		this.code = options.code;
		this.connection = options.connection;
		this.providerCode = options.providerCode ?? null;
		this.retryable = options.code === "rate_limited";
		this.retryAfter = options.retryAfter ?? null;
	}
}

/**
 * Reports a row a list dropped because its platform status has no mapping, so
 * a page that carried on is told apart from one the platform never held the
 * row in.
 *
 * @param connection - The credential set the read was made against.
 * @param id - The platform's id for the row.
 * @param providerStatus - The value the mapping lacks.
 */
export function reportSkipped(connection: string, id: string, providerStatus: string): void {
	currentLog()?.note("newsletter.skipped_row", { connection, id, providerStatus });
}
