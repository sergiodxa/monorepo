/**
 * The failure value adapters report when their backend cannot answer: a KV read
 * that threw, a binding that rejected, a query that failed. It carries the
 * backend and the key so an outage is diagnosable from a single log line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Which backend produced a failure. Kept as a closed union so log dashboards can
 * group failures by storage without parsing error messages.
 */
export type RateLimitBackend = "memory" | "cloudflare" | "kv" | "data-table";

/** Diagnostic context attached to a {@link RateLimitError}. */
export interface RateLimitErrorOptions {
	/** Backend that could not answer. */
	backend: RateLimitBackend;
	/** Prefixed key being consumed or reset when the failure happened. */
	key: string;
	/** Underlying error or rejection value, preserved for the stack trace. */
	cause?: unknown;
}

/**
 * Error describing a backend that could not produce a decision, returned inside
 * a `Failure` and never thrown. The caller decides whether an unavailable
 * backend lets the request through (fail open) or rejects it (fail closed).
 */
export class RateLimitError extends Error {
	/** Backend that could not answer, for grouping failures by storage. */
	readonly backend: RateLimitBackend;

	/** Prefixed key involved in the failed operation. */
	readonly key: string;

	/**
	 * Builds an error that names the backend and key alongside the message.
	 *
	 * @param message - What went wrong, phrased for an operator reading a log.
	 * @param options - Backend, key, and the underlying cause.
	 */
	constructor(message: string, options: RateLimitErrorOptions) {
		super(message, { cause: options.cause });
		this.name = "RateLimitError";
		this.backend = options.backend;
		this.key = options.key;
	}
}
