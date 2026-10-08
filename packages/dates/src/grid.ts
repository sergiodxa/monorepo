/**
 * Day grids: the day lists a heatmap or calendar renders, the week bucketing that
 * lays them out in columns, and the six-week month a calendar pages through. They return plain descriptors so the calendar math
 * is shared while every UI layer keeps its own markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CalendarDay, Day, TimeZone, Weekday } from "./types.js";

import { toDayKey } from "./day-key.js";
import {
	calendarDayAt,
	calendarDayFromEpochDay,
	epochDayOf,
	shiftCalendarDay,
	startOfDayInstant,
	weekdayOf,
} from "./zone.js";

/** Where a rolling window ends, and the zone its days are measured in. */
export interface LastNDaysOptions {
	/** Last day of the window, inclusive; defaults to the current instant. */
	from?: Date;
	/** IANA zone whose calendar days the window is counted in. */
	timeZone: TimeZone;
}

/** How days are bucketed into weeks, and the zone the buckets are computed in. */
export interface GroupByWeekOptions {
	/** Weekday a week begins on, `0` Sunday through `6` Saturday. */
	weekStartsOn: Weekday;
	/** IANA zone whose calendar weeks the days are grouped by. */
	timeZone: TimeZone;
}

/** Weeks a month grid always holds, so a calendar keeps its height as it pages. */
const WEEKS_PER_MONTH_GRID = 6;

/** One cell of a month grid: a day descriptor plus whether the month being laid out owns it. */
export interface MonthGridDay extends Day {
	/** `false` for the padding days borrowed from the months either side. */
	inMonth: boolean;
}

/**
 * Build the descriptor for one calendar day in a zone, resolving its start instant, key
 * and weekday once so a grid renderer reuses the same zone-dependent fields throughout.
 *
 * @param day - Calendar day to describe.
 * @param timeZone - IANA zone the day belongs to.
 * @returns The day descriptor.
 */
function describeDay(day: CalendarDay, timeZone: TimeZone): Day {
	let date = new Date(startOfDayInstant(day, timeZone));
	return {
		...day,
		date,
		key: toDayKey(date, timeZone),
		weekday: weekdayOf(day),
		timeZone,
	};
}

/**
 * Every day of a calendar year, January 1st through December 31st, in a zone. Leap years
 * produce 366 entries, since the day count comes from the calendar's actual dates.
 *
 * @param year - Four-digit calendar year, e.g. `2026`.
 * @param timeZone - IANA zone whose calendar days to enumerate.
 * @returns Day descriptors in chronological order.
 *
 * @example
 * daysOfYear(2024, "UTC").length; // 366
 */
export function daysOfYear(year: number, timeZone: TimeZone): Day[] {
	let first = epochDayOf({ year, month: 1, day: 1 });
	let last = epochDayOf({ year, month: 12, day: 31 });

	let days: Day[] = [];
	for (let index = first; index <= last; index++) {
		days.push(describeDay(calendarDayFromEpochDay(index), timeZone));
	}
	return days;
}

/**
 * A rolling window of the last `count` calendar days, ending on the day `from` falls on
 * and including it. Each day is counted as one calendar date, keeping the window exactly
 * `count` entries long across a DST transition.
 *
 * @param count - Days the window covers, including its last day.
 * @param options - Where the window ends, and the zone to count days in.
 * @returns Day descriptors in chronological order, empty when `count` is under `1`.
 *
 * @example
 * lastNDays(30, { timeZone: "America/New_York" }).length; // 30
 * @example
 * lastNDays(7, { from: new Date("2026-07-29T12:00:00Z"), timeZone: "UTC" }).at(0)?.key;
 */
export function lastNDays(count: number, options: LastNDaysOptions): Day[] {
	if (count < 1) return [];

	let last = calendarDayAt((options.from ?? new Date()).getTime(), options.timeZone);
	let days: Day[] = [];
	for (let offset = count - 1; offset >= 0; offset--) {
		days.push(describeDay(shiftCalendarDay(last, -offset), options.timeZone));
	}
	return days;
}

/**
 * Bucket a chronological day list into weeks, one array per week, for a grid that lays
 * weeks out as columns. The first and last buckets stay short whenever the range starts
 * or ends mid-week, keeping every day in exactly one bucket.
 *
 * @param days - Days to bucket, in chronological order.
 * @param options - Which weekday starts a week, and the zone to compute it in.
 * @returns Week buckets in the order their days appeared.
 *
 * @example
 * groupByWeek(daysOfYear(2026, "UTC"), { weekStartsOn: 0, timeZone: "UTC" }).length; // 53
 */
export function groupByWeek(days: Day[], options: GroupByWeekOptions): Day[][] {
	let weeks = new Map<number, Day[]>();

	for (let day of days) {
		let calendar = calendarDayAt(day.date.getTime(), options.timeZone);
		let back = (weekdayOf(calendar) - options.weekStartsOn + 7) % 7;
		let weekStart = epochDayOf(calendar) - back;
		let week = weeks.get(weekStart);
		if (week) week.push(day);
		else weeks.set(weekStart, [day]);
	}

	return Array.from(weeks.values());
}

/**
 * The six weeks a calendar lays a month out as, starting on the `weekStartsOn` day on or
 * before the 1st. Padding days from the neighbouring months fill both ends, so every
 * month gets the same 6 × 7 grid and the calendar's height holds as it pages.
 *
 * @param date - Any instant in the month to lay out.
 * @param options - Which weekday starts a row, and the zone whose calendar to read.
 * @returns Six weeks of seven days each, in calendar order.
 *
 * @example
 * monthGrid(new Date("2026-06-15T12:00:00Z"), { weekStartsOn: 0, timeZone: "UTC" })[0]?.[0]?.key; // "2026-05-31"
 */
export function monthGrid(date: Date, options: GroupByWeekOptions): MonthGridDay[][] {
	let { year, month } = calendarDayAt(date.getTime(), options.timeZone);
	let first = { year, month, day: 1 };
	let start = epochDayOf(first) - ((weekdayOf(first) - options.weekStartsOn + 7) % 7);

	let weeks: MonthGridDay[][] = [];
	for (let week = 0; week < WEEKS_PER_MONTH_GRID; week++) {
		let days: MonthGridDay[] = [];
		for (let offset = 0; offset < 7; offset++) {
			let day = calendarDayFromEpochDay(start + week * 7 + offset);
			days.push({
				...describeDay(day, options.timeZone),
				inMonth: day.year === year && day.month === month,
			});
		}
		weeks.push(days);
	}
	return weeks;
}
