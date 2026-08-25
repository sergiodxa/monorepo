/**
 * Day and week boundaries in an explicit zone. These answer "when does this day
 * begin here", which has a different answer in every zone and on the two days a
 * year a zone changes offset, so the zone is always an argument.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TimeZone, Weekday } from "./types";

import { calendarDayAt, shiftCalendarDay, startOfDayInstant, weekdayOf } from "./zone";

/** How a week is delimited, a decision the product makes explicitly. */
export interface StartOfWeekOptions {
	/** Weekday a week begins on, `0` Sunday through `6` Saturday. */
	weekStartsOn: Weekday;
}

/**
 * The first instant of the calendar day an instant falls on, in a zone.
 *
 * On a day whose DST transition skips midnight, the returned instant is the first
 * one that actually exists that day.
 *
 * @param date - Any instant on the day of interest.
 * @param timeZone - IANA zone whose calendar day to open.
 * @returns The day's first instant.
 *
 * @example
 * startOfDay(new Date("2026-07-29T02:00:00Z"), "America/New_York"); // 2026-07-28T04:00:00Z
 */
export function startOfDay(date: Date, timeZone: TimeZone): Date {
	return new Date(startOfDayInstant(calendarDayAt(date.getTime(), timeZone), timeZone));
}

/**
 * The last instant of the calendar day an instant falls on, in a zone: one
 * millisecond before the next day starts. Deriving it from the next day's start
 * keeps it correct on days that are 23 or 25 hours long.
 *
 * @param date - Any instant on the day of interest.
 * @param timeZone - IANA zone whose calendar day to close.
 * @returns The day's last instant, at millisecond resolution.
 *
 * @example
 * endOfDay(new Date("2026-03-08T12:00:00Z"), "America/New_York"); // 2026-03-09T04:59:59.999Z
 */
export function endOfDay(date: Date, timeZone: TimeZone): Date {
	let today = calendarDayAt(date.getTime(), timeZone);
	let tomorrow = shiftCalendarDay(today, 1);
	return new Date(startOfDayInstant(tomorrow, timeZone) - 1);
}

/**
 * The first instant of the week an instant falls in, in a zone. The week start is
 * required because a locale's answer and a product's answer disagree often enough
 * that inferring it silently produces the wrong grid.
 *
 * @param date - Any instant in the week of interest.
 * @param timeZone - IANA zone whose calendar week to open.
 * @param options - Which weekday the week begins on.
 * @returns The week's first instant, at the start of its first day.
 *
 * @example
 * startOfWeek(date, "UTC", { weekStartsOn: 1 }); // Monday-based week
 */
export function startOfWeek(date: Date, timeZone: TimeZone, options: StartOfWeekOptions): Date {
	let today = calendarDayAt(date.getTime(), timeZone);
	let back = (weekdayOf(today) - options.weekStartsOn + 7) % 7;
	return new Date(startOfDayInstant(shiftCalendarDay(today, -back), timeZone));
}
