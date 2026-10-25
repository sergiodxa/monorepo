/**
 * The failure value `parseZonedDateTime()` reports. It names the RFC 9557 rule the
 * text broke, so a caller can tell a typo from a critical tag it cannot honour, and
 * keeps the text verbatim for a log line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The rule an IXDTF string breaks: malformed text, a calendar day or time that does not
 * exist, an experimental `_` key nobody opted into, a critical tag the reader cannot
 * process, an offset that disagrees with the zone or a duplicate tag, or a zone name the
 * runtime does not know.
 */
export type ZonedDateTimeProblem =
	| "syntax"
	| "invalidDate"
	| "experimentalKey"
	| "unsupportedCritical"
	| "inconsistent"
	| "unknownTimeZone";

/** Error describing text rejected as an RFC 9557 Internet Extended Date/Time Format string. */
export class InvalidZonedDateTimeError extends Error {
	/** The first rule the text breaks. */
	readonly problem: ZonedDateTimeProblem;
	/** The rejected text, kept verbatim for diagnostics. */
	readonly text: string;

	/**
	 * Builds an error whose message names the rule and quotes the text, so whitespace and
	 * empty strings stay visible in logs.
	 *
	 * @param problem - The rule the text breaks.
	 * @param text - Candidate text to parse as an IXDTF string.
	 */
	constructor(problem: ZonedDateTimeProblem, text: string) {
		super(`Invalid zoned date-time (${problem}): ${JSON.stringify(text)}`);
		this.name = "InvalidZonedDateTimeError";
		this.problem = problem;
		this.text = text;
	}
}
