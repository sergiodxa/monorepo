/**
 * Recurrence expansion against the cases a calendar gets wrong: wall clocks held
 * across DST in both directions, a London series read from New York between their
 * different transition dates, RFC 5545 counting, skipped days and deep windows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Occurrence, Recurrence, TimeSpan } from "./recurrence.js";

import { toDateTimeLocal } from "./date-time-local.js";
import { expandRecurrence } from "./recurrence.js";

/** Zone that springs forward on 2026-03-08 and falls back on 2026-11-01. */
const NEW_YORK = "America/New_York";

/** Zone that springs forward on 2026-03-29 and falls back on 2026-10-25. */
const LONDON = "Europe/London";

/** A window wide enough to hold every occurrence a bounded test series has. */
const EVERYTHING: TimeSpan = {
	start: new Date("2000-01-01T00:00:00Z"),
	end: new Date("2100-01-01T00:00:00Z"),
};

/** A span from two ISO strings. */
function span(start: string, end: string): TimeSpan {
	return { start: new Date(start), end: new Date(end) };
}

/** Each occurrence's start as an ISO string, for one readable assertion per series. */
function starts(occurrences: Occurrence[]): string[] {
	return occurrences.map((occurrence) => occurrence.start.toISOString());
}

/** Expand in UTC over every occurrence, for rules whose zone is beside the point. */
function expandUtc(start: string, end: string, rule: Recurrence): Occurrence[] {
	return expandRecurrence(span(start, end), rule, EVERYTHING, "UTC");
}

describe("New York DST", () => {
	test("keeps a 09:00 weekly meeting at 09:00 local when spring moves it an hour in UTC", () => {
		let occurrences = expandRecurrence(
			span("2026-03-02T14:00:00Z", "2026-03-02T15:00:00Z"),
			{ frequency: "weekly", count: 3 },
			EVERYTHING,
			NEW_YORK,
		);
		expect(starts(occurrences)).toEqual([
			"2026-03-02T14:00:00.000Z",
			"2026-03-09T13:00:00.000Z",
			"2026-03-16T13:00:00.000Z",
		]);
		expect(occurrences.map((occurrence) => toDateTimeLocal(occurrence.start, NEW_YORK))).toEqual([
			"2026-03-02T09:00",
			"2026-03-09T09:00",
			"2026-03-16T09:00",
		]);
	});

	test("keeps the elapsed duration on both sides of a transition", () => {
		let occurrences = expandRecurrence(
			span("2026-10-26T13:00:00Z", "2026-10-26T14:30:00Z"),
			{ frequency: "weekly", count: 2 },
			EVERYTHING,
			NEW_YORK,
		);
		expect(starts(occurrences)).toEqual(["2026-10-26T13:00:00.000Z", "2026-11-02T14:00:00.000Z"]);
		expect(occurrences.map((occurrence) => occurrence.end.toISOString())).toEqual([
			"2026-10-26T14:30:00.000Z",
			"2026-11-02T15:30:00.000Z",
		]);
	});

	test("moves a 02:30 start that spring forward skips to 03:30 daylight time", () => {
		let occurrences = expandRecurrence(
			span("2026-03-07T07:30:00Z", "2026-03-07T08:00:00Z"),
			{ frequency: "daily", count: 3 },
			EVERYTHING,
			NEW_YORK,
		);
		expect(starts(occurrences)).toEqual([
			"2026-03-07T07:30:00.000Z",
			"2026-03-08T07:30:00.000Z",
			"2026-03-09T06:30:00.000Z",
		]);
		expect(toDateTimeLocal(occurrences[1]!.start, NEW_YORK)).toBe("2026-03-08T03:30");
	});

	test("puts a 01:30 start that fall back repeats on the earlier, daylight 01:30", () => {
		let occurrences = expandRecurrence(
			span("2026-10-31T05:30:00Z", "2026-10-31T06:00:00Z"),
			{ frequency: "daily", count: 3 },
			EVERYTHING,
			NEW_YORK,
		);
		expect(starts(occurrences)).toEqual([
			"2026-10-31T05:30:00.000Z",
			"2026-11-01T05:30:00.000Z",
			"2026-11-02T06:30:00.000Z",
		]);
	});
});

describe("a London series viewed from New York", () => {
	/** A 09:00 London weekly meeting, read on a New York clock. */
	function newYorkClock(first: string, count: number): string[] {
		let occurrences = expandRecurrence(
			{ start: new Date(first), end: new Date(new Date(first).getTime() + 3_600_000) },
			{ frequency: "weekly", count },
			EVERYTHING,
			LONDON,
		);
		return occurrences.map((occurrence) => toDateTimeLocal(occurrence.start, NEW_YORK));
	}

	test("shifts by an hour in New York for the weeks between the two spring dates", () => {
		expect(newYorkClock("2026-03-02T09:00:00Z", 5)).toEqual([
			"2026-03-02T04:00",
			"2026-03-09T05:00",
			"2026-03-16T05:00",
			"2026-03-23T05:00",
			"2026-03-30T04:00",
		]);
	});

	test("shifts by an hour in New York for the week between the two autumn dates", () => {
		expect(newYorkClock("2026-10-19T08:00:00Z", 3)).toEqual([
			"2026-10-19T04:00",
			"2026-10-26T05:00",
			"2026-11-02T04:00",
		]);
	});
});

describe("ending a series", () => {
	test("stops after count occurrences", () => {
		let occurrences = expandUtc("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z", {
			frequency: "daily",
			count: 3,
		});
		expect(starts(occurrences)).toEqual([
			"2026-01-01T10:00:00.000Z",
			"2026-01-02T10:00:00.000Z",
			"2026-01-03T10:00:00.000Z",
		]);
		expect(occurrences.map((occurrence) => occurrence.index)).toEqual([0, 1, 2]);
	});

	test("includes an occurrence starting exactly at until", () => {
		let occurrences = expandUtc("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z", {
			frequency: "daily",
			until: new Date("2026-01-03T10:00:00Z"),
		});
		expect(occurrences).toHaveLength(3);
	});

	test("stops at the first occurrence after until", () => {
		let occurrences = expandUtc("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z", {
			frequency: "daily",
			until: new Date("2026-01-03T09:59:59Z"),
		});
		expect(occurrences).toHaveLength(2);
	});

	test("counts skipped days toward count, as RFC 5545 counts EXDATE", () => {
		let occurrences = expandUtc("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z", {
			frequency: "daily",
			count: 4,
			exceptions: ["2026-01-02"],
		});
		expect(starts(occurrences)).toEqual([
			"2026-01-01T10:00:00.000Z",
			"2026-01-03T10:00:00.000Z",
			"2026-01-04T10:00:00.000Z",
		]);
		expect(occurrences.map((occurrence) => occurrence.index)).toEqual([0, 2, 3]);
	});

	test("reads exceptions as days in the series' zone", () => {
		let occurrences = expandRecurrence(
			span("2026-01-05T03:00:00Z", "2026-01-05T04:00:00Z"),
			{ frequency: "daily", count: 3, exceptions: ["2026-01-05"] },
			EVERYTHING,
			NEW_YORK,
		);
		expect(starts(occurrences)).toEqual(["2026-01-05T03:00:00.000Z", "2026-01-07T03:00:00.000Z"]);
	});

	test("caps a series with no end at 10,000 periods", () => {
		let occurrences = expandUtc("2000-01-01T10:00:00Z", "2000-01-01T11:00:00Z", {
			frequency: "daily",
		});
		expect(occurrences).toHaveLength(10_000);
	});
});

describe("stepping", () => {
	test("repeats every interval periods", () => {
		let daily = expandUtc("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z", {
			frequency: "daily",
			interval: 2,
			count: 3,
		});
		expect(starts(daily)).toEqual([
			"2026-01-01T10:00:00.000Z",
			"2026-01-03T10:00:00.000Z",
			"2026-01-05T10:00:00.000Z",
		]);
		let quarterly = expandUtc("2026-01-15T10:00:00Z", "2026-01-15T11:00:00Z", {
			frequency: "monthly",
			interval: 3,
			count: 3,
		});
		expect(starts(quarterly)).toEqual([
			"2026-01-15T10:00:00.000Z",
			"2026-04-15T10:00:00.000Z",
			"2026-07-15T10:00:00.000Z",
		]);
	});

	test("meets on each listed weekday of every other Monday-first week", () => {
		let occurrences = expandUtc("2026-03-04T10:00:00Z", "2026-03-04T11:00:00Z", {
			frequency: "weekly",
			interval: 2,
			weekdays: [1, 3, 5],
			count: 5,
		});
		expect(starts(occurrences)).toEqual([
			"2026-03-04T10:00:00.000Z",
			"2026-03-06T10:00:00.000Z",
			"2026-03-16T10:00:00.000Z",
			"2026-03-18T10:00:00.000Z",
			"2026-03-20T10:00:00.000Z",
		]);
	});

	test("ends a week on Sunday", () => {
		let occurrences = expandUtc("2026-03-04T10:00:00Z", "2026-03-04T11:00:00Z", {
			frequency: "weekly",
			interval: 2,
			weekdays: [0, 3],
			count: 4,
		});
		expect(starts(occurrences)).toEqual([
			"2026-03-04T10:00:00.000Z",
			"2026-03-08T10:00:00.000Z",
			"2026-03-18T10:00:00.000Z",
			"2026-03-22T10:00:00.000Z",
		]);
	});

	test("skips months without a 31st and leaves them out of count", () => {
		let occurrences = expandUtc("2026-01-31T10:00:00Z", "2026-01-31T11:00:00Z", {
			frequency: "monthly",
			count: 6,
		});
		expect(starts(occurrences)).toEqual([
			"2026-01-31T10:00:00.000Z",
			"2026-03-31T10:00:00.000Z",
			"2026-05-31T10:00:00.000Z",
			"2026-07-31T10:00:00.000Z",
			"2026-08-31T10:00:00.000Z",
			"2026-10-31T10:00:00.000Z",
		]);
		expect(occurrences.map((occurrence) => occurrence.index)).toEqual([0, 1, 2, 3, 4, 5]);
	});

	test("repeats February 29th only in leap years", () => {
		let occurrences = expandUtc("2024-02-29T10:00:00Z", "2024-02-29T11:00:00Z", {
			frequency: "yearly",
			count: 3,
		});
		expect(starts(occurrences)).toEqual([
			"2024-02-29T10:00:00.000Z",
			"2028-02-29T10:00:00.000Z",
			"2032-02-29T10:00:00.000Z",
		]);
	});

	test("yields nothing for an interval under one", () => {
		let occurrences = expandUtc("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z", {
			frequency: "daily",
			interval: 0,
		});
		expect(occurrences).toEqual([]);
	});
});

describe("windows", () => {
	test("lists a window years into a daily series with its indexes counted from the first", () => {
		let occurrences = expandRecurrence(
			span("2020-01-01T14:00:00Z", "2020-01-01T15:00:00Z"),
			{ frequency: "daily" },
			span("2026-07-01T04:00:00Z", "2026-07-04T04:00:00Z"),
			NEW_YORK,
		);
		expect(starts(occurrences)).toEqual([
			"2026-07-01T13:00:00.000Z",
			"2026-07-02T13:00:00.000Z",
			"2026-07-03T13:00:00.000Z",
		]);
		expect(occurrences.map((occurrence) => occurrence.index)).toEqual([2373, 2374, 2375]);
	});

	test("matches the full expansion for a window inside a long weekday series", () => {
		let first = span("2026-03-04T14:00:00Z", "2026-03-04T15:00:00Z");
		let rule: Recurrence = { frequency: "weekly", interval: 3, weekdays: [1, 3, 5], count: 400 };
		let window = span("2030-06-01T00:00:00Z", "2030-09-01T00:00:00Z");
		let everything = expandRecurrence(first, rule, EVERYTHING, NEW_YORK);
		let expected = everything.filter(
			(occurrence) => occurrence.start < window.end && occurrence.end > window.start,
		);
		expect(expected.length).toBeGreaterThan(0);
		expect(expandRecurrence(first, rule, window, NEW_YORK)).toEqual(expected);
	});

	test("treats the window as half-open", () => {
		let first = span("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z");
		let rule: Recurrence = { frequency: "daily", count: 5 };
		let occurrences = expandRecurrence(
			first,
			rule,
			span("2026-01-02T11:00:00Z", "2026-01-04T10:00:00Z"),
			"UTC",
		);
		expect(starts(occurrences)).toEqual(["2026-01-03T10:00:00.000Z"]);
	});

	test("includes an event that started the day before and runs past midnight", () => {
		let occurrences = expandRecurrence(
			span("2026-03-01T03:00:00Z", "2026-03-01T07:00:00Z"),
			{ frequency: "daily" },
			span("2026-03-08T05:00:00Z", "2026-03-09T04:00:00Z"),
			NEW_YORK,
		);
		expect(
			occurrences.map((occurrence) => [
				toDateTimeLocal(occurrence.start, NEW_YORK),
				toDateTimeLocal(occurrence.end, NEW_YORK),
			]),
		).toEqual([
			["2026-03-07T22:00", "2026-03-08T03:00"],
			["2026-03-08T22:00", "2026-03-09T02:00"],
		]);
	});
});
