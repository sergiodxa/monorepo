/**
 * Tests for the calendar helpers: that month lengths follow the Gregorian leap rule
 * including the century exceptions, and that weekdays come out with Sunday at zero,
 * since the occurrence search trusts both to walk dates that a `Date` never sees.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { daysInMonth, isLeapYear, longestMonth, weekdayOf } from "./calendar";

describe("isLeapYear", () => {
	test("follows the four, hundred, four hundred rule", () => {
		expect(isLeapYear(2024)).toBe(true);
		expect(isLeapYear(2026)).toBe(false);
		expect(isLeapYear(2028)).toBe(true);
		expect(isLeapYear(1900)).toBe(false);
		expect(isLeapYear(2000)).toBe(true);
		expect(isLeapYear(2100)).toBe(false);
		expect(isLeapYear(2400)).toBe(true);
	});
});

describe("daysInMonth", () => {
	test("gives each month its length", () => {
		expect(daysInMonth(2026, 1)).toBe(31);
		expect(daysInMonth(2026, 4)).toBe(30);
		expect(daysInMonth(2026, 6)).toBe(30);
		expect(daysInMonth(2026, 9)).toBe(30);
		expect(daysInMonth(2026, 11)).toBe(30);
		expect(daysInMonth(2026, 12)).toBe(31);
	});

	test("shortens February outside a leap year", () => {
		expect(daysInMonth(2026, 2)).toBe(28);
		expect(daysInMonth(2028, 2)).toBe(29);
		expect(daysInMonth(2100, 2)).toBe(28);
	});

	test("returns zero for a month number that cannot exist", () => {
		expect(daysInMonth(2026, 0)).toBe(0);
		expect(daysInMonth(2026, 13)).toBe(0);
	});
});

describe("longestMonth", () => {
	test("takes February at its leap-year length, since the year is unknown", () => {
		expect(longestMonth(2)).toBe(29);
		expect(longestMonth(4)).toBe(30);
		expect(longestMonth(1)).toBe(31);
	});
});

describe("weekdayOf", () => {
	test("numbers Sunday zero through Saturday six", () => {
		expect(weekdayOf(2026, 3, 1)).toBe(0);
		expect(weekdayOf(2026, 3, 2)).toBe(1);
		expect(weekdayOf(2026, 3, 6)).toBe(5);
		expect(weekdayOf(2026, 3, 7)).toBe(6);
	});

	test("agrees with the runtime across month, year, and leap-day boundaries", () => {
		let dates: [number, number, number][] = [
			[1970, 1, 1],
			[1999, 12, 31],
			[2000, 1, 1],
			[2000, 2, 29],
			[2024, 2, 29],
			[2026, 1, 1],
			[2026, 12, 31],
			[2028, 2, 29],
			[2100, 3, 1],
			[2400, 2, 29],
		];

		for (let [year, month, day] of dates) {
			expect(weekdayOf(year, month, day)).toBe(
				new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
			);
		}
	});
});
