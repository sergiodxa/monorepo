/**
 * The shapes `find` answers with: each phrase it matched, where it sits in the text and what it
 * means, and the event-shaped summary the matches add up to. Dates are `YYYY-MM-DD` and times
 * `HH:MM` on the given zone's clock, so a caller decides how to turn them into instants.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A weekday as JSCalendar and iCalendar's `BYDAY` spell it, lowercase. */
export type Weekday = "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su";

/**
 * A repeat, in the shape of a JSCalendar `RecurrenceRule`, so it can be set as an event's
 * `recurrenceRules` entry as is; `toRRule` writes the same rule as an iCalendar `RRULE` value.
 */
export interface RepeatRule {
	frequency: "daily" | "weekly" | "monthly" | "yearly";
	/** Every `interval` periods; absent means every one. */
	interval?: number;
	/** The weekdays a weekly rule falls on; absent means the start's own weekday. */
	byDay?: Array<{ day: Weekday }>;
	/** The last day a repeat may start, inclusive, as a LocalDateTime at the day's end. */
	until?: string;
	/** How many occurrences, the first included. */
	count?: number;
}

/** What one matched phrase means. */
export type MatchValue =
	| { kind: "date"; date: string }
	| { kind: "dateRange"; from: string; to: string }
	| { kind: "time"; time: string }
	| { kind: "timeRange"; from: string; to: string }
	| { kind: "duration"; minutes: number }
	| { kind: "allDay" }
	| { kind: "repeat"; rule: RepeatRule };

/** One phrase found in the text: its kind and value, and the half-open range it covers. */
export type Match = MatchValue & {
	/** The index of its first character. */
	index: number;
	/** The index after its last character, so `text.slice(index, end)` is the phrase. */
	end: number;
	/** The phrase as written. */
	text: string;
};

/**
 * What the matches add up to, as an event would read them. A field is set only when the text
 * says it, so a caller fills its own defaults (today, an hour long) for the rest.
 */
export interface Found {
	/** Every phrase found, in text order. */
	matches: Match[];
	/** The first day, `YYYY-MM-DD`; set too when only a repeat names it ("every Tuesday"). */
	date?: string;
	/** The last day of a span, inclusive, for "Dec 3 to Dec 5" or "for 3 days". */
	endDate?: string;
	/** The start time, `HH:MM`. */
	start?: string;
	/** The end time, `HH:MM`, from a range or from a start and a duration. */
	end?: string;
	/** Minutes long, when a duration or a range gives it. */
	duration?: number;
	/** Whether the text asks for an all-day event. */
	allDay: boolean;
	repeat?: RepeatRule;
}

/** What `find` reads the text against. */
export interface FindOptions {
	/** The present, which "tomorrow", "next Friday" and "in 2 weeks" count from. */
	now: Date;
	/** The IANA zone whose calendar the dates are on. */
	timeZone: string;
}
