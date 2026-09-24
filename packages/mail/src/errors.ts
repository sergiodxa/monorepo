/**
 * The errors the mail package reports inside a `Result`: `MailError` for every
 * send failure — invalid message, failed render, rejected delivery — and
 * `InvalidUnsubscribeTokenError` for a token the unsubscribe endpoint refuses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Error carried by a failed send. The original provider or render error is kept
 * as `cause`, so a log line can report the root problem directly from it.
 */
export class MailError extends Error {
	override name = "MailError";

	/**
	 * Creates a mail error.
	 *
	 * @param message - Human-readable description of what went wrong.
	 * @param options - Standard error options; pass `cause` to keep the original error.
	 */
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
	}
}

/**
 * A token the unsubscribe endpoint cannot act on: malformed, tampered with, signed
 * with another secret or purpose, or expired. The cases share one type so the
 * endpoint answers all of them the same way and leaks nothing about which failed.
 */
export class InvalidUnsubscribeTokenError extends Error {
	override name = "InvalidUnsubscribeTokenError";

	/**
	 * Creates the error.
	 *
	 * @param options - Standard error options; `cause` keeps a crypto failure for logs.
	 */
	constructor(options?: ErrorOptions) {
		super("The unsubscribe token is invalid or has expired.", options);
	}
}
