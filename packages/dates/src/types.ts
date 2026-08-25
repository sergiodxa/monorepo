/**
 * The vocabulary every function in this package shares: the explicit time zone
 * name, the locale argument the formatters take, the weekday index, and the day
 * descriptor the grid helpers return. It holds no logic, only the shared shapes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * An IANA time zone name, e.g. `"America/New_York"` or `"UTC"`. Every calendar
 * operation takes one because the answer genuinely differs by zone; there is no
 * default, so a wrong zone is a visible argument rather than a hidden assumption.
 */
export type TimeZone = string;

/**
 * A BCP 47 locale, or a preference list the platform resolves in order. Passed
 * straight to `Intl`, so locale data comes from the runtime and never from this
 * package.
 */
export type Locale = string | readonly string[];

/**
 * A weekday index, `0` Sunday through `6` Saturday, matching `Date#getDay`. Used
 * both for `weekStartsOn` and for the weekday a day descriptor falls on, so the
 * two never need translating between conventions.
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** The length `Intl` renders a date at, from `Intl.DateTimeFormat`. */
export type DateStyle = NonNullable<Intl.DateTimeFormatOptions["dateStyle"]>;

/** The length `Intl` renders a time at, from `Intl.DateTimeFormat`. */
export type TimeStyle = NonNullable<Intl.DateTimeFormatOptions["timeStyle"]>;

/**
 * A calendar day with no zone and no time attached: what a human reads off a
 * wall calendar. Months are `1` through `12` rather than zero-based, because
 * every other calendar API a reader knows counts them that way.
 */
export interface CalendarDay {
	/** Calendar year, e.g. `2026`. */
	year: number;
	/** Month of the year, `1` January through `12` December. */
	month: number;
	/** Day of the month, `1` through `31`. */
	day: number;
}

/**
 * One cell of a day grid: the calendar fields, the start instant, and the
 * stable key aggregations join on. Grid helpers return arrays of these so a UI
 * layer renders without recomputing anything zone-dependent.
 */
export interface Day extends CalendarDay {
	/** The first instant of this calendar day in `timeZone`. */
	date: Date;
	/** The `"YYYY-MM-DD"` key for this day, stable across zones and runs. */
	key: string;
	/** The weekday this day falls on, `0` Sunday through `6` Saturday. */
	weekday: Weekday;
	/** The zone every other field was computed in. */
	timeZone: TimeZone;
}

/**
 * A closed range of instants. Both ends are inclusive for day enumeration: the
 * day containing `start` and the day containing `end` are both produced.
 */
export interface Interval {
	/** First instant of the range. */
	start: Date;
	/** Last instant of the range. */
	end: Date;
}
