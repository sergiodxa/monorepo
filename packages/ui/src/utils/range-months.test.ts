/**
 * Checks the day-key arithmetic and selection rules a link-driven range calendar builds on:
 * month weeks for each first weekday, month and day stepping across year ends, what a click
 * selects in each state, and where a pending range must stop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	addDays,
	firstUnavailableAfter,
	monthWeeks,
	nextSelection,
	rangePosition,
	shiftMonth,
	weekdayTime,
} from "./range-months.js";

describe("monthWeeks", () => {
	test("pads March 2026 from Sunday and from Monday", () => {
		let sunday = monthWeeks("2026-03", 0);
		expect(sunday).toHaveLength(5);
		expect(sunday[0]?.[0]).toBe("2026-03-01");
		expect(sunday[4]?.slice(0, 3)).toEqual(["2026-03-29", "2026-03-30", "2026-03-31"]);
		expect(sunday[4]?.[3]).toBeNull();
		let monday = monthWeeks("2026-03", 1);
		expect(monday[0]?.slice(0, 6)).toEqual([null, null, null, null, null, null]);
		expect(monday[0]?.[6]).toBe("2026-03-01");
		expect(monday).toHaveLength(6);
	});

	test("counts a leap February", () => {
		expect(monthWeeks("2028-02", 0).flat().filter(Boolean)).toHaveLength(29);
	});
});

describe("stepping", () => {
	test("rolls months and days across a year end", () => {
		expect(shiftMonth("2026-12", 1)).toBe("2027-01");
		expect(shiftMonth("2026-01", -1)).toBe("2025-12");
		expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
	});

	test("names weekday columns from the first weekday", () => {
		expect(new Date(weekdayTime(1, 0)).getUTCDay()).toBe(1);
		expect(new Date(weekdayTime(6, 1)).getUTCDay()).toBe(0);
	});
});

describe("nextSelection", () => {
	test("starts over with no start or a finished range", () => {
		expect(nextSelection("2026-03-10", { single: false })).toEqual({ start: "2026-03-10" });
		expect(
			nextSelection("2026-03-20", { start: "2026-03-10", end: "2026-03-14", single: false }),
		).toEqual({ start: "2026-03-20" });
	});

	test("ends a pending range on a later day and restarts on an earlier or equal one", () => {
		let pending = { start: "2026-03-10", single: false };
		expect(nextSelection("2026-03-14", pending)).toEqual({
			start: "2026-03-10",
			end: "2026-03-14",
		});
		expect(nextSelection("2026-03-08", pending)).toEqual({ start: "2026-03-08" });
		expect(nextSelection("2026-03-10", pending)).toEqual({ start: "2026-03-10" });
	});

	test("picks the day alone in single mode", () => {
		expect(nextSelection("2026-03-14", { start: "2026-03-10", single: true })).toEqual({
			start: "2026-03-14",
		});
	});
});

describe("rangePosition", () => {
	test("places days along a finished range", () => {
		let range = { start: "2026-03-10", end: "2026-03-12", single: false };
		expect(rangePosition("2026-03-10", range)).toBe("start");
		expect(rangePosition("2026-03-11", range)).toBe("middle");
		expect(rangePosition("2026-03-12", range)).toBe("end");
		expect(rangePosition("2026-03-13", range)).toBeUndefined();
	});

	test("draws a pending start, a one-day range and a single pick as one day", () => {
		expect(rangePosition("2026-03-10", { start: "2026-03-10", single: false })).toBe("only");
		expect(
			rangePosition("2026-03-10", { start: "2026-03-10", end: "2026-03-10", single: false }),
		).toBe("only");
		expect(
			rangePosition("2026-03-11", { start: "2026-03-10", end: "2026-03-12", single: true }),
		).toBeUndefined();
	});
});

describe("firstUnavailableAfter", () => {
	test("finds the first taken day after the start, up to the last day shown", () => {
		let taken = new Set(["2026-03-08", "2026-03-15", "2026-03-20"]);
		let isUnavailable = (date: string) => taken.has(date);
		expect(firstUnavailableAfter("2026-03-10", "2026-03-31", isUnavailable)).toBe("2026-03-15");
		expect(firstUnavailableAfter("2026-03-10", "2026-03-14", isUnavailable)).toBeUndefined();
		expect(firstUnavailableAfter("2026-03-10", "2026-03-31", undefined)).toBeUndefined();
	});
});
