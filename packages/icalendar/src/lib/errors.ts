/**
 * The failures this package reports through `Result`: a calendar whose structure cannot be
 * read, a recurrence rule that cannot be parsed or expanded, a zone `Intl` does not know, and
 * an event or message that breaks an iTIP method's constraints.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Structural failures: unmatched `BEGIN`/`END`, a content line without `:`, no `VCALENDAR`. */
export class ICalendarParseError extends Error {
	override name = "ICalendarParseError";

	/** The 1-based physical line the failure starts on, counted before unfolding. */
	line: number;

	/**
	 * @param message - What is wrong, without the line number
	 * @param line - The 1-based physical line it starts on
	 */
	constructor(message: string, line: number) {
		super(`Line ${line}: ${message}`);
		this.line = line;
	}
}

/** An `RRULE` that does not parse, carries out-of-range parts, or cannot be expanded. */
export class RecurrenceRuleError extends Error {
	override name = "RecurrenceRuleError";
}

/** A zone `Intl` does not know, or a span that is empty. */
export class TimeZoneError extends Error {
	override name = "TimeZoneError";
}

/** An event that cannot carry the iTIP method asked of it, or a message that is not a `REPLY`. */
export class ITipError extends Error {
	override name = "ITipError";
}
