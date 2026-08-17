/**
 * Unit tests for the fill percentage computation in
 * {@link "./resolve-fill-percent"}: every assertion checks a known
 * `min`/`max`/`value` triplet against the expected clamped, rounded
 * percentage, with no DOM and no rendering involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { resolveFillPercent } from "./resolve-fill-percent";

describe(resolveFillPercent.name, () => {
	test("computes how far value has traveled from min toward max as a percentage", () => {
		expect(resolveFillPercent(0, 100, 25)).toBe(25);
		expect(resolveFillPercent(0, 200, 50)).toBe(25);
		expect(resolveFillPercent(10, 20, 15)).toBe(50);
	});

	test("clamps a value below min to 0", () => {
		expect(resolveFillPercent(0, 100, -50)).toBe(0);
	});

	test("clamps a value above max to 100", () => {
		expect(resolveFillPercent(0, 10, 15)).toBe(100);
	});

	test("returns 0 for a collapsed range instead of dividing by zero", () => {
		expect(resolveFillPercent(5, 5, 5)).toBe(0);
	});

	test("returns 0 for an inverted range instead of a negative or NaN result", () => {
		expect(resolveFillPercent(10, 0, 5)).toBe(0);
	});

	test("rounds the resolved percentage to two decimal places", () => {
		expect(resolveFillPercent(0, 3, 1)).toBe(33.33);
	});
});
