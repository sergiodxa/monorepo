/**
 * Calendar comparisons and enumeration in an explicit zone: whether two instants
 * are the same day, how many day boundaries lie between them, and every day in a
 * range. All three count days rather than hours, so DST never shifts the answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Interval, TimeZone } from "./types";

import { calendarDayAt, calendarDayFromEpochDay, epochDayOf, startOfDayInstant } from "./zone";

/**
 * Calendar days from `b` to `a` in a zone: the count of day boundaries crossed
 * between them. An hour that crosses one midnight counts as `1`, and a DST
 * transition that makes a day 23 or 25 hours long still counts as exactly `1`.
 *
 * @param a - The instant measured from the later end.
 * @param b - The instant measured from the earlier end.
 * @param timeZone - IANA zone whose calendar days to count.
 * @returns Whole days, positive when `a` is on a later day than `b`.
 *
 * @example
 * diffInDays(new Date("2026-07-30T01:00:00Z"), new Date("2026-07-29T23:00:00Z"), "UTC"); // 1
 */
export function diffInDays(a: Date, b: Date, timeZone: TimeZone): number {
	return (
		epochDayOf(calendarDayAt(a.getTime(), timeZone)) -
		epochDayOf(calendarDayAt(b.getTime(), timeZone))
	);
}

/**
 * Whether two instants fall on the same calendar day in a zone. The same pair of
 * instants can be the same day in one zone and different days in another, which is
 * exactly why callers must name the zone explicitly.
 *
 * @param a - First instant.
 * @param b - Second instant.
 * @param timeZone - IANA zone whose calendar to compare in.
 * @returns `true` when both fall on the same year, month and day there.
 *
 * @example
 * isSameDay(a, b, "UTC"); // true
 * isSameDay(a, b, "America/New_York"); // false
 */
export function isSameDay(a: Date, b: Date, timeZone: TimeZone): boolean {
	let left = calendarDayAt(a.getTime(), timeZone);
	let right = calendarDayAt(b.getTime(), timeZone);
	return left.year === right.year && left.month === right.month && left.day === right.day;
}

/**
 * Every calendar day touched by an interval, as the instant each day starts at in
 * the zone. Both ends are inclusive, and the step is one calendar day, so a 23-hour
 * or 25-hour day still produces exactly one entry.
 *
 * @param interval - Inclusive range of instants to cover.
 * @param timeZone - IANA zone whose calendar days to enumerate.
 * @returns Day starts in chronological order, or an empty array when `end` falls on
 * a day before `start`, treating a range that covers nothing as a normal, empty result.
 *
 * @example
 * eachDayOfInterval({ start, end }, "America/New_York").length; // 5
 */
export function eachDayOfInterval(interval: Interval, timeZone: TimeZone): Date[] {
	let first = epochDayOf(calendarDayAt(interval.start.getTime(), timeZone));
	let last = epochDayOf(calendarDayAt(interval.end.getTime(), timeZone));
	if (last < first) return [];

	let days: Date[] = [];
	for (let index = first; index <= last; index++) {
		days.push(new Date(startOfDayInstant(calendarDayFromEpochDay(index), timeZone)));
	}
	return days;
}
