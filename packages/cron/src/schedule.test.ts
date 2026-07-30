/**
 * Tests for the public surface: parsing into a `Result`, occurrence queries with an
 * explicit zone, the descriptor and normalized text a schedule reports about itself,
 * and the lateness helpers a dead man's switch asks its questions through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { isFailure, isSuccess, unwrap } from "@pkg/result";

import { InvalidCronExpression } from "./invalid-cron-expression";
import { Schedule } from "./schedule";

/** Parse an expression, failing the test if it was rejected. */
function scheduleFor(expression: string): Schedule {
	return unwrap(Schedule.parse(expression));
}

describe("Schedule.parse", () => {
	test("returns a success carrying the schedule", () => {
		let result = Schedule.parse("0 9 * * 1-5");
		expect(isSuccess(result)).toBe(true);
		expect(unwrap(result)).toBeInstanceOf(Schedule);
	});

	test("returns a failure instead of throwing, for every rejected input", () => {
		let inputs = ["", "   ", "nonsense", "* * * * * *", "0 25 * * *", "@reboot", "0 0 30 2 *"];
		for (let input of inputs) {
			expect(() => Schedule.parse(input)).not.toThrow();
			expect(isFailure(Schedule.parse(input))).toBe(true);
		}
	});

	test("describes the failure with a reason, a field, and a position", () => {
		let result = Schedule.parse("0 0 * * 8");
		if (isSuccess(result)) throw new Error("expected a failure");
		expect(result.error).toBeInstanceOf(InvalidCronExpression);
		expect(result.error.name).toBe("InvalidCronExpression");
		expect(result.error.reason).toBe("out-of-range");
		expect(result.error.field).toBe("dayOfWeek");
		expect(result.error.position).toBe(8);
		expect(result.error.expression).toBe("0 0 * * 8");
		expect(result.error.message).toContain("dayOfWeek");
	});

	test("accepts every macro the package supports", () => {
		for (let macro of ["@hourly", "@daily", "@weekly", "@monthly", "@yearly", "@annually"]) {
			expect(isSuccess(Schedule.parse(macro))).toBe(true);
		}
	});
});

describe("Schedule instances", () => {
	test("are frozen, so they can be parsed once and shared", () => {
		let schedule = scheduleFor("*/15 * * * *");
		expect(Object.isFrozen(schedule)).toBe(true);
	});

	test("answer the same question the same way every time", () => {
		let schedule = scheduleFor("0 9 * * *");
		let options = { from: new Date("2026-06-15T00:00:00Z"), timeZone: "UTC" };
		expect(schedule.next(options).toISOString()).toBe(schedule.next(options).toISOString());
		expect(schedule.describe()).toBe(schedule.describe());
	});
});

describe("schedule.next", () => {
	test("returns one date when no count is asked for", () => {
		let next = scheduleFor("0 9 * * *").next({
			from: new Date("2026-06-15T00:00:00Z"),
			timeZone: "UTC",
		});
		expect(next.toISOString()).toBe("2026-06-15T09:00:00.000Z");
	});

	test("returns a run of dates when a count is asked for", () => {
		let runs = scheduleFor("0 9 * * *").next({
			from: new Date("2026-06-15T00:00:00Z"),
			timeZone: "UTC",
			count: 3,
		});
		expect(runs.map((date) => date.toISOString())).toEqual([
			"2026-06-15T09:00:00.000Z",
			"2026-06-16T09:00:00.000Z",
			"2026-06-17T09:00:00.000Z",
		]);
	});

	test("returns nothing for a count that asks for nothing", () => {
		let schedule = scheduleFor("0 9 * * *");
		let options = { from: new Date("2026-06-15T00:00:00Z"), timeZone: "UTC" };
		expect(schedule.next({ ...options, count: 0 })).toEqual([]);
		expect(schedule.next({ ...options, count: -1 })).toEqual([]);
	});

	test("takes the zone from the call, never from the runtime", () => {
		let schedule = scheduleFor("0 9 * * *");
		let from = new Date("2026-06-15T00:00:00Z");
		expect(schedule.next({ from, timeZone: "UTC" }).toISOString()).toBe("2026-06-15T09:00:00.000Z");
		expect(schedule.next({ from, timeZone: "America/New_York" }).toISOString()).toBe(
			"2026-06-15T13:00:00.000Z",
		);
		expect(schedule.next({ from, timeZone: "Europe/Madrid" }).toISOString()).toBe(
			"2026-06-15T07:00:00.000Z",
		);
	});

	test("gives an invalid date for a zone the runtime does not know", () => {
		let next = scheduleFor("0 9 * * *").next({
			from: new Date("2026-06-15T00:00:00Z"),
			timeZone: "Nowhere/Land",
		});
		expect(Number.isNaN(next.getTime())).toBe(true);
	});

	test("gives an invalid date for a start that is not a real instant", () => {
		let next = scheduleFor("0 9 * * *").next({ from: new Date(Number.NaN), timeZone: "UTC" });
		expect(Number.isNaN(next.getTime())).toBe(true);
	});
});

describe("schedule.prev", () => {
	test("takes the last occurrence before the instant given", () => {
		let previous = scheduleFor("0 9 * * *").prev({
			from: new Date("2026-06-15T12:00:00Z"),
			timeZone: "UTC",
		});
		expect(previous.toISOString()).toBe("2026-06-15T09:00:00.000Z");
	});

	test("gives an invalid date for an unknown zone", () => {
		let previous = scheduleFor("0 9 * * *").prev({
			from: new Date("2026-06-15T12:00:00Z"),
			timeZone: "Nowhere/Land",
		});
		expect(Number.isNaN(previous.getTime())).toBe(true);
	});
});

describe("schedule.matches", () => {
	test("answers for the minute the instant falls in", () => {
		let schedule = scheduleFor("30 9 * * *");
		expect(schedule.matches(new Date("2026-06-15T09:30:00Z"), { timeZone: "UTC" })).toBe(true);
		expect(schedule.matches(new Date("2026-06-15T09:30:59Z"), { timeZone: "UTC" })).toBe(true);
		expect(schedule.matches(new Date("2026-06-15T09:31:00Z"), { timeZone: "UTC" })).toBe(false);
	});

	test("answers against the zone given, not the runtime's", () => {
		let schedule = scheduleFor("0 9 * * *");
		let instant = new Date("2026-06-15T13:00:00Z");
		expect(schedule.matches(instant, { timeZone: "America/New_York" })).toBe(true);
		expect(schedule.matches(instant, { timeZone: "UTC" })).toBe(false);
	});

	test("is false for an unknown zone and for an invalid date", () => {
		let schedule = scheduleFor("* * * * *");
		expect(schedule.matches(new Date("2026-06-15T09:00:00Z"), { timeZone: "Nowhere" })).toBe(false);
		expect(schedule.matches(new Date(Number.NaN), { timeZone: "UTC" })).toBe(false);
	});
});

describe("schedule.describe", () => {
	test("reports a descriptor with no wording in it", () => {
		expect(scheduleFor("*/15 * * * *").describe()).toEqual({
			kind: "interval",
			unit: "minute",
			every: 15,
		});
		expect(scheduleFor("0 9 * * *").describe()).toEqual({
			kind: "daily",
			at: [{ hour: 9, minute: 0 }],
		});
		expect(scheduleFor("0 9 * * 1,3,5").describe()).toEqual({
			kind: "weekly",
			weekdays: [1, 3, 5],
			at: [{ hour: 9, minute: 0 }],
		});
		expect(scheduleFor("0 0 13 * 5").describe()).toEqual({ kind: "expression" });
	});
});

describe("schedule.toString", () => {
	test("gives the normalized expression, for storage and logs", () => {
		expect(String(scheduleFor("@weekly"))).toBe("0 0 * * 0");
		expect(String(scheduleFor("0 0 * * SUN"))).toBe("0 0 * * 0");
		expect(scheduleFor("  */15   *  *  *  * ").toString()).toBe("*/15 * * * *");
		expect(scheduleFor("5/10 * * * *").toString()).toBe("5,15,25,35,45,55 * * * *");
	});

	test("reads back into a schedule with the same occurrences", () => {
		for (let expression of ["@daily", "0 0 1-31 * 1", "0 0 13 * 5", "5/10 * * * *", "@yearly"]) {
			let original = scheduleFor(expression);
			let reparsed = scheduleFor(original.toString());
			let options = { from: new Date("2026-03-01T00:00:00Z"), timeZone: "UTC", count: 6 };
			expect(reparsed.next(options).map((date) => date.toISOString())).toEqual(
				original.next(options).map((date) => date.toISOString()),
			);
			expect(reparsed.toString()).toBe(original.toString());
		}
	});
});

describe("schedule.expectedBy", () => {
	test("gives the deadline of the run that follows the last one", () => {
		let schedule = scheduleFor("0 * * * *");
		let lastRun = new Date("2026-06-15T09:00:00Z");
		expect(schedule.expectedBy(lastRun, { timeZone: "UTC" }).toISOString()).toBe(
			"2026-06-15T10:00:00.000Z",
		);
	});

	test("adds the grace period to the expected instant", () => {
		let schedule = scheduleFor("0 * * * *");
		let lastRun = new Date("2026-06-15T09:00:00Z");
		expect(
			schedule.expectedBy(lastRun, { timeZone: "UTC", grace: "5 minutes" }).toISOString(),
		).toBe("2026-06-15T10:05:00.000Z");
		expect(schedule.expectedBy(lastRun, { timeZone: "UTC", grace: "30s" }).toISOString()).toBe(
			"2026-06-15T10:00:30.000Z",
		);
		expect(schedule.expectedBy(lastRun, { timeZone: "UTC", grace: 90_000 }).toISOString()).toBe(
			"2026-06-15T10:01:30.000Z",
		);
	});

	test("reads the zone the schedule was configured in", () => {
		let schedule = scheduleFor("0 9 * * *");
		let lastRun = new Date("2026-06-15T13:00:00Z");
		expect(schedule.expectedBy(lastRun, { timeZone: "America/New_York" }).toISOString()).toBe(
			"2026-06-16T13:00:00.000Z",
		);
		expect(schedule.expectedBy(lastRun, { timeZone: "UTC" }).toISOString()).toBe(
			"2026-06-16T09:00:00.000Z",
		);
	});

	test("gives an invalid date for an unknown zone", () => {
		let deadline = scheduleFor("0 * * * *").expectedBy(new Date("2026-06-15T09:00:00Z"), {
			timeZone: "Nowhere/Land",
		});
		expect(Number.isNaN(deadline.getTime())).toBe(true);
	});
});

describe("schedule.isDue", () => {
	test("is false while the next run is still ahead", () => {
		let schedule = scheduleFor("0 * * * *");
		let lastRun = new Date("2026-06-15T09:00:00Z");
		expect(
			schedule.isDue(lastRun, { now: new Date("2026-06-15T09:30:00Z"), timeZone: "UTC" }),
		).toBe(false);
		expect(
			schedule.isDue(lastRun, { now: new Date("2026-06-15T09:59:59Z"), timeZone: "UTC" }),
		).toBe(false);
	});

	test("is true once the expected instant is reached", () => {
		let schedule = scheduleFor("0 * * * *");
		let lastRun = new Date("2026-06-15T09:00:00Z");
		expect(
			schedule.isDue(lastRun, { now: new Date("2026-06-15T10:00:00Z"), timeZone: "UTC" }),
		).toBe(true);
		expect(
			schedule.isDue(lastRun, { now: new Date("2026-06-15T11:00:00Z"), timeZone: "UTC" }),
		).toBe(true);
	});

	test("holds off until the grace period is spent", () => {
		let schedule = scheduleFor("0 * * * *");
		let lastRun = new Date("2026-06-15T09:00:00Z");
		let options = { timeZone: "UTC", grace: "5 minutes" } as const;
		expect(schedule.isDue(lastRun, { ...options, now: new Date("2026-06-15T10:00:00Z") })).toBe(
			false,
		);
		expect(schedule.isDue(lastRun, { ...options, now: new Date("2026-06-15T10:04:59Z") })).toBe(
			false,
		);
		expect(schedule.isDue(lastRun, { ...options, now: new Date("2026-06-15T10:05:00Z") })).toBe(
			true,
		);
	});

	test("counts a daily run late only once its own day has come round", () => {
		let schedule = scheduleFor("0 9 * * *");
		let lastRun = new Date("2026-06-15T13:00:00Z");
		let options = { timeZone: "America/New_York", grace: "10 minutes" } as const;
		expect(schedule.isDue(lastRun, { ...options, now: new Date("2026-06-16T12:00:00Z") })).toBe(
			false,
		);
		expect(schedule.isDue(lastRun, { ...options, now: new Date("2026-06-16T13:05:00Z") })).toBe(
			false,
		);
		expect(schedule.isDue(lastRun, { ...options, now: new Date("2026-06-16T13:10:00Z") })).toBe(
			true,
		);
	});

	test("is false when the deadline cannot be computed at all", () => {
		let schedule = scheduleFor("0 * * * *");
		expect(
			schedule.isDue(new Date("2026-06-15T09:00:00Z"), {
				now: new Date("2027-01-01T00:00:00Z"),
				timeZone: "Nowhere/Land",
			}),
		).toBe(false);
	});

	test("treats a grace period the duration type would reject as no grace", () => {
		let schedule = scheduleFor("0 * * * *");
		let lastRun = new Date("2026-06-15T09:00:00Z");
		let grace = "five minutes" as unknown as number;
		expect(
			schedule.isDue(lastRun, { now: new Date("2026-06-15T10:00:00Z"), timeZone: "UTC", grace }),
		).toBe(true);
	});
});
