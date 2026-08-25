/**
 * The DST and cross-zone suite, kept together because these are the cases a library
 * used to handle: a 23-hour day, a 25-hour day, a day whose midnight never happens, a
 * half-hour transition, and one instant landing on two different calendar days.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { endOfDay, startOfDay, startOfWeek } from "./boundaries";
import { diffInDays, eachDayOfInterval, isSameDay } from "./compare";
import { toDayKey } from "./day-key";
import { daysOfYear, groupByWeek, lastNDays } from "./grid";

/** Zone whose transitions happen at 02:00 local, on the standard US dates. */
const NEW_YORK = "America/New_York";

/** Noon on the day New York loses an hour: 2026-03-08 runs 23 hours. */
const SPRING_FORWARD = new Date("2026-03-08T16:00:00Z");

/** Noon on the day New York gains an hour: 2026-11-01 runs 25 hours. */
const FALL_BACK = new Date("2026-11-01T16:00:00Z");

/** Milliseconds in an hour, for reading day lengths. */
const HOUR_MS = 3_600_000;

/** How long a calendar day lasts in a zone, in hours. */
function hoursInDay(date: Date, timeZone: string): number {
	return (endOfDay(date, timeZone).getTime() - startOfDay(date, timeZone).getTime() + 1) / HOUR_MS;
}

describe("spring forward", () => {
	test("opens the day at midnight standard time", () => {
		expect(startOfDay(SPRING_FORWARD, NEW_YORK).toISOString()).toBe("2026-03-08T05:00:00.000Z");
	});

	test("closes the day at its last millisecond daylight time", () => {
		expect(endOfDay(SPRING_FORWARD, NEW_YORK).toISOString()).toBe("2026-03-09T03:59:59.999Z");
	});

	test("makes the day 23 hours long", () => {
		expect(hoursInDay(SPRING_FORWARD, NEW_YORK)).toBe(23);
	});

	test("counts one day between consecutive midnights 23 hours apart", () => {
		let saturday = new Date("2026-03-08T05:00:00Z");
		let sunday = new Date("2026-03-09T04:00:00Z");
		expect(sunday.getTime() - saturday.getTime()).toBe(23 * HOUR_MS);
		expect(diffInDays(sunday, saturday, NEW_YORK)).toBe(1);
		expect(Math.floor((sunday.getTime() - saturday.getTime()) / 86_400_000)).toBe(0);
	});

	test("enumerates the transition day exactly once", () => {
		let days = eachDayOfInterval(
			{ start: new Date("2026-03-06T12:00:00Z"), end: new Date("2026-03-10T12:00:00Z") },
			NEW_YORK,
		);
		expect(days.map((day) => day.toISOString())).toEqual([
			"2026-03-06T05:00:00.000Z",
			"2026-03-07T05:00:00.000Z",
			"2026-03-08T05:00:00.000Z",
			"2026-03-09T04:00:00.000Z",
			"2026-03-10T04:00:00.000Z",
		]);
	});

	test("keeps a rolling window across the transition exactly as long as asked", () => {
		let days = lastNDays(4, { from: new Date("2026-03-09T16:00:00Z"), timeZone: NEW_YORK });
		expect(days.map((day) => day.key)).toEqual([
			"2026-03-06",
			"2026-03-07",
			"2026-03-08",
			"2026-03-09",
		]);
	});

	test("keeps instants an hour either side of the gap on the same day", () => {
		let before = new Date("2026-03-08T06:59:00Z");
		let after = new Date("2026-03-08T07:01:00Z");
		expect(isSameDay(before, after, NEW_YORK)).toBe(true);
		expect(toDayKey(after, NEW_YORK)).toBe("2026-03-08");
	});

	test("opens the week containing the transition on its Sunday", () => {
		expect(startOfWeek(SPRING_FORWARD, NEW_YORK, { weekStartsOn: 0 }).toISOString()).toBe(
			"2026-03-08T05:00:00.000Z",
		);
		expect(
			startOfWeek(new Date("2026-03-11T16:00:00Z"), NEW_YORK, { weekStartsOn: 0 }).toISOString(),
		).toBe("2026-03-08T05:00:00.000Z");
	});
});

describe("fall back", () => {
	test("opens the day at midnight daylight time", () => {
		expect(startOfDay(FALL_BACK, NEW_YORK).toISOString()).toBe("2026-11-01T04:00:00.000Z");
	});

	test("closes the day at its last millisecond standard time", () => {
		expect(endOfDay(FALL_BACK, NEW_YORK).toISOString()).toBe("2026-11-02T04:59:59.999Z");
	});

	test("makes the day 25 hours long", () => {
		expect(hoursInDay(FALL_BACK, NEW_YORK)).toBe(25);
	});

	test("counts one day between consecutive midnights 25 hours apart", () => {
		let sunday = new Date("2026-11-01T04:00:00Z");
		let monday = new Date("2026-11-02T05:00:00Z");
		expect(monday.getTime() - sunday.getTime()).toBe(25 * HOUR_MS);
		expect(diffInDays(monday, sunday, NEW_YORK)).toBe(1);
	});

	test("puts both passes of the repeated hour on the same day", () => {
		let first = new Date("2026-11-01T05:30:00Z");
		let second = new Date("2026-11-01T06:30:00Z");
		expect(toDayKey(first, NEW_YORK)).toBe("2026-11-01");
		expect(toDayKey(second, NEW_YORK)).toBe("2026-11-01");
		expect(isSameDay(first, second, NEW_YORK)).toBe(true);
	});

	test("enumerates the transition day exactly once", () => {
		let days = eachDayOfInterval(
			{ start: new Date("2026-10-30T12:00:00Z"), end: new Date("2026-11-03T12:00:00Z") },
			NEW_YORK,
		);
		expect(days.map((day) => day.toISOString())).toEqual([
			"2026-10-30T04:00:00.000Z",
			"2026-10-31T04:00:00.000Z",
			"2026-11-01T04:00:00.000Z",
			"2026-11-02T05:00:00.000Z",
			"2026-11-03T05:00:00.000Z",
		]);
	});
});

describe("a year across both transitions", () => {
	test("has one entry per calendar day", () => {
		let days = daysOfYear(2026, NEW_YORK);
		expect(days).toHaveLength(365);
		expect(new Set(days.map((day) => day.key)).size).toBe(365);
	});

	test("stays in step with its own day keys", () => {
		for (let day of daysOfYear(2026, NEW_YORK)) {
			expect(toDayKey(day.date, NEW_YORK)).toBe(day.key);
		}
	});

	test("groups into weeks with no day lost", () => {
		let days = daysOfYear(2026, NEW_YORK);
		let weeks = groupByWeek(days, { weekStartsOn: 0, timeZone: NEW_YORK });
		expect(weeks.flat().map((day) => day.key)).toEqual(days.map((day) => day.key));
		for (let week of weeks) expect(week.length).toBeLessThanOrEqual(7);
	});
});

describe("transitions that are not the two-in-the-morning kind", () => {
	test("opens a day whose midnight never happened at the first instant that did", () => {
		/** Cuba switches to daylight time at 00:00, so 2026-03-08 has no midnight there. */
		let midday = new Date("2026-03-08T18:00:00Z");
		let start = startOfDay(midday, "America/Havana");
		expect(toDayKey(start, "America/Havana")).toBe("2026-03-08");
		expect(toDayKey(new Date(start.getTime() - 1), "America/Havana")).toBe("2026-03-07");
		expect(hoursInDay(midday, "America/Havana")).toBe(23);
	});

	test("handles a half-hour transition", () => {
		expect(hoursInDay(new Date("2026-10-04T05:00:00Z"), "Australia/Lord_Howe")).toBe(23.5);
		expect(hoursInDay(new Date("2026-04-05T05:00:00Z"), "Australia/Lord_Howe")).toBe(24.5);
	});

	test("handles a zone with no transitions at all", () => {
		expect(hoursInDay(SPRING_FORWARD, "Asia/Tokyo")).toBe(24);
		expect(hoursInDay(FALL_BACK, "UTC")).toBe(24);
	});
});

describe("one instant, two zones", () => {
	test("lands on different calendar days", () => {
		let instant = new Date("2026-07-29T02:00:00Z");
		expect(toDayKey(instant, NEW_YORK)).toBe("2026-07-28");
		expect(toDayKey(instant, "UTC")).toBe("2026-07-29");
		expect(toDayKey(instant, "Asia/Tokyo")).toBe("2026-07-29");
		expect(toDayKey(instant, "Pacific/Kiritimati")).toBe("2026-07-29");
	});

	test("opens its day at a different instant in each zone", () => {
		let instant = new Date("2026-07-29T02:00:00Z");
		let starts = ["UTC", NEW_YORK, "Asia/Tokyo", "Asia/Kolkata"].map((timeZone) =>
			startOfDay(instant, timeZone).toISOString(),
		);
		expect(starts).toEqual([
			"2026-07-29T00:00:00.000Z",
			"2026-07-28T04:00:00.000Z",
			"2026-07-28T15:00:00.000Z",
			"2026-07-28T18:30:00.000Z",
		]);
	});

	test("can be one day apart in one zone and none in another", () => {
		let a = new Date("2026-07-29T02:00:00Z");
		let b = new Date("2026-07-29T20:00:00Z");
		expect(diffInDays(b, a, "UTC")).toBe(0);
		expect(diffInDays(b, a, NEW_YORK)).toBe(1);
	});

	test("crosses the date line in both directions", () => {
		let instant = new Date("2026-07-29T11:30:00Z");
		expect(toDayKey(instant, "Pacific/Pago_Pago")).toBe("2026-07-29");
		expect(toDayKey(instant, "Pacific/Apia")).toBe("2026-07-30");
	});
});
