/**
 * Proleptic Gregorian calendar arithmetic on plain wall-clock numbers: month
 * lengths and weekday of a date, so the occurrence search can walk a calendar
 * without an instant existing yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Length of each month in a common year, indexed by month number (1-12). */
const COMMON_YEAR_MONTH_LENGTHS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Sakamoto's month offsets, indexed by month number (1-12), used to derive a
 * weekday through arithmetic alone.
 */
const SAKAMOTO_MONTH_OFFSETS = [0, 0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];

/**
 * Whether a year has a 29th of February, by the Gregorian rule.
 *
 * @param year - Full year, e.g. `2028`.
 * @returns `true` for leap years, so `2100` is `false` and `2000` is `true`.
 *
 * @example
 * isLeapYear(2028); // true
 */
export function isLeapYear(year: number): boolean {
	if (year % 4 !== 0) return false;
	if (year % 100 !== 0) return true;
	return year % 400 === 0;
}

/**
 * Number of days a month actually has in a given year.
 *
 * @param year - Full year, which decides February's length.
 * @param month - Month number, 1 for January through 12 for December.
 * @returns Days in that month, or `0` for a month number outside 1-12.
 *
 * @example
 * daysInMonth(2026, 2); // 28
 */
export function daysInMonth(year: number, month: number): number {
	if (month === 2) return isLeapYear(year) ? 29 : 28;
	return COMMON_YEAR_MONTH_LENGTHS[month] ?? 0;
}

/**
 * The longest a month can ever be, February included at its leap-year length.
 * Used to decide whether a day-of-month value can occur in a month at all,
 * across every year.
 *
 * @param month - Month number, 1 for January through 12 for December.
 * @returns The month's maximum length, or `0` for a month outside 1-12.
 *
 * @example
 * longestMonth(2); // 29
 */
export function longestMonth(month: number): number {
	if (month === 2) return 29;
	return COMMON_YEAR_MONTH_LENGTHS[month] ?? 0;
}

/**
 * Weekday of a calendar date, computed arithmetically so years outside the range
 * `Date` treats specially (0-99) still resolve correctly.
 *
 * @param year - Full year.
 * @param month - Month number, 1-12.
 * @param day - Day of the month, 1-31.
 * @returns Day of the week with `0` for Sunday through `6` for Saturday, matching
 * how cron numbers its day-of-week field.
 *
 * @example
 * weekdayOf(2026, 3, 2); // 1 (a Monday)
 */
export function weekdayOf(year: number, month: number, day: number): number {
	let shifted = month < 3 ? year - 1 : year;
	let leapDays = Math.floor(shifted / 4) - Math.floor(shifted / 100) + Math.floor(shifted / 400);
	let offset = SAKAMOTO_MONTH_OFFSETS[month] ?? 0;
	return (((shifted + leapDays + offset + day) % 7) + 7) % 7;
}
