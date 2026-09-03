/**
 * Unit tests for {@link "./full-turn-radians"}: confirms the shared constant
 * holds the expected radian value and stays interchangeable with the
 * `Math.PI * 2` literal every caller previously wrote inline.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { FULL_TURN_RADIANS } from "./full-turn-radians.js";

describe("FULL_TURN_RADIANS", () => {
	test("equals a full turn's radian measure", () => {
		expect(FULL_TURN_RADIANS).toBe(Math.PI * 2);
	});

	test("sweeps a full circle when added to a start angle of zero", () => {
		expect(0 + FULL_TURN_RADIANS).toBeCloseTo(Math.PI * 2, 10);
	});
});
