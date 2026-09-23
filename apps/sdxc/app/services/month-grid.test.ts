/**
 * Covers the grid a calendar page is drawn from. A cell's key is what a keyboard
 * mixin matches a focused day against, so the assertions below are what keep the
 * padding days, the month boundaries and the zero padding lining up with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { dayKey, monthGrid } from "~/app/services/month-grid";

describe("dayKey", () => {
	test("names a day from its local components", () => {
		expect(dayKey(new Date(2026, 5, 15))).toBe("2026-06-15");
	});

	test("pads a single-digit month and day", () => {
		expect(dayKey(new Date(2026, 0, 2))).toBe("2026-01-02");
	});

	test("reads the local day of an instant late in the day", () => {
		expect(dayKey(new Date(2026, 5, 15, 23, 59))).toBe("2026-06-15");
	});
});

describe("monthGrid", () => {
	test("lays six weeks of seven days out", () => {
		let weeks = monthGrid(new Date(2026, 5, 15));

		expect(weeks).toHaveLength(6);
		for (let week of weeks) expect(week.days).toHaveLength(7);
	});

	test("starts on the Sunday on or before the first of the month", () => {
		expect(
			monthGrid(new Date(2026, 5, 15))
				.at(0)
				?.days.at(0)?.key,
		).toBe("2026-05-31");
	});

	test("starts on the first itself when the month opens on a Sunday", () => {
		expect(
			monthGrid(new Date(2026, 2, 10))
				.at(0)
				?.days.at(0)?.key,
		).toBe("2026-03-01");
	});

	test("marks the days either side of the month", () => {
		let weeks = monthGrid(new Date(2026, 5, 15));

		expect(weeks.at(0)?.days.at(0)?.outsideMonth).toBe(true);
		expect(weeks.at(0)?.days.at(1)?.outsideMonth).toBe(false);
		expect(weeks.at(5)?.days.at(6)?.outsideMonth).toBe(true);
	});

	test("runs one day at a time across a month boundary", () => {
		let days = monthGrid(new Date(2026, 5, 15)).flatMap((week) => week.days);
		let keys = days.map((day) => day.key);

		expect(keys).toHaveLength(42);
		expect(keys.slice(0, 3)).toEqual(["2026-05-31", "2026-06-01", "2026-06-02"]);
		expect(keys.at(-1)).toBe("2026-07-11");
	});

	test("crosses into the next year from December", () => {
		let keys = monthGrid(new Date(2026, 11, 1)).flatMap((week) => week.days.map((day) => day.key));

		expect(keys).toContain("2026-12-31");
		expect(keys).toContain("2027-01-01");
	});

	test("names a week by its first day", () => {
		let week = monthGrid(new Date(2026, 5, 15)).at(1);

		expect(week?.key).toBe(week?.days.at(0)?.key);
	});
});
