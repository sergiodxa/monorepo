/**
 * The failure value `parse()` reports for text that is not a duration. It keeps
 * the offending text on the error so a bad configuration value can be named in
 * a log line instead of being reported as a generic parse failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Error describing text that does not match the duration grammar, returned
 * inside a `Failure` and never thrown.
 */
export class InvalidDurationError extends Error {
	/** The rejected text, kept verbatim (untrimmed) for diagnostics. */
	readonly text: string;

	/**
	 * Builds an error whose message quotes the rejected text, so whitespace and
	 * empty strings stay visible in logs.
	 *
	 * @param text - Text that did not match the duration grammar.
	 */
	constructor(text: string) {
		super(`Invalid duration: ${JSON.stringify(text)}`);
		this.name = "InvalidDurationError";
		this.text = text;
	}
}
