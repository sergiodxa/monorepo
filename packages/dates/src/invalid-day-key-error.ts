/**
 * The failure value the day key parsers report. It keeps the offending text so a
 * bad route parameter or stored key can be named in a log line instead of being
 * reported as a generic parse failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Error describing text that is not a `"YYYY-MM-DD"` day key, either because the
 * shape is wrong or because it names a day that does not exist. Returned inside a
 * `Failure` and never thrown.
 */
export class InvalidDayKeyError extends Error {
	/** The rejected text, kept verbatim (untrimmed) for diagnostics. */
	readonly text: string;

	/**
	 * Builds an error whose message quotes the rejected text, so whitespace and
	 * empty strings stay visible in logs.
	 *
	 * @param text - Text that is not a valid day key.
	 */
	constructor(text: string) {
		super(`Invalid day key: ${JSON.stringify(text)}`);
		this.name = "InvalidDayKeyError";
		this.text = text;
	}
}
