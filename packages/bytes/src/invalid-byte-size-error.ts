/**
 * The failure value `parse()` reports for invalid byte size text. It keeps the
 * offending text on the error so a bad configuration value can be named in a
 * log line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Error describing text that fails the byte size grammar, or names more bytes
 * than a number holds exactly, delivered to callers inside a `Failure` value.
 */
export class InvalidByteSizeError extends Error {
	/** The rejected text, kept verbatim (untrimmed) for diagnostics. */
	readonly text: string;

	/**
	 * Builds an error whose message quotes the rejected text, so whitespace and
	 * empty strings stay visible in logs.
	 *
	 * @param text - Text that did not parse as a byte size.
	 */
	constructor(text: string) {
		super(`Invalid byte size: ${JSON.stringify(text)}`);
		this.name = "InvalidByteSizeError";
		this.text = text;
	}
}
