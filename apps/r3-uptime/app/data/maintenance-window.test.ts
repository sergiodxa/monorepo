/**
 * Unit tests for `MaintenanceWindow`'s pure helpers: `parseRecurringPattern` (the
 * `"daily|weekly|monthly:..."` string format `recurring_pattern` rows store) and
 * `isRecurringPatternActive` (whether a recurring pattern's current occurrence covers a
 * given instant, in UTC wall-clock time). The class's CRUD/database methods aren't
 * exercised in this file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { isRecurringPatternActive, parseRecurringPattern } from "~/app/data/maintenance-window";

describe("parseRecurringPattern", () => {
	test("parses a daily pattern", () => {
		expect(parseRecurringPattern("daily:02:00-04:00")).toEqual({
			type: "daily",
			startTime: "02:00",
			endTime: "04:00",
		});
	});

	test("parses a weekly pattern", () => {
		expect(parseRecurringPattern("weekly:monday:02:00-04:00")).toEqual({
			type: "weekly",
			dayOfWeek: "monday",
			startTime: "02:00",
			endTime: "04:00",
		});
	});

	test("parses a monthly pattern", () => {
		expect(parseRecurringPattern("monthly:15:02:00-04:00")).toEqual({
			type: "monthly",
			dayOfMonth: 15,
			startTime: "02:00",
			endTime: "04:00",
		});
	});

	test("rejects an unknown weekday", () => {
		expect(parseRecurringPattern("weekly:someday:02:00-04:00")).toBeNull();
	});

	test("rejects a malformed pattern", () => {
		expect(parseRecurringPattern("garbage")).toBeNull();
		expect(parseRecurringPattern("")).toBeNull();
	});
});

describe("isRecurringPatternActive", () => {
	test("daily pattern is active within its time range", () => {
		let pattern = { type: "daily" as const, startTime: "02:00", endTime: "04:00" };
		expect(isRecurringPatternActive(pattern, new Date("2026-01-05T03:00:00Z"))).toBe(true);
		expect(isRecurringPatternActive(pattern, new Date("2026-01-05T05:00:00Z"))).toBe(false);
	});

	test("daily pattern's end boundary is exclusive", () => {
		let pattern = { type: "daily" as const, startTime: "02:00", endTime: "04:00" };
		expect(isRecurringPatternActive(pattern, new Date("2026-01-05T04:00:00Z"))).toBe(false);
		expect(isRecurringPatternActive(pattern, new Date("2026-01-05T02:00:00Z"))).toBe(true);
	});

	test("weekly pattern only matches its configured day", () => {
		let pattern = {
			type: "weekly" as const,
			dayOfWeek: "monday" as const,
			startTime: "02:00",
			endTime: "04:00",
		};
		/** 2026-01-05 is a Monday. */
		expect(isRecurringPatternActive(pattern, new Date("2026-01-05T03:00:00Z"))).toBe(true);
		/** 2026-01-06 is a Tuesday. */
		expect(isRecurringPatternActive(pattern, new Date("2026-01-06T03:00:00Z"))).toBe(false);
	});

	test("monthly pattern clamps a day beyond the month's length", () => {
		let pattern = {
			type: "monthly" as const,
			dayOfMonth: 31,
			startTime: "02:00",
			endTime: "04:00",
		};
		/** February 2026 has 28 days, so day 31 clamps to the 28th. */
		expect(isRecurringPatternActive(pattern, new Date("2026-02-28T03:00:00Z"))).toBe(true);
		expect(isRecurringPatternActive(pattern, new Date("2026-02-27T03:00:00Z"))).toBe(false);
	});
});
