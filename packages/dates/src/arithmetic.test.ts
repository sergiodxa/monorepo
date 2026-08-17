/**
 * Tests for instant arithmetic: that shifts are exact lengths rather than calendar
 * moves, that duration strings read as written, and that `elapsed` can be measured
 * against a supplied instant so no test has to freeze the clock.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { add, addDays, elapsed, subDays, subtract } from "./arithmetic";

/** An arbitrary reference instant with no DST transition near it. */
const REFERENCE = new Date("2026-07-29T10:00:00Z");

describe("addDays", () => {
	test("adds exact 24-hour days", () => {
		expect(addDays(REFERENCE, 3).toISOString()).toBe("2026-08-01T10:00:00.000Z");
		expect(addDays(REFERENCE, 0).getTime()).toBe(REFERENCE.getTime());
	});

	test("moves back on a negative count", () => {
		expect(addDays(REFERENCE, -1).toISOString()).toBe("2026-07-28T10:00:00.000Z");
	});

	test("does not mutate its argument", () => {
		let date = new Date("2026-07-29T10:00:00Z");
		addDays(date, 5);
		expect(date.toISOString()).toBe("2026-07-29T10:00:00.000Z");
	});

	test("keeps the instant semantics across a DST transition", () => {
		// 24 hours after Sunday noon in New York is Monday 13:00 local, not noon: this is
		// instant arithmetic on purpose, and calendar work goes through the zoned helpers.
		let sundayNoon = new Date("2026-03-08T17:00:00Z");
		expect(addDays(sundayNoon, 1).toISOString()).toBe("2026-03-09T17:00:00.000Z");
	});
});

describe("subDays", () => {
	test("subtracts exact 24-hour days", () => {
		expect(subDays(REFERENCE, 1).toISOString()).toBe("2026-07-28T10:00:00.000Z");
		expect(subDays(REFERENCE, -1).toISOString()).toBe("2026-07-30T10:00:00.000Z");
	});

	test("is the inverse of addDays", () => {
		expect(subDays(addDays(REFERENCE, 10), 10).getTime()).toBe(REFERENCE.getTime());
	});
});

describe("add", () => {
	test("shifts by a duration written with its unit", () => {
		expect(add(REFERENCE, "90 minutes").toISOString()).toBe("2026-07-29T11:30:00.000Z");
		expect(add(REFERENCE, "1 hour").toISOString()).toBe("2026-07-29T11:00:00.000Z");
		expect(add(REFERENCE, "30s").toISOString()).toBe("2026-07-29T10:00:30.000Z");
	});

	test("accepts a bare number of milliseconds", () => {
		expect(add(REFERENCE, 1500).toISOString()).toBe("2026-07-29T10:00:01.500Z");
	});

	test("agrees with addDays for a whole number of days", () => {
		expect(add(REFERENCE, "2 days").getTime()).toBe(addDays(REFERENCE, 2).getTime());
	});
});

describe("subtract", () => {
	test("shifts back by a duration", () => {
		expect(subtract(REFERENCE, "30 minutes").toISOString()).toBe("2026-07-29T09:30:00.000Z");
		expect(subtract(REFERENCE, "1w").toISOString()).toBe("2026-07-22T10:00:00.000Z");
	});

	test("is the inverse of add", () => {
		expect(subtract(add(REFERENCE, "6 hours"), "6 hours").getTime()).toBe(REFERENCE.getTime());
	});
});

describe("elapsed", () => {
	test("measures milliseconds between two supplied instants", () => {
		expect(elapsed(REFERENCE, new Date("2026-07-29T10:00:05Z"))).toBe(5000);
		expect(elapsed(REFERENCE, REFERENCE)).toBe(0);
	});

	test("is negative for an instant still in the future", () => {
		expect(elapsed(new Date("2026-07-29T10:00:05Z"), REFERENCE)).toBe(-5000);
	});

	test("accepts timestamps on either end", () => {
		expect(elapsed(REFERENCE.getTime(), REFERENCE.getTime() + 250)).toBe(250);
		expect(elapsed(REFERENCE, REFERENCE.getTime() + 250)).toBe(250);
	});

	test("measures against the current time when none is supplied", () => {
		expect(elapsed(Date.now() - 50)).toBeGreaterThanOrEqual(50);
	});
});
