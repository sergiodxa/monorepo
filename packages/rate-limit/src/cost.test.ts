/**
 * Tests that cost normalization never lets an attempt be free: a missing,
 * fractional, zero, or negative cost still spends at least one budget unit, so a
 * call site cannot slip past a limit by asking to be counted as nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { normalizeCost } from "./cost";

describe("normalizeCost", () => {
	test("defaults a missing cost to one unit", () => {
		expect(normalizeCost(undefined)).toBe(1);
	});

	test("keeps a whole cost", () => {
		expect(normalizeCost(1)).toBe(1);
		expect(normalizeCost(5)).toBe(5);
	});

	test("truncates a fractional cost to a whole number of units", () => {
		expect(normalizeCost(2.7)).toBe(2);
	});

	test("raises a free or negative cost to one unit", () => {
		expect(normalizeCost(0)).toBe(1);
		expect(normalizeCost(-3)).toBe(1);
	});

	test("raises a non-finite cost to one unit", () => {
		expect(normalizeCost(Number.NaN)).toBe(1);
		expect(normalizeCost(Number.POSITIVE_INFINITY)).toBe(1);
	});
});
