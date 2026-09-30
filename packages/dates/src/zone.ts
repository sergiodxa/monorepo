/**
 * The zone math every calendar operation here is built on, published as
 * `@sdxc/dates/zone`: reading an instant's wall clock in an IANA zone through
 * `Intl`, and inverting it into an instant with RFC 5545's DST gap and repeat rule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess, wrap } from "@sdxc/result";

import type { CalendarDay, TimeZone, Weekday } from "./types.js";

export type { CalendarDay, TimeZone, Weekday } from "./types.js";

import { dateTimeFormatter } from "./intl-cache.js";

/** Milliseconds in one exact 24-hour day, the unit day indexes are counted in. */
export const DAY_MS = 86_400_000;

/**
 * The format that reads every wall-clock field of an instant. `hourCycle` is
 * pinned to `h23` so midnight is `00` and never `24`, and the numbering system to
 * `latn` so the digits are always parseable regardless of `Intl` defaults.
 */
const PARTS_OPTIONS = {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hourCycle: "h23",
	numberingSystem: "latn",
} as const satisfies Intl.DateTimeFormatOptions;

/** Days in each month of a common year, January first; February gains one in a leap year. */
const DAYS_IN_COMMON_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/**
 * Whether the runtime accepted each zone name asked about, so a zone checked on
 * every request builds its `Intl` formatter once and a rejected one is never retried.
 */
const TIME_ZONE_VALIDITY = new Map<string, boolean>();

/** A full wall-clock reading: the calendar day plus the time of day on it. */
export interface ZonedParts extends CalendarDay {
	/** Hour of the day, `0` through `23`. */
	hour: number;
	/** Minute of the hour, `0` through `59`. */
	minute: number;
	/** Second of the minute, `0` through `59`. */
	second: number;
	/** Millisecond of the second, `0` through `999`. */
	millisecond: number;
}

/**
 * Read what a clock in `timeZone` shows at an instant. Milliseconds come from the
 * instant itself rather than from `Intl`, because every zone offset in use is a
 * whole number of seconds.
 *
 * @param instant - Milliseconds since the epoch.
 * @param timeZone - IANA zone whose clock to read.
 * @returns The wall-clock fields that zone shows at that instant.
 */
export function zonedParts(instant: number, timeZone: TimeZone): ZonedParts {
	let parts = dateTimeFormatter("en-US", { ...PARTS_OPTIONS, timeZone }).formatToParts(instant);
	let values = new Map<string, string>();
	for (let part of parts) values.set(part.type, part.value);
	return {
		year: Number(values.get("year")),
		month: Number(values.get("month")),
		day: Number(values.get("day")),
		hour: Number(values.get("hour")),
		minute: Number(values.get("minute")),
		second: Number(values.get("second")),
		millisecond: ((instant % 1000) + 1000) % 1000,
	};
}

/**
 * The calendar day an instant falls on in a zone, without the time of day.
 *
 * @param instant - Milliseconds since the epoch.
 * @param timeZone - IANA zone whose calendar to read.
 * @returns Year, month and day as that zone's clock shows them.
 */
export function calendarDayAt(instant: number, timeZone: TimeZone): CalendarDay {
	let parts = zonedParts(instant, timeZone);
	return { year: parts.year, month: parts.month, day: parts.day };
}

/**
 * Reinterpret wall-clock fields as if they were UTC. This is the intermediate
 * value the offset inversion works with, never a real instant on its own.
 *
 * @param parts - Wall-clock fields to reinterpret.
 * @returns The instant those fields name in UTC, with years 0-99 kept literal
 * instead of being remapped into the twentieth century by `Date.UTC`.
 */
export function utcFromParts(parts: ZonedParts): number {
	let instant = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second,
		parts.millisecond,
	);
	if (parts.year < 0 || parts.year > 99) return instant;
	let date = new Date(instant);
	date.setUTCFullYear(parts.year);
	return date.getTime();
}

/**
 * The zone's offset from UTC at an instant, as milliseconds to add to UTC.
 *
 * @param instant - Milliseconds since the epoch.
 * @param timeZone - IANA zone to measure.
 * @returns Offset in milliseconds, negative west of Greenwich.
 */
export function offsetMsAt(instant: number, timeZone: TimeZone): number {
	return utcFromParts(zonedParts(instant, timeZone)) - instant;
}

/**
 * Whether a zone's clock shows exactly these fields at an instant. Used to tell
 * a wall clock that exists from one a DST gap skipped over.
 *
 * @param instant - Candidate instant to check.
 * @param parts - Wall-clock fields the instant should read back as.
 * @param timeZone - IANA zone to read the instant in.
 * @returns `true` when every field matches.
 */
function readsBackAs(instant: number, parts: ZonedParts, timeZone: TimeZone): boolean {
	let actual = zonedParts(instant, timeZone);
	return (
		actual.year === parts.year &&
		actual.month === parts.month &&
		actual.day === parts.day &&
		actual.hour === parts.hour &&
		actual.minute === parts.minute &&
		actual.second === parts.second &&
		actual.millisecond === parts.millisecond
	);
}

/**
 * Invert a wall clock into the instant it names in a zone, trying the offsets a day
 * either side and at the clock itself. A repeated hour yields its earlier instant; a
 * skipped one uses the offset before the gap, landing as far past it (RFC 5545 §3.3.5).
 *
 * @param parts - Wall-clock fields as a reader would write them.
 * @param timeZone - IANA zone the clock belongs to.
 * @returns Milliseconds since the epoch for that wall clock.
 */
export function instantFromParts(parts: ZonedParts, timeZone: TimeZone): number {
	let asUtc = utcFromParts(parts);
	let offsetBefore = offsetMsAt(asUtc - DAY_MS, timeZone);
	let offsets = [offsetBefore, offsetMsAt(asUtc, timeZone), offsetMsAt(asUtc + DAY_MS, timeZone)];
	let earliest = Number.POSITIVE_INFINITY;
	for (let offset of offsets) {
		let candidate = asUtc - offset;
		if (candidate < earliest && readsBackAs(candidate, parts, timeZone)) earliest = candidate;
	}
	if (Number.isFinite(earliest)) return earliest;
	return asUtc - offsetBefore;
}

/**
 * The day index of a calendar day: whole days since 1970-01-01, counted with no
 * zone at all. Differences and iteration use it because it is immune to DST,
 * where dividing a millisecond difference by a day is not.
 *
 * @param day - Calendar day to index.
 * @returns Whole days since the epoch, negative before it.
 */
export function epochDayOf(day: CalendarDay): number {
	return Math.round(
		utcFromParts({ ...day, hour: 0, minute: 0, second: 0, millisecond: 0 }) / DAY_MS,
	);
}

/**
 * The calendar day a day index names, the inverse of `epochDayOf`.
 *
 * @param epochDay - Whole days since 1970-01-01.
 * @returns The calendar day at that index.
 */
export function calendarDayFromEpochDay(epochDay: number): CalendarDay {
	let date = new Date(epochDay * DAY_MS);
	return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/**
 * Move a calendar day by whole days, rolling over months and years. This is
 * calendar arithmetic, so it never drifts by an hour the way adding 24 hours to
 * an instant does across a DST transition.
 *
 * @param day - Day to move.
 * @param count - Days to move by; negative moves back.
 * @returns The resulting calendar day.
 */
export function shiftCalendarDay(day: CalendarDay, count: number): CalendarDay {
	return calendarDayFromEpochDay(epochDayOf(day) + count);
}

/**
 * The weekday a calendar day falls on. Derived from the day index, so it is the
 * same answer in every zone for the same calendar day.
 *
 * @param day - Calendar day to inspect.
 * @returns `0` Sunday through `6` Saturday.
 */
export function weekdayOf(day: CalendarDay): Weekday {
	return new Date(epochDayOf(day) * DAY_MS).getUTCDay() as Weekday;
}

/**
 * The first instant of a calendar day in a zone. Normally that is midnight; in a
 * zone whose DST transition skips midnight it is the first instant that exists on
 * the day, which is what a day boundary has to mean for the day to be non-empty.
 *
 * @param day - Calendar day to open.
 * @param timeZone - IANA zone the day belongs to.
 * @returns Milliseconds since the epoch.
 */
export function startOfDayInstant(day: CalendarDay, timeZone: TimeZone): number {
	return instantFromParts({ ...day, hour: 0, minute: 0, second: 0, millisecond: 0 }, timeZone);
}

/**
 * Whether the runtime's `Intl` accepts a zone name. Every zone-taking function in
 * this package lets `Intl` throw a `RangeError` on a zone it rejects, so a zone from
 * a cookie, header or form is checked here once at the boundary. Answers are cached.
 *
 * @param timeZone - Candidate IANA zone name, usually untrusted input.
 * @returns `true` when the zone can be passed to every function here.
 *
 * @example
 * isValidTimeZone("America/New_York"); // true
 * @example
 * isValidTimeZone("Mars/Olympus_Mons"); // false
 */
export function isValidTimeZone(timeZone: string): boolean {
	let cached = TIME_ZONE_VALIDITY.get(timeZone);
	if (cached !== undefined) return cached;
	let valid = isSuccess(wrap(() => dateTimeFormatter("en-US", { ...PARTS_OPTIONS, timeZone })));
	TIME_ZONE_VALIDITY.set(timeZone, valid);
	return valid;
}

/**
 * Whether a year of the proleptic Gregorian calendar has a February 29th.
 *
 * @param year - Calendar year, read literally, including years 0-99.
 * @returns `true` for years divisible by 4, except centuries not divisible by 400.
 */
function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * How many days a calendar month has, with no zone involved: a month's length is
 * the same on every calendar that shares the Gregorian rules.
 *
 * @param year - Calendar year, which decides February.
 * @param month - Month of the year, `1` January through `12` December.
 * @returns `28` through `31`, or `NaN` for a month outside `1` through `12`.
 *
 * @example
 * daysInMonth(2024, 2); // 29
 */
export function daysInMonth(year: number, month: number): number {
	if (month === 2 && isLeapYear(year)) return 29;
	return DAYS_IN_COMMON_MONTH[month - 1] ?? Number.NaN;
}

/**
 * Move a calendar day by whole months, rolling over years. The day is clamped to
 * the target month's last day, so January 31st plus one month is the end of
 * February and a month step never spills into the month after.
 *
 * @param day - Day to move.
 * @param count - Whole months to move by; negative moves back.
 * @returns The resulting calendar day.
 *
 * @example
 * shiftCalendarMonth({ year: 2026, month: 1, day: 31 }, 1); // { year: 2026, month: 2, day: 28 }
 */
export function shiftCalendarMonth(day: CalendarDay, count: number): CalendarDay {
	let index = day.year * 12 + (day.month - 1) + count;
	let year = Math.floor(index / 12);
	let month = index - year * 12 + 1;
	return { year, month, day: Math.min(day.day, daysInMonth(year, month)) };
}
