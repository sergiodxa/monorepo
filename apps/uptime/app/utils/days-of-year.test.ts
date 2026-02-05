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
