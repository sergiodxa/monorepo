/**
 * Tests for instants: that a window is measured from the reference the caller
 * supplied rather than the clock, that a range includes both of its ends, and
 * that an impossible range is refused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createRandom } from "../random";

import { createDateModule } from "./date";

const REFERENCE = new Date("2026-06-15T12:00:00.000Z");

const DAY = 86_400_000;

function module(seed: string, now: Date = REFERENCE) {
	return createDateModule(createRandom(seed), now);
}

describe("past", () => {
	test("stays inside the window before the reference", () => {
		let dates = module("past");

		for (let count = 0; count < 200; count++) {
			let value = dates.past({ days: 30 }).getTime();
			expect(value).toBeGreaterThanOrEqual(REFERENCE.getTime() - 30 * DAY);
			expect(value).toBeLessThanOrEqual(REFERENCE.getTime());
		}
	});

	test("reaches thirty days back by default", () => {
		let dates = module("default-window");
		let earliest = Math.min(...Array.from({ length: 500 }, () => dates.past().getTime()));

		expect(earliest).toBeGreaterThanOrEqual(REFERENCE.getTime() - 30 * DAY);
		expect(earliest).toBeLessThan(REFERENCE.getTime() - 25 * DAY);
	});

	test("returns the reference itself when the window is empty", () => {
		expect(module("empty").past({ days: 0 })).toEqual(REFERENCE);
	});

	test("measures from the reference it was handed", () => {
		let other = new Date("2020-01-01T00:00:00.000Z");
		let value = module("other", other).past({ days: 1 }).getTime();

		expect(value).toBeGreaterThanOrEqual(other.getTime() - DAY);
		expect(value).toBeLessThanOrEqual(other.getTime());
	});
});

describe("future", () => {
	test("stays inside the window after the reference", () => {
		let dates = module("future");

		for (let count = 0; count < 200; count++) {
			let value = dates.future({ days: 7 }).getTime();
			expect(value).toBeGreaterThanOrEqual(REFERENCE.getTime());
			expect(value).toBeLessThanOrEqual(REFERENCE.getTime() + 7 * DAY);
		}
	});

	test("returns the reference itself when the window is empty", () => {
		expect(module("empty").future({ days: 0 })).toEqual(REFERENCE);
	});
});

describe("between", () => {
	test("stays inside the range", () => {
		let dates = module("between");
		let from = new Date("2026-01-01T00:00:00.000Z");
		let to = new Date("2026-02-01T00:00:00.000Z");

		for (let count = 0; count < 200; count++) {
			let value = dates.between({ from, to }).getTime();
			expect(value).toBeGreaterThanOrEqual(from.getTime());
			expect(value).toBeLessThanOrEqual(to.getTime());
		}
	});

	test("returns the instant a single-instant range holds", () => {
		let dates = module("single");
		let instant = new Date("2026-03-03T03:03:03.000Z");

		expect(dates.between({ from: instant, to: instant })).toEqual(instant);
	});

	test("refuses a range that ends before it starts", () => {
		expect(() =>
			module("reversed").between({
				from: new Date("2026-02-01T00:00:00.000Z"),
				to: new Date("2026-01-01T00:00:00.000Z"),
			}),
		).toThrow(/at or after from/);
	});

	test("refuses an invalid date", () => {
		expect(() =>
			module("invalid").between({ from: new Date("not a date"), to: REFERENCE }),
		).toThrow(/two valid dates/);
	});
});

describe("determinism", () => {
	test("replays the same instant from the same seed", () => {
		expect(module("dates").past()).toEqual(module("dates").past());
	});
});
