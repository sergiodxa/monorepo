/**
 * The failure value `parseDateTimeLocal()` reports. It keeps the offending text so
 * a bad form submission can be named in a log line or echoed back to the field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Error describing text that fails to parse as a `datetime-local` value, either
 * because the shape is wrong or because it names a calendar day or time of day
 * that does not exist. Returned inside a `Failure`.
 */
export class InvalidDateTimeLocalError extends Error {
	/** The rejected text, kept verbatim for diagnostics. */
	readonly text: string;

	/**
	 * Builds an error whose message quotes the rejected text, so whitespace and
	 * empty strings stay visible in logs.
	 *
	 * @param text - Candidate text to parse as a `datetime-local` value.
	 */
	constructor(text: string) {
		super(`Invalid datetime-local value: ${JSON.stringify(text)}`);
		this.name = "InvalidDateTimeLocalError";
		this.text = text;
	}
}
