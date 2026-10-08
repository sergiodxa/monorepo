/**
 * Tests for report ranges: each preset around month, quarter and year boundaries, and each
 * rule a submitted range can break, under the name the builder translates it by.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dayRangeLength } from "@sdxc/dates";
import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { checkRange, presetRange } from "~/app/lib/report-range";

/** 2026-09-29T10:00Z, the reference "now". */
const NOW = Date.UTC(2026, 8, 29, 10);

describe("presetRange", () => {
	test("lastMonth is the previous calendar month", () => {
		expect(presetRange("lastMonth", NOW)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
	});

	test("lastMonth in January is last December", () => {
		expect(presetRange("lastMonth", Date.UTC(2027, 0, 15))).toEqual({
			from: "2026-12-01",
			to: "2026-12-31",
		});
	});

	test("last30Days ends yesterday and spans thirty days", () => {
		let range = presetRange("last30Days", NOW);
		expect(range).toEqual({ from: "2026-08-30", to: "2026-09-28" });
		expect(dayRangeLength(range)).toBe(30);
	});

	test("lastQuarter is the last full calendar quarter", () => {
		expect(presetRange("lastQuarter", NOW)).toEqual({ from: "2026-04-01", to: "2026-06-30" });
		expect(presetRange("lastQuarter", Date.UTC(2026, 1, 10))).toEqual({
			from: "2025-10-01",
			to: "2025-12-31",
		});
	});

	test("yearToDate runs from 1 January to yesterday", () => {
		expect(presetRange("yearToDate", NOW)).toEqual({ from: "2026-01-01", to: "2026-09-28" });
	});

	test("yearToDate on 1 January is the whole of last year", () => {
		expect(presetRange("yearToDate", Date.UTC(2027, 0, 1, 9))).toEqual({
			from: "2026-01-01",
			to: "2026-12-31",
		});
	});
});

describe("checkRange", () => {
	test("accepts a range ending yesterday", () => {
		expect(isSuccess(checkRange({ from: "2026-09-01", to: "2026-09-28" }, NOW))).toBe(true);
	});

	test.each([
		[{ from: "2026-02-30", to: "2026-03-01" }, "invalid"],
		[{ from: "2026/09/01", to: "2026-09-02" }, "invalid"],
		[{ from: "2026-09-10", to: "2026-09-01" }, "reversed"],
		[{ from: "2026-09-01", to: "2026-09-29" }, "future"],
		[{ from: "2025-01-01", to: "2026-01-02" }, "tooLong"],
	] as const)("rejects %j as %s", (range, problem) => {
		let result = checkRange(range, NOW);
		expect(isFailure(result) && result.error.problem).toBe(problem);
	});

	test("accepts a leap year's 366 days", () => {
		expect(isSuccess(checkRange({ from: "2024-01-01", to: "2024-12-31" }, NOW))).toBe(true);
	});
});
