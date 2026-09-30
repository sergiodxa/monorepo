/**
 * Tests for month and quarter boundaries and calendar-month arithmetic: that each
 * answers per zone, that a month step clamps rather than spilling over, and that
 * the wall-clock time survives a DST change between the two months.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { addMonths, endOfMonth, endOfQuarter, startOfMonth, startOfQuarter } from "./month.js";
import { zonedParts } from "./zone.js";

/** Zone whose transitions happen at 02:00 local, on the standard US dates. */
const NEW_YORK = "America/New_York";

/** Paraguay switched to daylight time at 00:00 on 2017-10-01, so that month had no midnight. */
const ASUNCION = "America/Asuncion";

/** An instant that is still June 30th in New York while it is July 1st in UTC. */
const JULY_FIRST_UTC = new Date("2026-07-01T02:00:00Z");

describe("startOfMonth", () => {
	test("opens the month the instant falls in, in the zone asked for", () => {
		expect(startOfMonth(JULY_FIRST_UTC, "UTC").toISOString()).toBe("2026-07-01T00:00:00.000Z");
		expect(startOfMonth(JULY_FIRST_UTC, NEW_YORK).toISOString()).toBe("2026-06-01T04:00:00.000Z");
		expect(startOfMonth(JULY_FIRST_UTC, "Asia/Kolkata").toISOString()).toBe(
			"2026-06-30T18:30:00.000Z",
		);
	});

	test("opens a month in standard time at the standard-time midnight", () => {
		expect(startOfMonth(new Date("2026-12-15T12:00:00Z"), NEW_YORK).toISOString()).toBe(
			"2026-12-01T05:00:00.000Z",
		);
	});

	test("opens a month whose midnight never happened at the first instant that did", () => {
		let start = startOfMonth(new Date("2017-10-15T12:00:00Z"), ASUNCION);
		expect(start.toISOString()).toBe("2017-10-01T04:00:00.000Z");
		expect(zonedParts(start.getTime(), ASUNCION)).toMatchObject({ month: 10, day: 1, hour: 1 });
		expect(zonedParts(start.getTime() - 1, ASUNCION)).toMatchObject({ month: 9, day: 30 });
	});

	test("is idempotent", () => {
		let first = startOfMonth(JULY_FIRST_UTC, NEW_YORK);
		expect(startOfMonth(first, NEW_YORK).getTime()).toBe(first.getTime());
	});
});

describe("endOfMonth", () => {
	test("closes the month at its last millisecond in the zone asked for", () => {
		expect(endOfMonth(JULY_FIRST_UTC, "UTC").toISOString()).toBe("2026-07-31T23:59:59.999Z");
		expect(endOfMonth(JULY_FIRST_UTC, NEW_YORK).toISOString()).toBe("2026-07-01T03:59:59.999Z");
	});

	test("closes February on its 28th or 29th", () => {
		expect(endOfMonth(new Date("2026-02-10T12:00:00Z"), NEW_YORK).toISOString()).toBe(
			"2026-03-01T04:59:59.999Z",
		);
		expect(endOfMonth(new Date("2024-02-10T12:00:00Z"), "UTC").toISOString()).toBe(
			"2024-02-29T23:59:59.999Z",
		);
	});

	test("closes December at the turn of the year", () => {
		expect(endOfMonth(new Date("2026-12-15T12:00:00Z"), NEW_YORK).toISOString()).toBe(
			"2027-01-01T04:59:59.999Z",
		);
	});

	test("ends one millisecond before the next month starts, across a DST change", () => {
		let march = new Date("2026-03-15T12:00:00Z");
		let end = endOfMonth(march, NEW_YORK);
		expect(end.toISOString()).toBe("2026-04-01T03:59:59.999Z");
		expect(startOfMonth(new Date(end.getTime() + 1), NEW_YORK).getTime()).toBe(end.getTime() + 1);
	});

	test("closes the month before one whose midnight never happened", () => {
		expect(endOfMonth(new Date("2017-09-15T12:00:00Z"), ASUNCION).toISOString()).toBe(
			"2017-10-01T03:59:59.999Z",
		);
	});
});

describe("startOfQuarter", () => {
	test("opens each calendar quarter on its first month", () => {
		let starts = ["02-15", "05-15", "08-15", "11-15"].map((day) =>
			startOfQuarter(new Date(`2026-${day}T12:00:00Z`), "UTC").toISOString(),
		);
		expect(starts).toEqual([
			"2026-01-01T00:00:00.000Z",
			"2026-04-01T00:00:00.000Z",
			"2026-07-01T00:00:00.000Z",
			"2026-10-01T00:00:00.000Z",
		]);
	});

	test("opens the quarter in the zone asked for", () => {
		expect(startOfQuarter(JULY_FIRST_UTC, "UTC").toISOString()).toBe("2026-07-01T00:00:00.000Z");
		expect(startOfQuarter(JULY_FIRST_UTC, NEW_YORK).toISOString()).toBe("2026-04-01T04:00:00.000Z");
	});

	test("stays on the quarter when the instant is already its start", () => {
		let start = startOfQuarter(new Date("2026-10-01T04:00:00Z"), NEW_YORK);
		expect(start.toISOString()).toBe("2026-10-01T04:00:00.000Z");
	});
});

describe("endOfQuarter", () => {
	test("closes the quarter at its last millisecond in the zone asked for", () => {
		expect(endOfQuarter(new Date("2026-02-15T12:00:00Z"), NEW_YORK).toISOString()).toBe(
			"2026-04-01T03:59:59.999Z",
		);
		expect(endOfQuarter(JULY_FIRST_UTC, NEW_YORK).toISOString()).toBe("2026-07-01T03:59:59.999Z");
	});

	test("closes the last quarter at the turn of the year", () => {
		expect(endOfQuarter(new Date("2026-11-15T12:00:00Z"), NEW_YORK).toISOString()).toBe(
			"2027-01-01T04:59:59.999Z",
		);
	});

	test("ends one millisecond before the next quarter starts", () => {
		let end = endOfQuarter(new Date("2026-08-15T12:00:00Z"), "Asia/Kolkata");
		expect(startOfQuarter(new Date(end.getTime() + 1), "Asia/Kolkata").getTime()).toBe(
			end.getTime() + 1,
		);
	});
});

describe("addMonths", () => {
	test("keeps the day of the month and the time of day", () => {
		expect(addMonths(new Date("2026-07-15T14:30:00Z"), 1, "UTC").toISOString()).toBe(
			"2026-08-15T14:30:00.000Z",
		);
	});

	test("clamps January 31st to the end of February", () => {
		expect(addMonths(new Date("2026-01-31T15:00:00Z"), 1, NEW_YORK).toISOString()).toBe(
			"2026-02-28T15:00:00.000Z",
		);
		expect(addMonths(new Date("2024-01-31T15:00:00Z"), 1, NEW_YORK).toISOString()).toBe(
			"2024-02-29T15:00:00.000Z",
		);
	});

	test("moves back for a negative count, with the same clamp", () => {
		expect(addMonths(new Date("2026-03-31T12:00:00Z"), -1, "UTC").toISOString()).toBe(
			"2026-02-28T12:00:00.000Z",
		);
		expect(addMonths(new Date("2026-07-29T12:00:00Z"), -7, "UTC").toISOString()).toBe(
			"2025-12-29T12:00:00.000Z",
		);
	});

	test("rolls over the year", () => {
		expect(addMonths(new Date("2026-11-30T12:00:00Z"), 3, "UTC").toISOString()).toBe(
			"2027-02-28T12:00:00.000Z",
		);
		expect(addMonths(new Date("2026-06-15T12:00:00Z"), 12, "UTC").toISOString()).toBe(
			"2027-06-15T12:00:00.000Z",
		);
	});

	test("keeps the wall-clock time across a change to daylight time", () => {
		let result = addMonths(new Date("2026-03-01T15:00:00Z"), 1, NEW_YORK);
		expect(result.toISOString()).toBe("2026-04-01T14:00:00.000Z");
		expect(zonedParts(result.getTime(), NEW_YORK)).toMatchObject({ hour: 10, minute: 0 });
	});

	test("keeps the wall-clock time across a change to standard time", () => {
		let result = addMonths(new Date("2026-10-15T14:00:00Z"), 1, NEW_YORK);
		expect(result.toISOString()).toBe("2026-11-15T15:00:00.000Z");
		expect(zonedParts(result.getTime(), NEW_YORK)).toMatchObject({ hour: 10, minute: 0 });
	});

	test("moves a time DST skips past the gap on the target day", () => {
		let result = addMonths(new Date("2026-02-08T07:30:00Z"), 1, NEW_YORK);
		expect(result.toISOString()).toBe("2026-03-08T07:30:00.000Z");
		expect(zonedParts(result.getTime(), NEW_YORK)).toMatchObject({ day: 8, hour: 3, minute: 30 });
	});

	test("resolves a time DST repeats to its earlier instant", () => {
		expect(addMonths(new Date("2026-10-01T05:30:00Z"), 1, NEW_YORK).toISOString()).toBe(
			"2026-11-01T05:30:00.000Z",
		);
	});

	test("resolves the calendar month in the zone asked for", () => {
		expect(addMonths(JULY_FIRST_UTC, 1, "UTC").toISOString()).toBe("2026-08-01T02:00:00.000Z");
		expect(addMonths(JULY_FIRST_UTC, 1, NEW_YORK).toISOString()).toBe("2026-07-31T02:00:00.000Z");
	});

	test("keeps milliseconds and leaves its argument untouched", () => {
		let date = new Date("2026-07-15T14:30:12.345Z");
		expect(addMonths(date, 2, NEW_YORK).toISOString()).toBe("2026-09-15T14:30:12.345Z");
		expect(date.toISOString()).toBe("2026-07-15T14:30:12.345Z");
	});
});
