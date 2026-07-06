/**
 * Unit tests for the `daysOfYear` helper. They verify it returns every date in the year
 * containing a given date (365 entries for a common year, 366 for a leap year) and that
 * the range spans from January 1st to December 31st inclusive. They exist to guard the
 * date boundaries and leap-year handling the year-view heatmap depends on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import daysOfYear from "./days-of-year";

describe(daysOfYear, () => {
	test("returns an array of dates for the given year", () => {
		let dates = daysOfYear(new Date(2025, 0, 1));
		expect(dates.length).toBe(365);
		expect(dates.at(0)).toEqual(new Date(2025, 0, 1));
		expect(dates.at(-1)).toEqual(new Date(2025, 11, 31));
	});

	test("supports leap years", () => {
		let dates = daysOfYear(new Date(2024, 0, 1));
		expect(dates.length).toBe(366);
		expect(dates.at(0)).toEqual(new Date(2024, 0, 1));
		expect(dates.at(-1)).toEqual(new Date(2024, 11, 31));
	});
});
