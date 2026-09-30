/**
 * The words a calendar preview puts around its dates: the month a grid is paged to, the
 * weekday column captions, and the human phrasing of a distance between two days.
 *
 * Every function reads a date's local year, month and day, matching the keys a month grid
 * names its cells by, so a label never disagrees with the cell it sits on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { diffInDays, formatWeekday } from "@sdxc/dates";

import { dayKey } from "~/app/services/month-grid";

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
	weekday: "long",
	month: "long",
	day: "numeric",
});

/**
 * The month and year a calendar heading reads as.
 *
 * @param month - Any day of the month being shown.
 * @returns The month's name and year, e.g. `"June 2026"`.
 */
export function monthLabel(month: Date): string {
	return MONTH_FORMAT.format(month);
}

/**
 * The seven weekday captions a grid header carries, Sunday first, matching the column
 * order a month grid lays its days out in.
 *
 * @returns Short weekday names in calendar order.
 */
export function weekdayLabels(): string[] {
	return ([0, 1, 2, 3, 4, 5, 6] as const).map((weekday) =>
		formatWeekday(weekday, { locale: "en-US" }),
	);
}

/**
 * The full date a day cell announces to assistive technology, since the cell itself shows
 * only the day number.
 *
 * @param date - The day being announced.
 * @returns The weekday, month and day, e.g. `"Monday, June 15"`.
 */
export function dayLabel(date: Date): string {
	return DAY_FORMAT.format(date);
}

/**
 * A day parsed out of the `YYYY-MM-DD` value a native date input carries, at local
 * midnight so it lands on the same calendar day the person picked.
 *
 * @param value - A date input's value, which is empty until a day is picked.
 * @returns The day, or `null` when the value is empty or malformed.
 */
export function parseDayValue(value: string): Date | null {
	let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (match === null) return null;

	let [, year, month, day] = match;
	return new Date(Number(year), Number(month) - 1, Number(day));
}

/**
 * Whole days from one day to another, counted as calendar days in the zone the page runs
 * in, where every day here sits at local midnight, so a distance stays an integer across
 * a daylight-saving boundary.
 *
 * @param from - The day counted from.
 * @param to - The day counted to.
 * @returns The signed number of days, positive when `to` comes later.
 */
export function dayDistance(from: Date, to: Date): number {
	return diffInDays(to, from, Intl.DateTimeFormat().resolvedOptions().timeZone);
}

/**
 * How a form describes a picked day relative to today, which is the supporting copy a
 * date field carries so a person can sanity-check the date without counting.
 *
 * @param picked - The day the field holds, or `null` while it is empty.
 * @param today - The day being counted from.
 * @returns The phrasing to show beneath the field.
 */
export function relativeDayHint(picked: Date | null, today: Date): string {
	if (picked === null) return "Claims are accepted for dates in the current quarter.";

	let distance = dayDistance(today, picked);
	if (distance === 0) return "Today — this claim posts in the current period.";
	if (distance === 1) return "Tomorrow — this claim posts in the next period.";
	if (distance === -1) return "Yesterday — 1 day ago.";
	if (distance > 1) return `${distance} days from today.`;
	return `${Math.abs(distance)} days ago.`;
}

/** An inclusive pair of `YYYY-MM-DD` bounds a date input accepts a value between. */
export interface DayBounds {
	min: string;
	max: string;
}

/**
 * The first and last day of the calendar quarter a day falls in, which is the window an
 * expense claim has to be dated inside.
 *
 * @param today - Any day of the quarter.
 * @returns The quarter's first and last day as date-input values.
 */
export function quarterBounds(today: Date): DayBounds {
	let firstMonth = Math.floor(today.getMonth() / 3) * 3;
	let year = today.getFullYear();
	return {
		min: dayKey(new Date(year, firstMonth, 1)),
		max: dayKey(new Date(year, firstMonth + 3, 0)),
	};
}

/**
 * How a stay's length reads beside a check-in and check-out pair, which is the one number
 * a person checks before booking.
 *
 * @param start - The check-in day, or `null` while it is empty.
 * @param end - The check-out day, or `null` while it is empty.
 * @returns The phrasing to show beneath the range.
 */
export function stayLengthHint(start: Date | null, end: Date | null): string {
	if (start === null || end === null) return "Pick both dates to see the length of the stay.";

	let nights = dayDistance(start, end);
	if (nights <= 0) return "Check-out has to come after check-in.";
	return nights === 1 ? "1 night" : `${nights} nights`;
}
