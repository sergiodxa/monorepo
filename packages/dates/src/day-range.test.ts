/**
 * Tests for day ranges: each preset around month, quarter and year boundaries, the day
 * count and whole-month checks, and each rule a submitted range can break.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	dayRangeLength,
	isWholeMonth,
	lastNDaysRange,
	monthRange,
	quarterRange,
	validateDayRange,
	yearToDateRange,
} from "./day-range.js";

describe("monthRange", () => {
	test("covers the month an instant falls in", () => {
		expect(monthRange(new Date("2026-08-15T12:00:00Z"), "UTC")).toEqual({
			from: "2026-08-01",
			to: "2026-08-31",
		});
	});

	test("ends a leap February on the 29th", () => {
		expect(monthRange(new Date("2024-02-10T00:00:00Z"), "UTC").to).toBe("2024-02-29");
	});

	test("reads the month in the zone asked for", () => {
		expect(monthRange(new Date("2026-09-01T02:00:00Z"), "America/New_York")).toEqual({
			from: "2026-08-01",
			to: "2026-08-31",
		});
	});
});

describe("quarterRange", () => {
	test.each([
		["2026-02-10T00:00:00Z", "2026-01-01", "2026-03-31"],
		["2026-05-15T00:00:00Z", "2026-04-01", "2026-06-30"],
		["2026-09-29T00:00:00Z", "2026-07-01", "2026-09-30"],
		["2026-12-31T00:00:00Z", "2026-10-01", "2026-12-31"],
	])("%s falls in %s to %s", (instant, from, to) => {
		expect(quarterRange(new Date(instant), "UTC")).toEqual({ from, to });
	});
});

describe("yearToDateRange", () => {
	test("runs from 1 January to the given day", () => {
		expect(yearToDateRange(new Date("2026-09-28T12:00:00Z"), "UTC")).toEqual({
			from: "2026-01-01",
			to: "2026-09-28",
		});
	});

	test("is the whole year when given 31 December", () => {
		expect(yearToDateRange(new Date("2026-12-31T12:00:00Z"), "UTC")).toEqual({
			from: "2026-01-01",
			to: "2026-12-31",
		});
	});
});

describe("lastNDaysRange", () => {
	test("ends on the given day and spans the count", () => {
		let range = lastNDaysRange(30, { from: new Date("2026-09-28T12:00:00Z"), timeZone: "UTC" });
		expect(range).toEqual({ from: "2026-08-30", to: "2026-09-28" });
		expect(dayRangeLength(range)).toBe(30);
	});

	test("counts calendar days across a DST transition", () => {
		let range = lastNDaysRange(7, {
			from: new Date("2026-03-10T12:00:00Z"),
			timeZone: "America/New_York",
		});
		expect(range).toEqual({ from: "2026-03-04", to: "2026-03-10" });
	});
});

describe("dayRangeLength", () => {
	test("counts both ends", () => {
		expect(dayRangeLength({ from: "2026-09-01", to: "2026-09-01" })).toBe(1);
		expect(dayRangeLength({ from: "2024-01-01", to: "2024-12-31" })).toBe(366);
	});

	test("is NaN when an end names no day", () => {
		expect(dayRangeLength({ from: "2026-02-30", to: "2026-03-01" })).toBeNaN();
	});
});

describe("isWholeMonth", () => {
	test.each([
		[{ from: "2026-08-01", to: "2026-08-31" }, true],
		[{ from: "2024-02-01", to: "2024-02-29" }, true],
		[{ from: "2026-08-01", to: "2026-08-30" }, false],
		[{ from: "2026-08-02", to: "2026-08-31" }, false],
		[{ from: "2026-08-01", to: "2026-09-30" }, false],
		[{ from: " 2026-08-01", to: "2026-08-31" }, false],
	] as const)("%j is %s", (range, expected) => {
		expect(isWholeMonth(range)).toBe(expected);
	});
});

describe("validateDayRange", () => {
	let options = { latest: "2026-09-28", maxDays: 366 };

	test("accepts a range ending on the latest day", () => {
		expect(isSuccess(validateDayRange({ from: "2026-09-01", to: "2026-09-28" }, options))).toBe(
			true,
		);
	});

	test("accepts a leap year's 366 days", () => {
		expect(isSuccess(validateDayRange({ from: "2024-01-01", to: "2024-12-31" }, options))).toBe(
			true,
		);
	});

	test("holds a range to no rule beyond real days in order when given no options", () => {
		expect(isSuccess(validateDayRange({ from: "2020-01-01", to: "2030-12-31" }))).toBe(true);
	});

	test.each([
		[{ from: "2026-02-30", to: "2026-03-01" }, "invalid"],
		[{ from: "2026/09/01", to: "2026-09-02" }, "invalid"],
		[{ from: "2026-09-01 ", to: "2026-09-02" }, "invalid"],
		[{ from: "2026-09-10", to: "2026-09-01" }, "reversed"],
		[{ from: "2026-09-01", to: "2026-09-29" }, "tooLate"],
		[{ from: "2025-01-01", to: "2026-01-02" }, "tooLong"],
	] as const)("rejects %j as %s", (range, problem) => {
		let result = validateDayRange(range, options);
		expect(isFailure(result) && result.error.problem).toBe(problem);
		expect(isFailure(result) && result.error.range).toEqual(range);
	});
});
