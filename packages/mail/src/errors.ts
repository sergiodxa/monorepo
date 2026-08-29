/**
 * The single error type the mail package reports. Every failure a caller can
 * branch on — invalid message, failed render, rejected delivery — arrives as a
 * `MailError` inside a `Result`, so no send path throws.
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
