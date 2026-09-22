/**
 * Exercises the trailing-baseline comparison: `baselineHourlyAverage` divides by
 * the window's own hour count rather than how many hours came back with a row, and
 * `compareToBaseline` draws the "well above" line at more than triple the trailing
 * average, gated by a floor so a near-zero baseline cannot call an ordinary handful
 * of failures elevated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	baselineHourlyAverage,
	compareToBaseline,
	sumFailedSignIns,
} from "./attack-signal-baseline";

describe("sumFailedSignIns", () => {
	test("adds every hour's own count", () => {
		let total = sumFailedSignIns([
			{ hour: "2026-09-15 00:00:00", count: 2 },
			{ hour: "2026-09-15 01:00:00", count: 5 },
		]);
		expect(total).toBe(7);
	});

	test("is zero for a window with no rows at all", () => {
		expect(sumFailedSignIns([])).toBe(0);
	});
});

describe("baselineHourlyAverage", () => {
	test("divides by the window's own hour count, not the number of rows returned", () => {
		/** Only two of the week's 168 hours saw a failure; the other 166 were quiet. */
		let rows = [
			{ hour: "2026-09-15 00:00:00", count: 84 },
			{ hour: "2026-09-16 00:00:00", count: 84 },
		];

		expect(baselineHourlyAverage(rows, 7 * 24)).toBe(1);
	});

	test("reads as zero when the window carries no failures", () => {
		expect(baselineHourlyAverage([], 7 * 24)).toBe(0);
	});
});

describe("compareToBaseline", () => {
	test("is not elevated when the recent count sits at the trailing average", () => {
		let comparison = compareToBaseline(6, 2);
		expect(comparison).toMatchObject({
			elevated: false,
			recentFailures: 6,
			baselineHourlyAverage: 2,
		});
	});

	test("is not elevated exactly at the well-above line", () => {
		/** Triple the average is the line itself; the comparison needs strictly more. */
		let comparison = compareToBaseline(6, 2);
		expect(comparison.elevated).toBe(false);
	});

	test("is elevated just past the well-above line", () => {
		let comparison = compareToBaseline(7, 2);
		expect(comparison.elevated).toBe(true);
	});

	test("floor keeps a near-zero baseline from calling a handful of failures elevated", () => {
		/** Any positive count clears "triple of zero," so the floor is what still refuses this. */
		let comparison = compareToBaseline(4, 0);
		expect(comparison.elevated).toBe(false);
	});

	test("floor and multiple both clear lets a near-zero baseline still alert on a real spike", () => {
		let comparison = compareToBaseline(5, 0);
		expect(comparison.elevated).toBe(true);
	});
});
