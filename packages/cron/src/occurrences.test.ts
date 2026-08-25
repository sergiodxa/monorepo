/**
 * Tests for the occurrence search: field matching, the day-of-month versus
 * day-of-week either-or rule, calendar edges such as February 29th, and the two
 * daylight saving days, where the choice this package makes is asserted outright.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@pkg/result";
import { describe, expect, test } from "vitest";

import type { CronFieldSet } from "./fields";

import { matchesDate, matchesInstant, nextOccurrence, previousOccurrence } from "./occurrences";
import { parseExpression } from "./parse-expression";

/** Parse an expression, failing the test if it was rejected. */
function fieldsOf(expression: string): CronFieldSet {
	let result = parseExpression(expression);
	if (isFailure(result)) throw new Error(`unexpected failure: ${result.error.message}`);
	return result.data;
}

/** The next `count` occurrences after `from`, as ISO strings for readable diffs. */
function nextRuns(expression: string, timeZone: string, from: string, count = 1): string[] {
	let fields = fieldsOf(expression);
	let cursor = new Date(from).getTime();
	let runs: string[] = [];

	for (let taken = 0; taken < count; taken++) {
		let instant = nextOccurrence(fields, cursor, timeZone);
		if (instant === null) break;
		runs.push(new Date(instant).toISOString());
		cursor = instant;
	}

	return runs;
}

/** The last occurrence before `from`, as an ISO string. */
function previousRun(expression: string, timeZone: string, from: string): string | null {
	let instant = previousOccurrence(fieldsOf(expression), new Date(from).getTime(), timeZone);
	return instant === null ? null : new Date(instant).toISOString();
}

describe("nextOccurrence", () => {
	test("takes the next minute, hour, and day in turn", () => {
		expect(nextRuns("* * * * *", "UTC", "2026-06-15T12:00:00Z", 2)).toEqual([
			"2026-06-15T12:01:00.000Z",
			"2026-06-15T12:02:00.000Z",
		]);
		expect(nextRuns("0 * * * *", "UTC", "2026-06-15T12:30:00Z", 2)).toEqual([
			"2026-06-15T13:00:00.000Z",
			"2026-06-15T14:00:00.000Z",
		]);
		expect(nextRuns("0 9 * * *", "UTC", "2026-06-15T12:00:00Z", 2)).toEqual([
			"2026-06-16T09:00:00.000Z",
			"2026-06-17T09:00:00.000Z",
		]);
	});

	test("excludes an instant that is itself an occurrence", () => {
		expect(nextRuns("0 9 * * *", "UTC", "2026-06-15T09:00:00Z")).toEqual([
			"2026-06-16T09:00:00.000Z",
		]);
	});

	test("ignores the seconds of the instant it starts from", () => {
		expect(nextRuns("0 9 * * *", "UTC", "2026-06-15T08:59:59Z")).toEqual([
			"2026-06-15T09:00:00.000Z",
		]);
		expect(nextRuns("0 9 * * *", "UTC", "2026-06-15T09:00:00.001Z")).toEqual([
			"2026-06-16T09:00:00.000Z",
		]);
	});

	test("reads the fields against the zone it is given, not against UTC", () => {
		expect(nextRuns("0 9 * * *", "America/New_York", "2026-06-15T00:00:00Z")).toEqual([
			"2026-06-15T13:00:00.000Z",
		]);
		expect(nextRuns("0 9 * * *", "Asia/Tokyo", "2026-06-14T23:00:00Z")).toEqual([
			"2026-06-15T00:00:00.000Z",
		]);
		expect(nextRuns("0 9 * * *", "Asia/Kathmandu", "2026-06-15T00:00:00Z")).toEqual([
			"2026-06-15T03:15:00.000Z",
		]);
	});

	test("rolls over months and years", () => {
		expect(nextRuns("0 0 1 * *", "UTC", "2026-12-15T00:00:00Z", 2)).toEqual([
			"2027-01-01T00:00:00.000Z",
			"2027-02-01T00:00:00.000Z",
		]);
		expect(nextRuns("59 23 31 12 *", "UTC", "2026-12-31T23:59:00Z")).toEqual([
			"2027-12-31T23:59:00.000Z",
		]);
	});

	test("skips months that are too short for the day it wants", () => {
		expect(nextRuns("0 0 31 * *", "UTC", "2026-01-31T00:00:00Z", 4)).toEqual([
			"2026-03-31T00:00:00.000Z",
			"2026-05-31T00:00:00.000Z",
			"2026-07-31T00:00:00.000Z",
			"2026-08-31T00:00:00.000Z",
		]);
	});

	test("reaches February 29th across a leap gap of eight years", () => {
		expect(nextRuns("0 0 29 2 *", "UTC", "2026-01-01T00:00:00Z", 3)).toEqual([
			"2028-02-29T00:00:00.000Z",
			"2032-02-29T00:00:00.000Z",
			"2036-02-29T00:00:00.000Z",
		]);
		expect(nextRuns("0 0 29 2 *", "UTC", "2096-03-01T00:00:00Z")).toEqual([
			"2104-02-29T00:00:00.000Z",
		]);
	});

	test("walks a restricted month without stepping through the ones between", () => {
		expect(nextRuns("0 0 1 1 *", "UTC", "2026-02-01T00:00:00Z", 2)).toEqual([
			"2027-01-01T00:00:00.000Z",
			"2028-01-01T00:00:00.000Z",
		]);
	});
});

describe("the day-of-month and day-of-week either-or rule", () => {
	test("matches both fields when only the day of month is restricted", () => {
		expect(nextRuns("0 0 15 * *", "UTC", "2026-03-01T00:00:00Z", 3)).toEqual([
			"2026-03-15T00:00:00.000Z",
			"2026-04-15T00:00:00.000Z",
			"2026-05-15T00:00:00.000Z",
		]);
	});

	test("matches both fields when only the day of week is restricted", () => {
		expect(nextRuns("0 0 * * 1", "UTC", "2026-03-01T00:00:00Z", 3)).toEqual([
			"2026-03-02T00:00:00.000Z",
			"2026-03-09T00:00:00.000Z",
			"2026-03-16T00:00:00.000Z",
		]);
	});

	test("matches either field when both are restricted", () => {
		expect(nextRuns("0 0 13 * 5", "UTC", "2026-03-01T00:00:00Z", 6)).toEqual([
			"2026-03-06T00:00:00.000Z",
			"2026-03-13T00:00:00.000Z",
			"2026-03-20T00:00:00.000Z",
			"2026-03-27T00:00:00.000Z",
			"2026-04-03T00:00:00.000Z",
			"2026-04-10T00:00:00.000Z",
		]);
	});

	test("counts a starred step in a day field as restricting it", () => {
		expect(nextRuns("0 0 */2 * 1", "UTC", "2026-03-01T00:00:00Z", 5)).toEqual([
			"2026-03-02T00:00:00.000Z",
			"2026-03-03T00:00:00.000Z",
			"2026-03-05T00:00:00.000Z",
			"2026-03-07T00:00:00.000Z",
			"2026-03-09T00:00:00.000Z",
		]);
	});

	test("reaches a day of month that only a weekday could put on the calendar", () => {
		expect(nextRuns("0 0 30 2 1", "UTC", "2027-01-01T00:00:00Z", 3)).toEqual([
			"2027-02-01T00:00:00.000Z",
			"2027-02-08T00:00:00.000Z",
			"2027-02-15T00:00:00.000Z",
		]);
	});
});

describe("matchesDate", () => {
	test("applies the either-or rule the same way the search does", () => {
		let bothRestricted = fieldsOf("0 0 13 * 5");
		expect(matchesDate(bothRestricted, { year: 2026, month: 3, day: 6, hour: 0, minute: 0 })).toBe(
			true,
		);
		expect(matchesDate(bothRestricted, { year: 2026, month: 4, day: 13, hour: 0, minute: 0 })).toBe(
			true,
		);
		expect(matchesDate(bothRestricted, { year: 2026, month: 4, day: 14, hour: 0, minute: 0 })).toBe(
			false,
		);

		let weekdayOnly = fieldsOf("0 0 * * 5");
		expect(matchesDate(weekdayOnly, { year: 2026, month: 4, day: 13, hour: 0, minute: 0 })).toBe(
			false,
		);
	});

	test("rejects a month the schedule does not name", () => {
		expect(
			matchesDate(fieldsOf("0 0 1 1 *"), { year: 2026, month: 2, day: 1, hour: 0, minute: 0 }),
		).toBe(false);
	});
});

describe("matchesInstant", () => {
	test("matches the minute an instant falls in, seconds aside", () => {
		let fields = fieldsOf("30 9 * * *");
		expect(matchesInstant(fields, Date.UTC(2026, 5, 15, 9, 30), "UTC")).toBe(true);
		expect(matchesInstant(fields, Date.UTC(2026, 5, 15, 9, 30, 45), "UTC")).toBe(true);
		expect(matchesInstant(fields, Date.UTC(2026, 5, 15, 9, 31), "UTC")).toBe(false);
	});

	test("reads the wall clock of the zone it is given", () => {
		let fields = fieldsOf("0 9 * * *");
		expect(matchesInstant(fields, Date.UTC(2026, 5, 15, 13, 0), "America/New_York")).toBe(true);
		expect(matchesInstant(fields, Date.UTC(2026, 5, 15, 13, 0), "UTC")).toBe(false);
	});

	test("is false for a zone the runtime does not know", () => {
		expect(matchesInstant(fieldsOf("* * * * *"), Date.UTC(2026, 0, 1), "Nowhere/Land")).toBe(false);
	});
});

describe("previousOccurrence", () => {
	test("takes the last occurrence strictly before the instant given", () => {
		expect(previousRun("0 9 * * *", "UTC", "2026-06-15T12:00:00Z")).toBe(
			"2026-06-15T09:00:00.000Z",
		);
		expect(previousRun("0 9 * * *", "UTC", "2026-06-15T09:00:00Z")).toBe(
			"2026-06-14T09:00:00.000Z",
		);
		expect(previousRun("* * * * *", "UTC", "2026-06-15T12:00:30Z")).toBe(
			"2026-06-15T12:00:00.000Z",
		);
	});

	test("walks back over months, years, and short months", () => {
		expect(previousRun("0 0 1 * *", "UTC", "2026-01-15T00:00:00Z")).toBe(
			"2026-01-01T00:00:00.000Z",
		);
		expect(previousRun("0 0 1 1 *", "UTC", "2026-06-15T00:00:00Z")).toBe(
			"2026-01-01T00:00:00.000Z",
		);
		expect(previousRun("0 0 31 * *", "UTC", "2026-04-15T00:00:00Z")).toBe(
			"2026-03-31T00:00:00.000Z",
		);
		expect(previousRun("0 0 29 2 *", "UTC", "2026-06-15T00:00:00Z")).toBe(
			"2024-02-29T00:00:00.000Z",
		);
	});

	test("agrees with the forward search on which instants are occurrences", () => {
		let forward = nextRuns("0 9 * * 1-5", "America/New_York", "2026-03-01T00:00:00Z", 5);
		let last = forward[forward.length - 1] ?? "";
		let beforeLast = forward[forward.length - 2] ?? "";
		expect(previousRun("0 9 * * 1-5", "America/New_York", last)).toBe(beforeLast);
	});
});

describe("daylight saving: spring forward", () => {
	test("holds a daily schedule at its local time across the jump", () => {
		expect(nextRuns("0 9 * * *", "America/New_York", "2026-03-06T12:00:00Z", 4)).toEqual([
			"2026-03-06T14:00:00.000Z",
			"2026-03-07T14:00:00.000Z",
			"2026-03-08T13:00:00.000Z",
			"2026-03-09T13:00:00.000Z",
		]);
	});

	test("holds a daily schedule at its local time in a zone that moves at 02:00 CET", () => {
		expect(nextRuns("0 9 * * *", "Europe/Madrid", "2026-03-27T12:00:00Z", 3)).toEqual([
			"2026-03-28T08:00:00.000Z",
			"2026-03-29T07:00:00.000Z",
			"2026-03-30T07:00:00.000Z",
		]);
	});

	test("runs a schedule set to a skipped hour right after the jump", () => {
		expect(nextRuns("30 2 * * *", "America/New_York", "2026-03-07T12:00:00Z", 3)).toEqual([
			"2026-03-08T07:30:00.000Z",
			"2026-03-09T06:30:00.000Z",
			"2026-03-10T06:30:00.000Z",
		]);
	});

	test("runs a schedule set to the exact instant of the jump", () => {
		expect(nextRuns("0 2 * * *", "America/New_York", "2026-03-07T12:00:00Z", 2)).toEqual([
			"2026-03-08T07:00:00.000Z",
			"2026-03-09T06:00:00.000Z",
		]);
		expect(nextRuns("30 2 * * *", "Europe/Madrid", "2026-03-28T12:00:00Z", 2)).toEqual([
			"2026-03-29T01:30:00.000Z",
			"2026-03-30T00:30:00.000Z",
		]);
	});

	test("does not report the skipped wall time as a match", () => {
		let carried = nextRuns("30 2 * * *", "America/New_York", "2026-03-07T12:00:00Z")[0] ?? "";
		expect(carried).toBe("2026-03-08T07:30:00.000Z");
		expect(
			matchesInstant(fieldsOf("30 2 * * *"), new Date(carried).getTime(), "America/New_York"),
		).toBe(false);
	});

	test("loses nothing from an interval schedule, since the hour never happened", () => {
		expect(nextRuns("*/15 * * * *", "America/New_York", "2026-03-08T06:30:00Z", 4)).toEqual([
			"2026-03-08T06:45:00.000Z",
			"2026-03-08T07:00:00.000Z",
			"2026-03-08T07:15:00.000Z",
			"2026-03-08T07:30:00.000Z",
		]);
	});
});

describe("daylight saving: fall back", () => {
	test("holds a daily schedule at its local time across the repeated hour", () => {
		expect(nextRuns("0 9 * * *", "America/New_York", "2026-10-30T12:00:00Z", 4)).toEqual([
			"2026-10-30T13:00:00.000Z",
			"2026-10-31T13:00:00.000Z",
			"2026-11-01T14:00:00.000Z",
			"2026-11-02T14:00:00.000Z",
		]);
	});

	test("fires a schedule inside the repeated hour once, on its first pass", () => {
		expect(nextRuns("30 1 * * *", "America/New_York", "2026-10-31T12:00:00Z", 3)).toEqual([
			"2026-11-01T05:30:00.000Z",
			"2026-11-02T06:30:00.000Z",
			"2026-11-03T06:30:00.000Z",
		]);
		expect(nextRuns("30 2 * * *", "Europe/Madrid", "2026-10-24T12:00:00Z", 2)).toEqual([
			"2026-10-25T00:30:00.000Z",
			"2026-10-26T01:30:00.000Z",
		]);
	});

	test("keeps an hourly schedule on absolute time, so it runs in both passes", () => {
		expect(nextRuns("0 * * * *", "America/New_York", "2026-11-01T04:30:00Z", 4)).toEqual([
			"2026-11-01T05:00:00.000Z",
			"2026-11-01T06:00:00.000Z",
			"2026-11-01T07:00:00.000Z",
			"2026-11-01T08:00:00.000Z",
		]);
	});

	test("keeps a sub-hourly schedule spaced evenly through the repeated hour", () => {
		expect(nextRuns("*/30 * * * *", "Europe/Madrid", "2026-10-25T00:00:00Z", 5)).toEqual([
			"2026-10-25T00:30:00.000Z",
			"2026-10-25T01:00:00.000Z",
			"2026-10-25T01:30:00.000Z",
			"2026-10-25T02:00:00.000Z",
			"2026-10-25T02:30:00.000Z",
		]);
	});

	test("reports both passes of a repeated wall time as matching", () => {
		let fields = fieldsOf("30 1 * * *");
		expect(matchesInstant(fields, Date.parse("2026-11-01T05:30:00Z"), "America/New_York")).toBe(
			true,
		);
		expect(matchesInstant(fields, Date.parse("2026-11-01T06:30:00Z"), "America/New_York")).toBe(
			true,
		);
	});

	test("reports the first pass as the previous run, matching the forward search", () => {
		expect(previousRun("30 1 * * *", "America/New_York", "2026-11-01T12:00:00Z")).toBe(
			"2026-11-01T05:30:00.000Z",
		);
	});
});

describe("a run carried out of a skipped hour stays findable in both directions", () => {
	test("finds the carried run when asked from inside the hour that was skipped", () => {
		let timeZone = "America/New_York";
		let carried = "2026-03-08T07:30:00.000Z";

		expect(nextRuns("30 2 * * *", timeZone, "2026-03-07T12:00:00Z")).toEqual([carried]);
		for (let from of ["2026-03-08T07:00:00Z", "2026-03-08T07:10:00Z", "2026-03-08T07:29:59Z"]) {
			expect(nextRuns("30 2 * * *", timeZone, from)).toEqual([carried]);
		}
		expect(previousRun("30 2 * * *", timeZone, "2026-03-08T12:00:00Z")).toBe(carried);
	});

	test("finds it in a zone whose clock moves at 01:00, and in one that moves two hours", () => {
		expect(nextRuns("30 1 * * *", "Europe/London", "2026-03-29T01:10:00Z")).toEqual([
			"2026-03-29T01:30:00.000Z",
		]);
		expect(nextRuns("30 2 * * *", "Antarctica/Troll", "2026-03-29T00:30:00Z")).toEqual([
			"2026-03-29T02:30:00.000Z",
		]);
	});

	test("finds it when the hour the clock skips is midnight", () => {
		expect(nextRuns("30 0 * * *", "Africa/Cairo", "2026-04-23T22:10:00Z")).toEqual([
			"2026-04-23T22:30:00.000Z",
		]);
	});

	test("keeps asking from just before a run cheap for a schedule with many times a day", () => {
		let fields = fieldsOf("* 0-22 * * *");
		let started = performance.now();
		for (let turn = 0; turn < 200; turn++) {
			nextOccurrence(fields, Date.UTC(2026, 5, 15, 22, 59), "America/New_York");
		}
		expect((performance.now() - started) / 200).toBeLessThan(1);
	});
});

describe("the last minute of a day the clock repeats", () => {
	test("walks back into the second pass of a repeated final hour", () => {
		let timeZone = "America/Santiago";
		let forward = nextRuns("0 * 4 4 *", timeZone, "2026-04-04T00:00:00Z", 26).filter(
			(run) => run < "2026-04-06",
		);
		expect(forward.length).toBe(25);
		expect(forward.slice(-2)).toEqual(["2026-04-05T02:00:00.000Z", "2026-04-05T03:00:00.000Z"]);
		expect(previousRun("0 * 4 4 *", timeZone, "2026-04-06T00:00:00Z")).toBe(
			"2026-04-05T03:00:00.000Z",
		);
	});
});

describe("the minute the search is asked from", () => {
	test("counts an occurrence inside it as past for next and as before for prev", () => {
		for (let expression of ["0 12 * * *", "0 * * * *"]) {
			expect(previousRun(expression, "UTC", "2026-06-15T12:00:00.000Z")).not.toBe(
				"2026-06-15T12:00:00.000Z",
			);
			for (let from of [
				"2026-06-15T12:00:00.001Z",
				"2026-06-15T12:00:30Z",
				"2026-06-15T12:00:59.999Z",
			]) {
				expect({ expression, from, previous: previousRun(expression, "UTC", from) }).toEqual({
					expression,
					from,
					previous: "2026-06-15T12:00:00.000Z",
				});
			}
			expect(nextRuns(expression, "UTC", "2026-06-15T12:00:30Z")[0]).not.toBe(
				"2026-06-15T12:00:00.000Z",
			);
		}
	});
});

describe("unknown zones", () => {
	test("report no occurrence rather than throwing", () => {
		let fields = fieldsOf("0 9 * * *");
		expect(nextOccurrence(fields, Date.UTC(2026, 0, 1), "Nowhere/Land")).toBe(null);
		expect(previousOccurrence(fields, Date.UTC(2026, 0, 1), "Nowhere/Land")).toBe(null);
		expect(() => nextOccurrence(fields, Date.UTC(2026, 0, 1), "nope")).not.toThrow();
	});

	test("report no occurrence for a start that is not a real instant", () => {
		let fields = fieldsOf("0 9 * * *");
		expect(nextOccurrence(fields, Number.NaN, "UTC")).toBe(null);
		expect(previousOccurrence(fields, Number.NaN, "UTC")).toBe(null);
	});
});
