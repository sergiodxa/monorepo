/**
 * Inclusive ranges of calendar days written as day keys: the presets a report or filter
 * offers (a month, a quarter, the year so far, a trailing window) and the checks a
 * submitted range has to pass before it reaches a query.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { LastNDaysOptions } from "./grid.js";
import type { CalendarDay, DayRange, TimeZone } from "./types.js";

import { formatDayKey, parseDayKey } from "./day-key.js";
import { InvalidDayRangeError } from "./invalid-day-range-error.js";
import { calendarDayAt, daysInMonth, epochDayOf, shiftCalendarDay } from "./zone.js";

/** The rules `validateDayRange` holds a range to beyond both ends naming real days. */
export interface ValidateDayRangeOptions {
	/** The last day `to` may name, as a day key, e.g. yesterday for data that rolls up daily. */
	latest?: string;
	/** The most days the range may cover, both ends counted. */
	maxDays?: number;
}

/**
 * Reads a day key exactly as written, so surrounding whitespace or a day the month lacks
 * makes the key unusable instead of being trimmed or rolled over.
 *
 * @param key - Text that should be a `"YYYY-MM-DD"` day key.
 * @returns The calendar day, or `null` when the text names no day.
 */
function readExactDay(key: string): CalendarDay | null {
	let parsed = parseDayKey(key);
	if (isFailure(parsed) || formatDayKey(parsed.data) !== key) return null;
	return parsed.data;
}

/**
 * The whole calendar month an instant falls in, in a zone.
 *
 * @param date - Any instant in the month of interest.
 * @param timeZone - IANA zone whose calendar month to name.
 * @returns The month's first through last day.
 *
 * @example
 * monthRange(new Date("2026-08-15T12:00:00Z"), "UTC"); // { from: "2026-08-01", to: "2026-08-31" }
 */
export function monthRange(date: Date, timeZone: TimeZone): DayRange {
	let { year, month } = calendarDayAt(date.getTime(), timeZone);
	return {
		from: formatDayKey({ year, month, day: 1 }),
		to: formatDayKey({ year, month, day: daysInMonth(year, month) }),
	};
}

/**
 * The whole calendar quarter an instant falls in, in a zone. Quarters open in January,
 * April, July and October.
 *
 * @param date - Any instant in the quarter of interest.
 * @param timeZone - IANA zone whose calendar quarter to name.
 * @returns The quarter's first through last day.
 *
 * @example
 * quarterRange(new Date("2026-05-15T12:00:00Z"), "UTC"); // { from: "2026-04-01", to: "2026-06-30" }
 */
export function quarterRange(date: Date, timeZone: TimeZone): DayRange {
	let { year, month } = calendarDayAt(date.getTime(), timeZone);
	let first = Math.floor((month - 1) / 3) * 3 + 1;
	let last = first + 2;
	return {
		from: formatDayKey({ year, month: first, day: 1 }),
		to: formatDayKey({ year, month: last, day: daysInMonth(year, last) }),
	};
}

/**
 * January 1st through the day an instant falls on, in a zone. Passing yesterday on
 * January 1st yields the whole previous year, which is what a "year so far" over
 * completed days means on that date.
 *
 * @param date - The last day of the range.
 * @param timeZone - IANA zone whose calendar year to read.
 * @returns The year's first day through `date`'s day.
 *
 * @example
 * yearToDateRange(new Date("2026-09-28T12:00:00Z"), "UTC"); // { from: "2026-01-01", to: "2026-09-28" }
 */
export function yearToDateRange(date: Date, timeZone: TimeZone): DayRange {
	let day = calendarDayAt(date.getTime(), timeZone);
	return { from: formatDayKey({ year: day.year, month: 1, day: 1 }), to: formatDayKey(day) };
}

/**
 * The last `count` calendar days as a range, ending on the day `from` falls on and
 * including it, so `dayRangeLength` of the result is `count` across a DST transition too.
 *
 * @param count - Days the range covers, including its last day.
 * @param options - Where the range ends, and the zone to count days in.
 * @returns The range's first and last day.
 *
 * @example
 * lastNDaysRange(30, { from: new Date("2026-09-28T12:00:00Z"), timeZone: "UTC" }); // { from: "2026-08-30", to: "2026-09-28" }
 */
export function lastNDaysRange(count: number, options: LastNDaysOptions): DayRange {
	let last = calendarDayAt((options.from ?? new Date()).getTime(), options.timeZone);
	return { from: formatDayKey(shiftCalendarDay(last, 1 - count)), to: formatDayKey(last) };
}

/**
 * How many days a range covers, both ends counted, with no zone involved.
 *
 * @param range - The range to measure.
 * @returns The day count, or `NaN` when either end names no calendar day.
 *
 * @example
 * dayRangeLength({ from: "2026-02-01", to: "2026-02-28" }); // 28
 */
export function dayRangeLength(range: DayRange): number {
	let from = readExactDay(range.from);
	let to = readExactDay(range.to);
	if (from === null || to === null) return Number.NaN;
	return epochDayOf(to) - epochDayOf(from) + 1;
}

/**
 * Whether a range is exactly one calendar month, first day through last, which is when a
 * label or filename can name the month alone.
 *
 * @param range - The range to inspect.
 * @returns `true` only for a whole month with both ends written as exact day keys.
 *
 * @example
 * isWholeMonth({ from: "2024-02-01", to: "2024-02-29" }); // true
 */
export function isWholeMonth(range: DayRange): boolean {
	let from = readExactDay(range.from);
	if (from === null || from.day !== 1) return false;
	return range.to === formatDayKey({ ...from, day: daysInMonth(from.year, from.month) });
}

/**
 * Checks a submitted range, usually from a query string or form, and reports the first
 * rule it breaks: both ends exact day keys naming real days, `from` on or before `to`,
 * `to` on or before `latest`, and at most `maxDays` days long.
 *
 * @param range - The submitted ends.
 * @param options - The latest allowed day and the longest allowed range, each optional.
 * @returns The range, or an `InvalidDayRangeError` whose `problem` names the broken rule.
 *
 * @example
 * validateDayRange({ from: "2026-09-10", to: "2026-09-01" }); // failure, problem "reversed"
 * @example
 * validateDayRange(range, { latest: "2026-09-28", maxDays: 366 });
 */
export function validateDayRange(
	range: DayRange,
	options: ValidateDayRangeOptions = {},
): Result<DayRange, InvalidDayRangeError> {
	let from = readExactDay(range.from);
	let to = readExactDay(range.to);
	if (from === null || to === null) return failure(new InvalidDayRangeError("invalid", range));

	let length = epochDayOf(to) - epochDayOf(from) + 1;
	if (length < 1) return failure(new InvalidDayRangeError("reversed", range));
	if (options.latest !== undefined && range.to > options.latest) {
		return failure(new InvalidDayRangeError("tooLate", range));
	}
	if (options.maxDays !== undefined && length > options.maxDays) {
		return failure(new InvalidDayRangeError("tooLong", range));
	}

	return success({ from: range.from, to: range.to });
}
