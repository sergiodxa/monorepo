/**
 * Tests for the public surface: parsing into a `Result`, occurrence queries with an
 * explicit zone, the descriptor and normalized text a schedule reports about itself,
 * and the lateness helpers a dead man's switch asks its questions through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@pkg/result";
import { describe, expect, test } from "vitest";

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
		let macros = ["@hourly", "@daily", "@midnight", "@weekly", "@monthly", "@yearly", "@annually"];
		for (let macro of macros) expect(isSuccess(Schedule.parse(macro))).toBe(true);
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

/**
 * A daily 09:00 job stays at 09:00 local when the offset moves underneath it, so on
 * a transition day the interval between two runs is 23 or 25 hours, and a monitor's
 * deadline has to track that stretched or shortened day.
 */
describe("lateness across a daylight saving transition", () => {
	/**
	 * New York loses an hour on 2026-03-08, moving 02:00 EST to 03:00 EDT, so the
	 * daily 09:00 deadline lands 23 hours after the last run. An hour before it is
	 * exactly where a UTC-only calculation would call the job late.
	 */
	test("keeps a daily deadline at its local time when the clock springs forward", () => {
		let schedule = scheduleFor("0 9 * * *");
		let lastRun = new Date("2026-03-07T14:00:00Z");
		let options = { timeZone: "America/New_York" } as const;

		let deadline = schedule.expectedBy(lastRun, options);
		expect(deadline.toISOString()).toBe("2026-03-08T13:00:00.000Z");
		expect(deadline.getTime() - lastRun.getTime()).toBe(23 * 3_600_000);

		expect(schedule.isDue(lastRun, { ...options, now: new Date("2026-03-08T12:00:00Z") })).toBe(
			false,
		);
		expect(schedule.isDue(lastRun, { ...options, now: new Date("2026-03-08T12:59:00Z") })).toBe(
			false,
		);
		expect(schedule.isDue(lastRun, { ...options, now: deadline })).toBe(true);
	});

	/**
	 * New York repeats an hour on 2026-11-01, moving 02:00 EDT back to 01:00 EST, so
	 * the daily 09:00 deadline lands 25 hours after the last run. Exactly 24 hours
	 * on, the job is not yet late, because its own 09:00 has not come round yet.
	 */
	test("keeps a daily deadline at its local time when the clock falls back", () => {
		let schedule = scheduleFor("0 9 * * *");
		let lastRun = new Date("2026-10-31T13:00:00Z");
		let options = { timeZone: "America/New_York" } as const;

		let deadline = schedule.expectedBy(lastRun, options);
		expect(deadline.toISOString()).toBe("2026-11-01T14:00:00.000Z");
		expect(deadline.getTime() - lastRun.getTime()).toBe(25 * 3_600_000);

		expect(schedule.isDue(lastRun, { ...options, now: new Date("2026-11-01T13:00:00Z") })).toBe(
			false,
		);
		expect(schedule.isDue(lastRun, { ...options, now: deadline })).toBe(true);
	});

	/**
	 * 02:30 never happens on 2026-03-08 in New York, so the run lands at 03:30 EDT
	 * instead, keeping a dead man's switch hearing from the job every day.
	 */
	test("carries a deadline out of an hour the clock skips instead of dropping the day", () => {
		let schedule = scheduleFor("30 2 * * *");
		let lastRun = new Date("2026-03-07T07:30:00Z");
		let options = { timeZone: "America/New_York" } as const;

		let deadline = schedule.expectedBy(lastRun, options);
		expect(deadline.toISOString()).toBe("2026-03-08T07:30:00.000Z");
		expect(schedule.isDue(lastRun, { ...options, now: deadline })).toBe(true);
	});

	/**
	 * 01:30 happens twice on 2026-11-01 in New York. An appointment is kept once, so
	 * the deadline sits at its first pass, one day after the last run.
	 */
	test("expects a repeated wall time once, on its first pass", () => {
		let schedule = scheduleFor("30 1 * * *");
		let lastRun = new Date("2026-10-31T05:30:00Z");
		let options = { timeZone: "America/New_York" } as const;

		expect(schedule.expectedBy(lastRun, options).toISOString()).toBe("2026-11-01T05:30:00.000Z");
	});

	/**
	 * An hourly schedule tracks elapsed time, so it fires in both passes of 01:00
	 * and the deadline stays exactly one hour after the last run.
	 */
	test("keeps an interval's spacing through a repeated hour rather than its wall time", () => {
		let schedule = scheduleFor("0 * * * *");
		let lastRun = new Date("2026-11-01T05:00:00Z");
		let options = { timeZone: "America/New_York" } as const;

		let deadline = schedule.expectedBy(lastRun, options);
		expect(deadline.toISOString()).toBe("2026-11-01T06:00:00.000Z");
		expect(deadline.getTime() - lastRun.getTime()).toBe(3_600_000);
	});

	/**
	 * The case a monitor meets in practice: it checks at 03:00 EDT, the instant the
	 * clock reaches after skipping 02:00, while the 02:30 run is still pending. The
	 * deadline lands within the hour rather than a full day out.
	 */
	test("still expects the run carried out of a skipped hour after the clock has jumped", () => {
		let schedule = scheduleFor("30 2 * * *");
		let options = { timeZone: "America/New_York" } as const;
		let lastRun = new Date("2026-03-08T07:00:00Z");

		let deadline = schedule.expectedBy(lastRun, options);
		expect(deadline.toISOString()).toBe("2026-03-08T07:30:00.000Z");
		expect(schedule.isDue(lastRun, { ...options, now: new Date("2026-03-08T07:29:00Z") })).toBe(
			false,
		);
		expect(schedule.isDue(lastRun, { ...options, now: deadline })).toBe(true);
	});

	/**
	 * Madrid springs forward on 2026-03-29 and falls back on 2026-10-25, verifying
	 * a daily deadline still holds its local time through both transitions.
	 */
	test("holds a daily deadline at its local time in a second zone", () => {
		let schedule = scheduleFor("0 9 * * *");
		let options = { timeZone: "Europe/Madrid" } as const;

		expect(schedule.expectedBy(new Date("2026-03-28T08:00:00Z"), options).toISOString()).toBe(
			"2026-03-29T07:00:00.000Z",
		);
		expect(schedule.expectedBy(new Date("2026-10-24T07:00:00Z"), options).toISOString()).toBe(
			"2026-10-25T08:00:00.000Z",
		);
	});
});
