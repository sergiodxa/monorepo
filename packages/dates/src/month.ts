/**
 * Month and quarter boundaries and calendar-month arithmetic in an explicit zone.
 * A month starts at a different instant in every zone and moving by one is not a
 * fixed length, so these build on the wall-clock math instead of on milliseconds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CalendarDay, TimeZone } from "./types.js";

import {
	calendarDayAt,
	instantFromParts,
	shiftCalendarMonth,
	startOfDayInstant,
	zonedParts,
} from "./zone.js";

/**
 * The first day of the month a calendar day belongs to, moved by whole months.
 *
 * @param day - Any day in the month of interest.
 * @param months - Whole months to move the result by.
 * @returns Day `1` of the resulting month.
 */
function firstOfMonth(day: CalendarDay, months: number): CalendarDay {
	return shiftCalendarMonth({ year: day.year, month: day.month, day: 1 }, months);
}

/**
 * The first day of the quarter a calendar day belongs to, moved by whole quarters.
 * Quarters are the calendar ones: January, April, July and October open them.
 *
 * @param day - Any day in the quarter of interest.
 * @param quarters - Whole quarters to move the result by.
 * @returns Day `1` of the resulting quarter's first month.
 */
function firstOfQuarter(day: CalendarDay, quarters: number): CalendarDay {
	let month = Math.floor((day.month - 1) / 3) * 3 + 1;
	return shiftCalendarMonth({ year: day.year, month, day: 1 }, quarters * 3);
}

/**
 * The first instant of the calendar month an instant falls in, in a zone. When
 * DST skips midnight on the 1st, it is the first instant that exists that day.
 *
 * @param date - Any instant in the month of interest.
 * @param timeZone - IANA zone whose calendar month to open.
 * @returns The month's first instant.
 *
 * @example
 * startOfMonth(new Date("2026-08-01T02:00:00Z"), "America/New_York"); // 2026-07-01T04:00:00Z
 */
export function startOfMonth(date: Date, timeZone: TimeZone): Date {
	let day = calendarDayAt(date.getTime(), timeZone);
	return new Date(startOfDayInstant(firstOfMonth(day, 0), timeZone));
}

/**
 * The last instant of the calendar month an instant falls in, in a zone: one
 * millisecond before the next month starts, the same closed-range convention as
 * `endOfDay`, so a month whose length changes across DST still ends exactly.
 *
 * @param date - Any instant in the month of interest.
 * @param timeZone - IANA zone whose calendar month to close.
 * @returns The month's last instant, at millisecond resolution.
 *
 * @example
 * endOfMonth(new Date("2026-02-10T12:00:00Z"), "America/New_York"); // 2026-03-01T04:59:59.999Z
 */
export function endOfMonth(date: Date, timeZone: TimeZone): Date {
	let day = calendarDayAt(date.getTime(), timeZone);
	return new Date(startOfDayInstant(firstOfMonth(day, 1), timeZone) - 1);
}

/**
 * The first instant of the calendar quarter an instant falls in, in a zone.
 *
 * @param date - Any instant in the quarter of interest.
 * @param timeZone - IANA zone whose calendar quarter to open.
 * @returns The quarter's first instant, at the start of January, April, July or October.
 *
 * @example
 * startOfQuarter(new Date("2026-08-15T12:00:00Z"), "UTC"); // 2026-07-01T00:00:00Z
 */
export function startOfQuarter(date: Date, timeZone: TimeZone): Date {
	let day = calendarDayAt(date.getTime(), timeZone);
	return new Date(startOfDayInstant(firstOfQuarter(day, 0), timeZone));
}

/**
 * The last instant of the calendar quarter an instant falls in, in a zone: one
 * millisecond before the next quarter starts.
 *
 * @param date - Any instant in the quarter of interest.
 * @param timeZone - IANA zone whose calendar quarter to close.
 * @returns The quarter's last instant, at millisecond resolution.
 *
 * @example
 * endOfQuarter(new Date("2026-08-15T12:00:00Z"), "UTC"); // 2026-09-30T23:59:59.999Z
 */
export function endOfQuarter(date: Date, timeZone: TimeZone): Date {
	let day = calendarDayAt(date.getTime(), timeZone);
	return new Date(startOfDayInstant(firstOfQuarter(day, 1), timeZone) - 1);
}

/**
 * Move an instant by calendar months in a zone, keeping its wall-clock time of
 * day. The day clamps to the target month's last day, so January 31st plus one
 * month is February 28th or 29th; a time DST skips resolves as `instantFromParts` does.
 *
 * @param date - Instant to move.
 * @param count - Whole months to move by; negative moves back.
 * @param timeZone - IANA zone whose calendar and clock to move on.
 * @returns A new `Date`; the input is never mutated.
 *
 * @example
 * addMonths(new Date("2026-01-31T15:00:00Z"), 1, "America/New_York"); // 2026-02-28T15:00:00Z
 * @example
 * addMonths(new Date("2026-03-01T15:00:00Z"), 1, "America/New_York"); // 2026-04-01T14:00:00Z
 */
export function addMonths(date: Date, count: number, timeZone: TimeZone): Date {
	let parts = zonedParts(date.getTime(), timeZone);
	let target = shiftCalendarMonth(parts, count);
	return new Date(instantFromParts({ ...parts, ...target }, timeZone));
}
