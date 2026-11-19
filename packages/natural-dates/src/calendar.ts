/**
 * Day arithmetic on `YYYY-MM-DD` strings, read as plain calendar days with no zone, which is what
 * every phrase resolves to once "today" is known in the caller's zone. Months clamp to their
 * last day, so "in a month" from January 31 lands on the end of February.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { calendarDayAt } from "@sdxc/dates/zone";

/** Milliseconds in a day. */
const DAY_MS = 86_400_000;

/** A `YYYY-MM-DD` day from its parts. */
export function dayOf(year: number, month: number, day: number): string {
	return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The day a zone's calendar shows at an instant. */
export function todayIn(now: Date, timeZone: string): string {
	let day = calendarDayAt(now.getTime(), timeZone);
	return dayOf(day.year, day.month, day.day);
}

/** A day's year, month and day. */
export function partsOf(date: string): { year: number; month: number; day: number } {
	return {
		year: Number(date.slice(0, 4)),
		month: Number(date.slice(5, 7)),
		day: Number(date.slice(8, 10)),
	};
}

/** A day moved by whole days. */
export function addDays(date: string, count: number): string {
	return new Date(Date.parse(`${date}T00:00:00Z`) + count * DAY_MS).toISOString().slice(0, 10);
}

/** The days in a month, `month` counted from 1. */
export function daysIn(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** A day moved by whole months, its day clamped to the target month's last. */
export function addMonths(date: string, count: number): string {
	let { year, month, day } = partsOf(date);
	let index = year * 12 + (month - 1) + count;
	let targetYear = Math.floor(index / 12);
	let targetMonth = (index % 12) + 1;
	return dayOf(targetYear, targetMonth, Math.min(day, daysIn(targetYear, targetMonth)));
}

/** A day's weekday, `0` for Sunday through `6` for Saturday. */
export function weekdayOf(date: string): number {
	return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** The first day on or after `date` that falls on `weekday`. */
export function onOrAfter(date: string, weekday: number): string {
	return addDays(date, (weekday - weekdayOf(date) + 7) % 7);
}

/** Whether a day exists, so "Feb 30" is refused rather than rolled into March. */
export function isRealDay(year: number, month: number, day: number): boolean {
	return month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year, month);
}
