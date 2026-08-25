/**
 * Tests for the day grids: that a year enumerates every day including leap day, that a
 * rolling window is exactly as long as asked, and that week bucketing keeps every day in
 * its partial week at both ends of a range.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { daysOfYear, groupByWeek, lastNDays } from "./grid";

/** Zone whose DST transitions make a naive 24-hour step drift. */
const NEW_YORK = "America/New_York";

describe("daysOfYear", () => {
	test("returns every day of a common year", () => {
		let days = daysOfYear(2025, "UTC");
		expect(days).toHaveLength(365);
		expect(days.at(0)?.key).toBe("2025-01-01");
		expect(days.at(-1)?.key).toBe("2025-12-31");
	});

	test("supports leap years", () => {
		let days = daysOfYear(2024, "UTC");
		expect(days).toHaveLength(366);
		expect(days.at(0)?.key).toBe("2024-01-01");
		expect(days.at(-1)?.key).toBe("2024-12-31");
		expect(days.some((day) => day.key === "2024-02-29")).toBe(true);
	});

	test("describes each day with its calendar fields and start instant", () => {
		expect(daysOfYear(2025, "UTC").at(0)).toEqual({
			year: 2025,
			month: 1,
			day: 1,
			date: new Date("2025-01-01T00:00:00.000Z"),
			key: "2025-01-01",
			weekday: 3,
			timeZone: "UTC",
		});
	});

	test("starts each day in the zone asked for", () => {
		expect(daysOfYear(2026, NEW_YORK).at(0)?.date.toISOString()).toBe("2026-01-01T05:00:00.000Z");
		expect(daysOfYear(2026, "Asia/Tokyo").at(0)?.date.toISOString()).toBe(
			"2025-12-31T15:00:00.000Z",
		);
	});

	test("keeps day keys unique and consecutive", () => {
		let days = daysOfYear(2026, NEW_YORK);
		expect(new Set(days.map((day) => day.key)).size).toBe(days.length);
		for (let index = 1; index < days.length; index++) {
			let previous = days[index - 1]?.date.getTime() ?? 0;
			expect(days[index]?.date.getTime()).toBeGreaterThan(previous);
		}
	});
});

describe("lastNDays", () => {
	test("ends on the day the reference instant falls on", () => {
		let days = lastNDays(3, { from: new Date("2026-07-29T12:00:00Z"), timeZone: "UTC" });
		expect(days.map((day) => day.key)).toEqual(["2026-07-27", "2026-07-28", "2026-07-29"]);
	});

	test("returns a single day for a window of one", () => {
		let days = lastNDays(1, { from: new Date("2026-07-29T12:00:00Z"), timeZone: "UTC" });
		expect(days.map((day) => day.key)).toEqual(["2026-07-29"]);
	});

	test("counts calendar days in the zone asked for", () => {
		let from = new Date("2026-07-29T02:00:00Z");
		expect(lastNDays(2, { from, timeZone: "UTC" }).map((day) => day.key)).toEqual([
			"2026-07-28",
			"2026-07-29",
		]);
		expect(lastNDays(2, { from, timeZone: NEW_YORK }).map((day) => day.key)).toEqual([
			"2026-07-27",
			"2026-07-28",
		]);
	});

	test("returns nothing for a window shorter than a day", () => {
		expect(lastNDays(0, { timeZone: "UTC" })).toEqual([]);
		expect(lastNDays(-5, { timeZone: "UTC" })).toEqual([]);
	});

	test("ends today when no reference instant is given", () => {
		let days = lastNDays(2, { timeZone: "UTC" });
		expect(days).toHaveLength(2);
		expect(days.at(-1)?.date.getTime()).toBeLessThanOrEqual(Date.now());
	});
});

describe("groupByWeek", () => {
	test("buckets a year into weekly columns", () => {
		let weeks = groupByWeek(daysOfYear(2025, "UTC"), { weekStartsOn: 0, timeZone: "UTC" });
		expect(weeks).toHaveLength(53);
		expect(weeks.flat()).toHaveLength(365);
	});

	/** 2025-01-01 is a Wednesday, so a Sunday-based first week holds four days. */
	test("keeps the first week of 2025 partial", () => {
		let days = daysOfYear(2025, "UTC").slice(0, 7);
		expect(
			groupByWeek(days, { weekStartsOn: 0, timeZone: "UTC" })
				.at(0)
				?.map((day) => day.key),
		).toEqual(["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04"]);
	});

	test("keeps the last week of 2025 partial", () => {
		let weeks = groupByWeek(daysOfYear(2025, "UTC"), { weekStartsOn: 0, timeZone: "UTC" });
		expect(weeks.at(-1)?.map((day) => day.key)).toEqual([
			"2025-12-28",
			"2025-12-29",
			"2025-12-30",
			"2025-12-31",
		]);
	});

	test("moves days between buckets when the week starts on a different day", () => {
		let days = daysOfYear(2025, "UTC").slice(0, 7);
		expect(
			groupByWeek(days, { weekStartsOn: 1, timeZone: "UTC" })
				.at(0)
				?.map((day) => day.key),
		).toEqual(["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04", "2025-01-05"]);
	});

	test("makes every full bucket seven days long", () => {
		let weeks = groupByWeek(daysOfYear(2025, "UTC"), { weekStartsOn: 0, timeZone: "UTC" });
		for (let week of weeks.slice(1, -1)) expect(week).toHaveLength(7);
	});

	test("orders buckets and their days chronologically", () => {
		let weeks = groupByWeek(daysOfYear(2026, NEW_YORK), { weekStartsOn: 0, timeZone: NEW_YORK });
		let flattened = weeks.flat();
		expect(flattened.map((day) => day.key)).toEqual(
			daysOfYear(2026, NEW_YORK).map((day) => day.key),
		);
	});

	test("returns nothing for an empty day list", () => {
		expect(groupByWeek([], { weekStartsOn: 0, timeZone: "UTC" })).toEqual([]);
	});
});
