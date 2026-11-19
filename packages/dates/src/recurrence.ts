/**
 * Expands a repeating event into the occurrences a window shows, keeping the first
 * occurrence's wall-clock time in the series' zone across DST, so a 09:00 meeting
 * stays at 09:00 local while its UTC instant moves. Day stepping follows RFC 5545.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TimeZone, Weekday } from "./types.js";
import type { ZonedParts } from "./zone.js";

import { formatDayKey } from "./day-key.js";
import {
	calendarDayFromEpochDay,
	DAY_MS,
	daysInMonth,
	epochDayOf,
	instantFromParts,
	zonedParts,
} from "./zone.js";

/**
 * The most periods (days, weeks, months or years) one expansion steps through, so a
 * rule whose count, end and window all sit far away still returns promptly.
 */
const MAX_PERIODS = 10_000;

/** How often a series repeats, before its `interval` multiplies it. */
export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

/**
 * How a series repeats after its first occurrence. A series ends at whichever of
 * `count` and `until` comes first, and runs on without either; the window passed to
 * `expandRecurrence` bounds what one call returns.
 */
export interface Recurrence {
	frequency: Frequency;
	/**
	 * Periods between repeats: `2` with `"weekly"` is every other week.
	 * @default 1
	 */
	interval?: number;
	/**
	 * Weekdays a `"weekly"` series meets on in each of its weeks, which start on
	 * Monday. The first occurrence always counts; listed days before it in its week are
	 * skipped. Without the list, the series meets on the first occurrence's weekday.
	 */
	weekdays?: Weekday[];
	/** Total occurrences from the first one, exceptions included, as RFC 5545 counts. */
	count?: number;
	/** The last instant an occurrence may start at, inclusive. */
	until?: Date;
	/**
	 * `"YYYY-MM-DD"` keys of days, in the series' zone, whose occurrence is skipped. A
	 * skipped occurrence still uses up its place in `count` and its `index`.
	 */
	exceptions?: string[];
}

/** One meeting of a series, with its position counted from the first occurrence. */
export interface Occurrence {
	start: Date;
	end: Date;
	/** `0` for the first occurrence, counting every one since, exceptions included. */
	index: number;
}

/**
 * A span between two instants: the first occurrence, whose length every later one
 * keeps, or the half-open window an expansion lists.
 */
export interface TimeSpan {
	start: Date;
	end: Date;
}

/**
 * Where a series' days come from: the first occurrence's wall clock and day index,
 * its Monday-based week, and the rule normalized so stepping needs no defaults.
 */
interface Series {
	clock: ZonedParts;
	firstEpochDay: number;
	/** Day offsets from Monday the series meets on each week, ascending. */
	weekOffsets: number[];
	interval: number;
	frequency: Frequency;
}

/**
 * Days since Monday for a weekday, so Monday is `0` and Sunday `6`.
 *
 * @param weekday - `0` Sunday through `6` Saturday.
 * @returns The weekday's position in a Monday-first week.
 */
function mondayOffset(weekday: number): number {
	return (weekday + 6) % 7;
}

/**
 * The calendar days one period of a series meets on, in order. A month without the
 * first occurrence's day, or a year without its February 29th, contributes no days,
 * so a monthly series on the 31st skips short months instead of moving to their end.
 *
 * @param series - The normalized series.
 * @param period - Periods since the first occurrence's, `0` being its own.
 * @returns Day indexes in ascending order, possibly none.
 */
function daysInPeriod(series: Series, period: number): number[] {
	let { clock, firstEpochDay, interval } = series;
	let step = period * interval;
	if (series.frequency === "daily") return [firstEpochDay + step];
	if (series.frequency === "weekly") {
		let firstOffset = mondayOffset(new Date(firstEpochDay * DAY_MS).getUTCDay());
		let monday = firstEpochDay - firstOffset + step * 7;
		if (period > 0) return series.weekOffsets.map((offset) => monday + offset);
		let later = series.weekOffsets.filter((offset) => offset > firstOffset);
		return [firstEpochDay, ...later.map((offset) => monday + offset)];
	}
	let months = series.frequency === "monthly" ? step : step * 12;
	let index = clock.year * 12 + (clock.month - 1) + months;
	let year = Math.floor(index / 12);
	let month = index - year * 12 + 1;
	if (clock.day > daysInMonth(year, month)) return [];
	return [epochDayOf({ year, month, day: clock.day })];
}

/**
 * How many occurrences the periods before `period` hold, for a frequency whose every
 * period holds the same number after the first. That lets a window deep into a daily
 * or weekly series start stepping near itself with its indexes still exact.
 *
 * @param series - A daily or weekly series.
 * @param period - The period to start stepping at.
 * @returns Occurrences in periods `0` through `period - 1`.
 */
function occurrencesBefore(series: Series, period: number): number {
	if (period === 0) return 0;
	let perPeriod = series.frequency === "weekly" ? series.weekOffsets.length : 1;
	return daysInPeriod(series, 0).length + (period - 1) * perPeriod;
}

/**
 * The first period that can overlap the window. Daily and weekly periods are a fixed
 * number of days, so the periods ending before the window are skipped by arithmetic,
 * keeping one spare period for the hour a DST change shifts an occurrence by.
 *
 * @param series - The normalized series.
 * @param firstStart - The first occurrence's start, in milliseconds.
 * @param durationMs - Each occurrence's length.
 * @param windowStart - The window's start, in milliseconds.
 * @returns A period at or before the first one the window shows.
 */
function firstPeriodNear(
	series: Series,
	firstStart: number,
	durationMs: number,
	windowStart: number,
): number {
	if (series.frequency === "monthly" || series.frequency === "yearly") return 0;
	let periodMs = series.interval * (series.frequency === "weekly" ? 7 : 1) * DAY_MS;
	let skipped = Math.floor((windowStart - durationMs - firstStart) / periodMs) - 1;
	return Math.max(0, skipped);
}

/**
 * The series a first occurrence and a rule describe in a zone, or `null` when the
 * rule can produce nothing: an interval under one, or a weekly series with no weekdays.
 *
 * @param start - The first occurrence's start, in milliseconds.
 * @param rule - The repeat rule.
 * @param timeZone - The series' zone.
 * @returns The normalized series.
 */
function seriesOf(start: number, rule: Recurrence, timeZone: TimeZone): Series | null {
	let interval = Math.floor(rule.interval ?? 1);
	if (!(interval >= 1)) return null;
	let clock = zonedParts(start, timeZone);
	let firstEpochDay = epochDayOf(clock);
	let weekdays = rule.weekdays ?? [new Date(firstEpochDay * DAY_MS).getUTCDay()];
	let weekOffsets = [...new Set(weekdays.map(mondayOffset))].sort((a, b) => a - b);
	if (rule.frequency === "weekly" && weekOffsets.length === 0) return null;
	return { clock, firstEpochDay, weekOffsets, interval, frequency: rule.frequency };
}

/**
 * Every occurrence of a repeating event that overlaps a half-open window, in order.
 * Each one starts at the first occurrence's wall-clock time in `timeZone` and lasts
 * as many elapsed milliseconds; a time a spring-forward gap skips lands that far later.
 *
 * Expansion stops at the window's end, at `until`, at `count`, or after 10,000
 * periods. An interval under one, an empty weekday list or an invalid date yields `[]`.
 *
 * @param first - The first occurrence, which is always occurrence `0`.
 * @param rule - How the event repeats.
 * @param window - The span to list, `start` inclusive and `end` exclusive.
 * @param timeZone - IANA zone whose wall clock the series keeps.
 * @returns Occurrences overlapping the window, earliest first.
 *
 * @example
 * expandRecurrence(
 *   { start: new Date("2026-03-02T14:00:00Z"), end: new Date("2026-03-02T15:00:00Z") },
 *   { frequency: "weekly", count: 3 },
 *   { start: new Date("2026-03-01T00:00:00Z"), end: new Date("2026-04-01T00:00:00Z") },
 *   "America/New_York",
 * ); // 09:00 New York each Monday: 14:00Z, then 13:00Z on March 9 and 16
 */
export function expandRecurrence(
	first: TimeSpan,
	rule: Recurrence,
	window: TimeSpan,
	timeZone: TimeZone,
): Occurrence[] {
	let firstStart = first.start.getTime();
	let durationMs = first.end.getTime() - firstStart;
	let windowStart = window.start.getTime();
	let windowEnd = window.end.getTime();
	let until = rule.until?.getTime() ?? Number.POSITIVE_INFINITY;
	let count = rule.count ?? Number.POSITIVE_INFINITY;
	if ([firstStart, durationMs, windowStart, windowEnd, until].some(Number.isNaN)) return [];
	let series = seriesOf(firstStart, rule, timeZone);
	if (series === null) return [];

	let exceptions = new Set(rule.exceptions);
	let occurrences: Occurrence[] = [];
	let period = firstPeriodNear(series, firstStart, durationMs, windowStart);
	let index = occurrencesBefore(series, period);
	for (let limit = period + MAX_PERIODS; period < limit; period++) {
		for (let epochDay of daysInPeriod(series, period)) {
			let day = calendarDayFromEpochDay(epochDay);
			let start = instantFromParts({ ...series.clock, ...day }, timeZone);
			if (index >= count || start > until || start >= windowEnd) return occurrences;
			let end = start + durationMs;
			let overlaps = end > windowStart || start >= windowStart;
			if (overlaps && !exceptions.has(formatDayKey(day))) {
				occurrences.push({ start: new Date(start), end: new Date(end), index });
			}
			index++;
		}
	}
	return occurrences;
}
