/**
 * The failure `Color.parse` reports for text that is not a CSS color it can read. Colors
 * arrive from stylesheets, settings and user input, so the rejected text stays on the
 * error for a log line or a form message.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Text `Color.parse` could not read as a CSS color, delivered inside a `Failure`. */
export class ColorParseError extends Error {
	/** The rejected text, verbatim. */
	readonly input: string;

	/**
	 * @param input - The text that failed to parse.
	 * @param reason - Why it failed, appended to the message.
	 */
	constructor(input: string, reason: string) {
		super(`Invalid color ${JSON.stringify(input)}: ${reason}`);
		this.name = "ColorParseError";
		this.input = input;
	}
}
