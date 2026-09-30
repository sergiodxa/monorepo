/**
 * Tests for the internal zone math: reading a wall clock in a zone, inverting one
 * back into an instant across a DST gap and a repeated hour, and the day index the
 * calendar operations count with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	calendarDayAt,
	calendarDayFromEpochDay,
	daysInMonth,
	epochDayOf,
	instantFromParts,
	isValidTimeZone,
	offsetMsAt,
	shiftCalendarDay,
	shiftCalendarMonth,
	startOfDayInstant,
	utcFromParts,
	weekdayOf,
	zonedParts,
} from "./zone.js";

/** Zone used for every DST case, since its transitions are well known. */
const NEW_YORK = "America/New_York";

describe("zonedParts", () => {
	test("reads the wall clock a zone shows at an instant", () => {
		expect(zonedParts(Date.UTC(2026, 6, 29, 2, 30, 15, 250), NEW_YORK)).toEqual({
			year: 2026,
			month: 7,
			day: 28,
			hour: 22,
			minute: 30,
			second: 15,
			millisecond: 250,
		});
	});

	test("reads midnight as hour zero and never as twenty-four", () => {
		expect(zonedParts(Date.UTC(2026, 6, 29), "UTC").hour).toBe(0);
		expect(zonedParts(Date.UTC(2026, 6, 29, 23, 59, 59, 999), "UTC")).toEqual({
			year: 2026,
			month: 7,
			day: 29,
			hour: 23,
			minute: 59,
			second: 59,
			millisecond: 999,
		});
	});

	test("keeps milliseconds of instants before the epoch positive", () => {
		expect(zonedParts(-1, "UTC")).toEqual({
			year: 1969,
			month: 12,
			day: 31,
			hour: 23,
			minute: 59,
			second: 59,
			millisecond: 999,
		});
	});

	test("reads half-hour zones", () => {
		expect(zonedParts(Date.UTC(2026, 6, 29, 0, 0), "Asia/Kolkata")).toMatchObject({
			day: 29,
			hour: 5,
			minute: 30,
		});
	});
});

describe("offsetMsAt", () => {
	test("reports the standard and daylight offsets of a zone", () => {
		expect(offsetMsAt(Date.UTC(2026, 0, 15), NEW_YORK)).toBe(-5 * 3_600_000);
		expect(offsetMsAt(Date.UTC(2026, 6, 15), NEW_YORK)).toBe(-4 * 3_600_000);
	});

	test("reports zero for UTC and a positive offset east of Greenwich", () => {
		expect(offsetMsAt(Date.UTC(2026, 6, 15), "UTC")).toBe(0);
		expect(offsetMsAt(Date.UTC(2026, 6, 15), "Asia/Tokyo")).toBe(9 * 3_600_000);
	});
});

describe("instantFromParts", () => {
	test("round-trips a wall clock that exists", () => {
		let instant = Date.UTC(2026, 6, 29, 16, 45, 30, 120);
		let parts = zonedParts(instant, NEW_YORK);
		expect(instantFromParts(parts, NEW_YORK)).toBe(instant);
	});

	test("resolves an hour DST skipped to the instant just after the gap", () => {
		let instant = instantFromParts(
			{ year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0, millisecond: 0 },
			NEW_YORK,
		);
		expect(new Date(instant).toISOString()).toBe("2026-03-08T07:30:00.000Z");
		expect(zonedParts(instant, NEW_YORK)).toMatchObject({ day: 8, hour: 3, minute: 30 });
	});

	test("resolves an hour DST repeated to the earlier of the two instants", () => {
		let instant = instantFromParts(
			{ year: 2026, month: 11, day: 1, hour: 1, minute: 30, second: 0, millisecond: 0 },
			NEW_YORK,
		);
		expect(new Date(instant).toISOString()).toBe("2026-11-01T05:30:00.000Z");
		expect(offsetMsAt(instant, NEW_YORK)).toBe(-4 * 3_600_000);
	});
});

describe("utcFromParts", () => {
	test("keeps a two-digit year literal instead of mapping it to the 1900s", () => {
		let instant = utcFromParts({
			year: 26,
			month: 7,
			day: 29,
			hour: 0,
			minute: 0,
			second: 0,
			millisecond: 0,
		});
		expect(new Date(instant).getUTCFullYear()).toBe(26);
	});
});

describe("epochDayOf", () => {
	test("counts whole days from the epoch in both directions", () => {
		expect(epochDayOf({ year: 1970, month: 1, day: 1 })).toBe(0);
		expect(epochDayOf({ year: 1970, month: 1, day: 2 })).toBe(1);
		expect(epochDayOf({ year: 1969, month: 12, day: 31 })).toBe(-1);
	});

	test("is the inverse of calendarDayFromEpochDay", () => {
		let day = { year: 2026, month: 7, day: 29 };
		expect(calendarDayFromEpochDay(epochDayOf(day))).toEqual(day);
	});
});

describe("shiftCalendarDay", () => {
	test("rolls over month and year boundaries", () => {
		expect(shiftCalendarDay({ year: 2026, month: 1, day: 31 }, 1)).toEqual({
			year: 2026,
			month: 2,
			day: 1,
		});
		expect(shiftCalendarDay({ year: 2026, month: 1, day: 1 }, -1)).toEqual({
			year: 2025,
			month: 12,
			day: 31,
		});
	});

	test("knows February has 29 days in a leap year", () => {
		expect(shiftCalendarDay({ year: 2024, month: 2, day: 28 }, 1)).toEqual({
			year: 2024,
			month: 2,
			day: 29,
		});
	});
});

describe("weekdayOf", () => {
	test("indexes Sunday as zero", () => {
		expect(weekdayOf({ year: 2026, month: 1, day: 4 })).toBe(0);
		expect(weekdayOf({ year: 2026, month: 1, day: 1 })).toBe(4);
	});
});

describe("startOfDayInstant", () => {
	test("opens a day at midnight where midnight exists", () => {
		let instant = startOfDayInstant({ year: 2026, month: 7, day: 29 }, NEW_YORK);
		expect(new Date(instant).toISOString()).toBe("2026-07-29T04:00:00.000Z");
	});

	test("opens a day at the first instant that exists when DST skips midnight", () => {
		let instant = startOfDayInstant({ year: 2026, month: 3, day: 8 }, "America/Havana");
		expect(zonedParts(instant, "America/Havana")).toMatchObject({ day: 8, hour: 1, minute: 0 });
		expect(calendarDayAt(instant - 1, "America/Havana")).toEqual({
			year: 2026,
			month: 3,
			day: 7,
		});
	});
});

describe("daysInMonth", () => {
	test("returns each month's length in a common year", () => {
		let lengths = Array.from({ length: 12 }, (_, index) => daysInMonth(2026, index + 1));
		expect(lengths).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
	});

	test("gives February 29 days in a leap year only", () => {
		expect(daysInMonth(2024, 2)).toBe(29);
		expect(daysInMonth(2000, 2)).toBe(29);
		expect(daysInMonth(1900, 2)).toBe(28);
		expect(daysInMonth(2100, 2)).toBe(28);
	});

	test("reads years 0 through 99 literally", () => {
		expect(daysInMonth(0, 2)).toBe(29);
		expect(daysInMonth(4, 2)).toBe(29);
		expect(daysInMonth(99, 2)).toBe(28);
	});

	test("returns NaN for a month outside the calendar", () => {
		expect(daysInMonth(2026, 0)).toBeNaN();
		expect(daysInMonth(2026, 13)).toBeNaN();
	});
});

describe("shiftCalendarMonth", () => {
	test("keeps the day when the target month has it", () => {
		expect(shiftCalendarMonth({ year: 2026, month: 7, day: 15 }, 1)).toEqual({
			year: 2026,
			month: 8,
			day: 15,
		});
	});

	test("clamps to the last day of a shorter month", () => {
		expect(shiftCalendarMonth({ year: 2026, month: 1, day: 31 }, 1)).toEqual({
			year: 2026,
			month: 2,
			day: 28,
		});
		expect(shiftCalendarMonth({ year: 2024, month: 1, day: 31 }, 1)).toEqual({
			year: 2024,
			month: 2,
			day: 29,
		});
		expect(shiftCalendarMonth({ year: 2026, month: 3, day: 31 }, 1)).toEqual({
			year: 2026,
			month: 4,
			day: 30,
		});
	});

	test("moves back for a negative count", () => {
		expect(shiftCalendarMonth({ year: 2026, month: 3, day: 31 }, -1)).toEqual({
			year: 2026,
			month: 2,
			day: 28,
		});
	});

	test("rolls over years in both directions", () => {
		expect(shiftCalendarMonth({ year: 2026, month: 11, day: 30 }, 3)).toEqual({
			year: 2027,
			month: 2,
			day: 28,
		});
		expect(shiftCalendarMonth({ year: 2026, month: 2, day: 10 }, -14)).toEqual({
			year: 2024,
			month: 12,
			day: 10,
		});
		expect(shiftCalendarMonth({ year: 2026, month: 5, day: 1 }, 24)).toEqual({
			year: 2028,
			month: 5,
			day: 1,
		});
	});

	test("returns the same day for a zero count", () => {
		expect(shiftCalendarMonth({ year: 2026, month: 7, day: 29 }, 0)).toEqual({
			year: 2026,
			month: 7,
			day: 29,
		});
	});
});

describe("isValidTimeZone", () => {
	test("accepts IANA zones the runtime knows", () => {
		for (let zone of ["UTC", "America/New_York", "Asia/Kolkata", "Australia/Lord_Howe"]) {
			expect(isValidTimeZone(zone)).toBe(true);
		}
	});

	test("rejects names the runtime does not know", () => {
		for (let zone of ["", "Mars/Olympus_Mons", "America/Nowhere", "not a zone"]) {
			expect(isValidTimeZone(zone)).toBe(false);
		}
	});

	test("answers the same on a repeated call", () => {
		expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
		expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
		expect(isValidTimeZone("Europe/Madrid")).toBe(true);
		expect(isValidTimeZone("Europe/Madrid")).toBe(true);
	});

	test("accepts exactly the zones the zone math can read", () => {
		expect(isValidTimeZone("Europe/Madrid")).toBe(true);
		expect(() => zonedParts(0, "Europe/Madrid")).not.toThrow();
		expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
		expect(() => zonedParts(0, "Mars/Olympus_Mons")).toThrow(RangeError);
	});
});
