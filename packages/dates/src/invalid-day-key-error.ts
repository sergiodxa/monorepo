/**
 * The failure value the day key parsers report. It keeps the offending text so a
 * bad route parameter or stored key can be named in a log line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Error describing text that fails to parse as a `"YYYY-MM-DD"` day key, either
 * because the shape is wrong or because it names an out-of-range calendar day.
 * Returned inside a `Failure`.
 */
export class InvalidDayKeyError extends Error {
	/** The rejected text, kept verbatim for diagnostics. */
	readonly text: string;

	/**
	 * Builds an error whose message quotes the rejected text, so whitespace and
	 * empty strings stay visible in logs.
	 *
	 * @param text - Candidate text to parse as a day key.
	 */
	constructor(text: string) {
		super(`Invalid day key: ${JSON.stringify(text)}`);
		this.name = "InvalidDayKeyError";
		this.text = text;
	}
}
