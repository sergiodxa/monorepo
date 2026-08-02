/**
 * The occurrence search. A schedule pinned to given hours is walked on the zone's
 * wall clock, so a daily 09:00 stays 09:00 across a daylight saving shift; one that
 * fires every hour is walked on absolute time, so it keeps its spacing instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CronFieldSet } from "./fields";
import type { WallClock, ZonedParts } from "./time-zone";

import { daysInMonth, weekdayOf } from "./calendar";
import { instantFromWallClock, offsetAt, zonedPartsOf } from "./time-zone";

/**
 * How far the calendar walk may reach before giving up. Eight years is the widest
 * real gap (a February 29th schedule crossing a non-leap century, 2096 to 2104), so
 * twelve leaves room without letting a mistake spin.
 */
const MAX_SEARCH_YEARS = 12;

/**
 * Hard stop on loop turns, independent of the year horizon. Every turn moves the
 * search by at least a minute or a day, so this can only be reached by a bug.
 */
const MAX_ITERATIONS = 200_000;

/** One minute in milliseconds, the resolution every cron occurrence lands on. */
const MINUTE_MS = 60_000;

/** How many hours a day can hold, the size of an unrestricted hour field. */
const HOURS_PER_DAY = 24;

/**
 * Whether a date is one the schedule fires on, applying the rule that makes cron
 * surprising: when both day fields are restricted the date matches if *either* of
 * them does, and when only one is restricted the other is open and matches anything.
 *
 * @param fields - The parsed schedule.
 * @param wall - The date to test; only its calendar fields are read.
 * @returns `true` when the schedule can fire on that date.
 *
 * @example
 * // "0 0 13 * 5" fires on the 13th of a month and on every Friday.
 */
export function matchesDate(fields: CronFieldSet, wall: WallClock): boolean {
	if (!fields.months.includes(wall.month)) return false;

	let dayMatches = fields.daysOfMonth.includes(wall.day);
	let weekdayMatches = fields.daysOfWeek.includes(weekdayOf(wall.year, wall.month, wall.day));

	if (fields.dayOfMonthRestricted && fields.dayOfWeekRestricted) {
		return dayMatches || weekdayMatches;
	}
	return dayMatches && weekdayMatches;
}

/**
 * Whether the minute an instant falls in is one the schedule fires in.
 *
 * Seconds are ignored, because cron resolves to minutes. This reads the fields
 * against the wall clock, so on the day a clock is set back it holds for both passes
 * of the repeated hour, while a wall time a clock skipped never holds.
 *
 * @param fields - The parsed schedule.
 * @param instant - Milliseconds since the epoch.
 * @param timeZone - IANA time zone name the wall clock is read in.
 * @returns `true` when every field matches, `false` for an unknown zone.
 */
export function matchesInstant(fields: CronFieldSet, instant: number, timeZone: string): boolean {
	let parts = zonedPartsOf(instant, timeZone);
	if (parts === null) return false;
	if (!fields.minutes.includes(parts.minute)) return false;
	if (!fields.hours.includes(parts.hour)) return false;
	return matchesDate(fields, parts);
}

/**
 * Whether the schedule fires in every hour of the day, which is what makes it an
 * interval rather than an appointment. Such a schedule is followed on absolute time:
 * it runs through both passes of a repeated hour and simply loses a skipped one,
 * keeping its spacing, whereas an hour-pinned schedule keeps its wall-clock time.
 *
 * @param fields - The parsed schedule.
 * @returns `true` when the hour field admits all 24 hours.
 */
function followsAbsoluteTime(fields: CronFieldSet): boolean {
	return fields.hours.length === HOURS_PER_DAY;
}

/**
 * The first occurrence strictly after an instant.
 *
 * @param fields - The parsed schedule.
 * @param from - Milliseconds since the epoch; an occurrence exactly on it is past.
 * @param timeZone - IANA time zone name the schedule is evaluated in.
 * @returns The occurrence in milliseconds, or `null` when the zone is unknown, the
 * start is not a finite timestamp, or nothing matches inside the search horizon.
 *
 * @example
 * nextOccurrence(fields, Date.UTC(2026, 2, 7, 12), "America/New_York");
 */
export function nextOccurrence(
	fields: CronFieldSet,
	from: number,
	timeZone: string,
): number | null {
	if (followsAbsoluteTime(fields)) return nextByMinute(fields, from, timeZone);
	return nextByWallClock(fields, from, timeZone);
}

/**
 * The last occurrence strictly before an instant.
 *
 * @param fields - The parsed schedule.
 * @param from - Milliseconds since the epoch; an occurrence exactly on it is not
 * returned, so `prev` and `next` never report the same instant for the same input.
 * @param timeZone - IANA time zone name the schedule is evaluated in.
 * @returns The occurrence in milliseconds, or `null` when the zone is unknown, the
 * start is not a finite timestamp, or nothing matches inside the search horizon.
 */
export function previousOccurrence(
	fields: CronFieldSet,
	from: number,
	timeZone: string,
): number | null {
	if (followsAbsoluteTime(fields)) return previousByMinute(fields, from, timeZone);
	return previousByWallClock(fields, from, timeZone);
}

/**
 * Walk absolute time forward a minute at a time, skipping whole days the schedule
 * cannot fire on. A schedule reaching here fires at least once an hour, so a matching
 * day yields a match within an hour of stepping.
 *
 * @param fields - The parsed schedule.
 * @param from - Milliseconds since the epoch, exclusive.
 * @param timeZone - IANA time zone name.
 * @returns The occurrence, or `null` when nothing matches inside the horizon.
 */
function nextByMinute(fields: CronFieldSet, from: number, timeZone: string): number | null {
	let start = zonedPartsOf(from, timeZone);
	if (start === null) return null;

	let horizon = start.year + MAX_SEARCH_YEARS;
	let cursor = Math.floor(from / MINUTE_MS) * MINUTE_MS + MINUTE_MS;

	for (let turn = 0; turn < MAX_ITERATIONS; turn++) {
		let parts = zonedPartsOf(cursor, timeZone);
		if (parts === null) return null;
		if (parts.year > horizon) return null;

		if (!matchesDate(fields, parts)) {
			let jump = startOfNextMatchingDay(fields, parts, timeZone, horizon);
			if (jump === null) return null;
			cursor = Math.max(jump, cursor + MINUTE_MS);
			continue;
		}

		if (fields.minutes.includes(parts.minute)) return cursor;
		cursor += MINUTE_MS;
	}

	return null;
}

/**
 * Walk absolute time backward a minute at a time, skipping whole days the schedule
 * cannot fire on.
 *
 * @param fields - The parsed schedule.
 * @param from - Milliseconds since the epoch, exclusive.
 * @param timeZone - IANA time zone name.
 * @returns The occurrence, or `null` when nothing matches inside the horizon.
 */
function previousByMinute(fields: CronFieldSet, from: number, timeZone: string): number | null {
	let start = zonedPartsOf(from, timeZone);
	if (start === null) return null;

	let horizon = start.year - MAX_SEARCH_YEARS;
	let cursor = Math.ceil(from / MINUTE_MS) * MINUTE_MS - MINUTE_MS;

	for (let turn = 0; turn < MAX_ITERATIONS; turn++) {
		let parts = zonedPartsOf(cursor, timeZone);
		if (parts === null) return null;
		if (parts.year < horizon) return null;

		if (!matchesDate(fields, parts)) {
			let jump = endOfPreviousMatchingDay(fields, parts, timeZone, horizon);
			if (jump === null) return null;
			cursor = Math.min(jump, cursor - MINUTE_MS);
			continue;
		}

		if (fields.minutes.includes(parts.minute)) return cursor;
		cursor -= MINUTE_MS;
	}

	return null;
}

/**
 * The first instant of the next date the schedule can fire on, found on the calendar
 * rather than by stepping, so a yearly schedule skips the months in between at once.
 *
 * @param fields - The parsed schedule.
 * @param from - Wall-clock fields of where the search stands.
 * @param timeZone - IANA time zone name.
 * @param horizon - Year past which to give up.
 * @returns Midnight of that date as an instant, or `null` past the horizon.
 */
function startOfNextMatchingDay(
	fields: CronFieldSet,
	from: WallClock,
	timeZone: string,
	horizon: number,
): number | null {
	let cursor: WallClock = { ...from, hour: 0, minute: 0 };

	for (let turn = 0; turn < MAX_ITERATIONS; turn++) {
		if (fields.months.includes(cursor.month)) startOfNextDay(cursor);
		else startOfNextMonth(cursor);

		if (cursor.year > horizon) return null;
		if (matchesDate(fields, cursor)) return instantFromWallClock(cursor, timeZone);
	}

	return null;
}

/**
 * The last minute of the previous date the schedule can fire on.
 *
 * @param fields - The parsed schedule.
 * @param from - Wall-clock fields of where the search stands.
 * @param timeZone - IANA time zone name.
 * @param horizon - Year before which to give up.
 * @returns That date's 23:59 as an instant, or `null` past the horizon.
 */
function endOfPreviousMatchingDay(
	fields: CronFieldSet,
	from: WallClock,
	timeZone: string,
	horizon: number,
): number | null {
	let cursor: WallClock = { ...from, hour: 23, minute: 59 };

	for (let turn = 0; turn < MAX_ITERATIONS; turn++) {
		if (fields.months.includes(cursor.month)) endOfPreviousDay(cursor);
		else endOfPreviousMonth(cursor);

		if (cursor.year < horizon) return null;
		if (matchesDate(fields, cursor)) return lastInstantOfDay(cursor, timeZone);
	}

	return null;
}

/**
 * The last instant a date covers in a zone, read as one minute before the next date
 * starts rather than as that date's 23:59. When a clock is set back at midnight the
 * final hour of the day happens twice, and 23:59 on its own names the first pass;
 * resuming a backward walk there would skip every occurrence in the second.
 *
 * @param day - Wall-clock fields of the date; its time of day is ignored.
 * @param timeZone - IANA time zone name.
 * @returns That date's final minute as an instant, or `null` for an unknown zone.
 */
function lastInstantOfDay(day: WallClock, timeZone: string): number | null {
	let nextDay: WallClock = { ...day };
	startOfNextDay(nextDay);
	let start = instantFromWallClock(nextDay, timeZone);
	if (start === null) return null;
	return start - MINUTE_MS;
}

/**
 * Walk the zone's wall clock forward until every field lines up, then read the
 * instant that wall time names. Keeping the walk on the wall clock is what holds an
 * appointment at its local time when the offset changes underneath it.
 *
 * @param fields - The parsed schedule.
 * @param from - Milliseconds since the epoch, exclusive.
 * @param timeZone - IANA time zone name.
 * @returns The occurrence, or `null` when nothing matches inside the horizon.
 */
function nextByWallClock(fields: CronFieldSet, from: number, timeZone: string): number | null {
	let parts = zonedPartsOf(from, timeZone);
	if (parts === null) return null;

	// The minute `from` falls in is a candidate: an occurrence inside it is still before
	// or after `from` once the seconds are taken into account, and the instant
	// comparisons below are what decide. Stepping off it here would drop it instead.
	let cursor = cursorFrom(parts);
	if (offsetMovedEarlierInDay(parts, from, timeZone)) {
		// A wall time the clock skipped is carried past the jump, so it names an instant
		// later than the wall times that follow it. Walking on from `from` alone would
		// step over that carried run for anyone asking between the jump and the run
		// itself, while `prev` still reports it, so the day is re-read from the top. The
		// candidates that precede `from` cost a turn each and are rejected below.
		cursor.hour = 0;
		cursor.minute = 0;
	}
	let horizon = parts.year + MAX_SEARCH_YEARS;

	for (let turn = 0; turn < MAX_ITERATIONS; turn++) {
		if (cursor.year > horizon) return null;

		if (!fields.months.includes(cursor.month)) {
			startOfNextMonth(cursor);
			continue;
		}

		if (!matchesDate(fields, cursor)) {
			startOfNextDay(cursor);
			continue;
		}

		let hour = firstAtLeast(fields.hours, cursor.hour);
		if (hour === undefined) {
			startOfNextDay(cursor);
			continue;
		}
		if (hour !== cursor.hour) {
			cursor.hour = hour;
			cursor.minute = 0;
		}

		let minute = firstAtLeast(fields.minutes, cursor.minute);
		if (minute === undefined) {
			startOfNextHour(cursor);
			continue;
		}
		cursor.minute = minute;

		let instant = instantFromWallClock(cursor, timeZone);
		if (instant === null) return null;
		if (instant > from) return instant;

		// The clock was set back, so this wall time already happened once and its
		// first pass is the occurrence. Keep walking rather than fire twice.
		addMinute(cursor);
	}

	return null;
}

/**
 * Walk the zone's wall clock backward until every field lines up.
 *
 * @param fields - The parsed schedule.
 * @param from - Milliseconds since the epoch, exclusive.
 * @param timeZone - IANA time zone name.
 * @returns The occurrence, or `null` when nothing matches inside the horizon.
 */
function previousByWallClock(fields: CronFieldSet, from: number, timeZone: string): number | null {
	let parts = zonedPartsOf(from, timeZone);
	if (parts === null) return null;

	// As going forward, the minute `from` falls in is a candidate and the instant
	// comparison below is what rules it out.
	let cursor = cursorFrom(parts);
	let horizon = parts.year - MAX_SEARCH_YEARS;

	for (let turn = 0; turn < MAX_ITERATIONS; turn++) {
		if (cursor.year < horizon) return null;

		if (!fields.months.includes(cursor.month)) {
			endOfPreviousMonth(cursor);
			continue;
		}

		if (!matchesDate(fields, cursor)) {
			endOfPreviousDay(cursor);
			continue;
		}

		let hour = lastAtMost(fields.hours, cursor.hour);
		if (hour === undefined) {
			endOfPreviousDay(cursor);
			continue;
		}
		if (hour !== cursor.hour) {
			cursor.hour = hour;
			cursor.minute = 59;
		}

		let minute = lastAtMost(fields.minutes, cursor.minute);
		if (minute === undefined) {
			endOfPreviousHour(cursor);
			continue;
		}
		cursor.minute = minute;

		let instant = instantFromWallClock(cursor, timeZone);
		if (instant === null) return null;
		if (instant < from) return instant;

		subtractMinute(cursor);
	}

	return null;
}

/**
 * Whether the zone's offset changed between the start of an instant's local day and
 * the instant itself. That is the only way an earlier wall time can name a later
 * instant, so it is the only case in which a forward walk has to reconsider the part
 * of the day already behind it.
 *
 * The day's start is taken as the elapsed wall-clock minutes back from `from`, which
 * lands a transition's worth early on a day that had one. Being early only answers
 * `true` more readily, and the thorough walk that answer selects is always correct.
 *
 * @param parts - Zoned fields of `from`, for the minutes elapsed since midnight.
 * @param from - Milliseconds since the epoch.
 * @param timeZone - IANA time zone name.
 * @returns `true` when the day is one whose clock moved before this instant.
 */
function offsetMovedEarlierInDay(parts: ZonedParts, from: number, timeZone: string): boolean {
	let elapsed = (parts.hour * 60 + parts.minute) * MINUTE_MS;
	return offsetAt(from, timeZone) !== offsetAt(from - elapsed, timeZone);
}

/**
 * A mutable wall clock to walk, seconds dropped because occurrences land on minutes.
 *
 * @param parts - Zoned fields of the instant the search starts at.
 * @returns The starting cursor.
 */
function cursorFrom(parts: ZonedParts): WallClock {
	return {
		year: parts.year,
		month: parts.month,
		day: parts.day,
		hour: parts.hour,
		minute: parts.minute,
	};
}

/**
 * Smallest allowed value at or above a bound.
 *
 * @param values - Sorted allowed values.
 * @param bound - Inclusive lower bound.
 * @returns The value, or `undefined` when the field has nothing left in this cycle.
 */
function firstAtLeast(values: readonly number[], bound: number): number | undefined {
	for (let value of values) if (value >= bound) return value;
	return undefined;
}

/**
 * Largest allowed value at or below a bound.
 *
 * @param values - Sorted allowed values.
 * @param bound - Inclusive upper bound.
 * @returns The value, or `undefined` when the field has nothing left in this cycle.
 */
function lastAtMost(values: readonly number[], bound: number): number | undefined {
	for (let index = values.length - 1; index >= 0; index--) {
		let value = values[index];
		if (value !== undefined && value <= bound) return value;
	}
	return undefined;
}

/** Advance a wall clock one minute, rolling hours, days, months, and years. */
function addMinute(cursor: WallClock): void {
	cursor.minute += 1;
	if (cursor.minute <= 59) return;
	cursor.minute = 0;
	cursor.hour += 1;
	if (cursor.hour <= 23) return;
	startOfNextDay(cursor);
}

/** Move a wall clock back one minute, rolling hours, days, months, and years. */
function subtractMinute(cursor: WallClock): void {
	cursor.minute -= 1;
	if (cursor.minute >= 0) return;
	cursor.minute = 59;
	cursor.hour -= 1;
	if (cursor.hour >= 0) return;
	cursor.hour = 23;
	previousDay(cursor);
}

/** Move to the first minute of the next hour, rolling into the next day. */
function startOfNextHour(cursor: WallClock): void {
	cursor.minute = 0;
	cursor.hour += 1;
	if (cursor.hour <= 23) return;
	startOfNextDay(cursor);
}

/** Move to the last minute of the previous hour, rolling into the previous day. */
function endOfPreviousHour(cursor: WallClock): void {
	cursor.minute = 59;
	cursor.hour -= 1;
	if (cursor.hour >= 0) return;
	cursor.hour = 23;
	previousDay(cursor);
}

/** Move to midnight of the next day, rolling into the next month and year. */
function startOfNextDay(cursor: WallClock): void {
	cursor.hour = 0;
	cursor.minute = 0;
	cursor.day += 1;
	if (cursor.day <= daysInMonth(cursor.year, cursor.month)) return;
	cursor.day = 1;
	cursor.month += 1;
	if (cursor.month <= 12) return;
	cursor.month = 1;
	cursor.year += 1;
}

/** Move to the last minute of the previous day, rolling back a month and year. */
function endOfPreviousDay(cursor: WallClock): void {
	cursor.hour = 23;
	cursor.minute = 59;
	previousDay(cursor);
}

/** Step the date back one day, keeping the time of day untouched. */
function previousDay(cursor: WallClock): void {
	cursor.day -= 1;
	if (cursor.day >= 1) return;
	cursor.month -= 1;
	if (cursor.month < 1) {
		cursor.month = 12;
		cursor.year -= 1;
	}
	cursor.day = daysInMonth(cursor.year, cursor.month);
}

/** Move to midnight of the first day of the next month, rolling the year. */
function startOfNextMonth(cursor: WallClock): void {
	cursor.hour = 0;
	cursor.minute = 0;
	cursor.day = 1;
	cursor.month += 1;
	if (cursor.month <= 12) return;
	cursor.month = 1;
	cursor.year += 1;
}

/** Move to the last minute of the last day of the previous month. */
function endOfPreviousMonth(cursor: WallClock): void {
	cursor.hour = 23;
	cursor.minute = 59;
	cursor.month -= 1;
	if (cursor.month < 1) {
		cursor.month = 12;
		cursor.year -= 1;
	}
	cursor.day = daysInMonth(cursor.year, cursor.month);
}
