/**
 * Holds `swipeDirection` to its contract: short travel is a tap, longer travel reads by its
 * main axis, and a caller's threshold moves the line between the two.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { SWIPE_DISTANCE, swipeDirection } from "./swipe-direction.js";

describe(swipeDirection, () => {
	test("reads short travel as a tap and longer travel by its main axis", () => {
		expect(swipeDirection(10, 12)).toBeNull();
		expect(swipeDirection(5, 80)).toBe("down");
		expect(swipeDirection(5, -80)).toBe("up");
		expect(swipeDirection(-90, 20)).toBe("left");
		expect(swipeDirection(90, -20)).toBe("right");
	});

	test("counts travel of exactly the threshold as a swipe", () => {
		expect(swipeDirection(SWIPE_DISTANCE - 1, 0)).toBeNull();
		expect(swipeDirection(SWIPE_DISTANCE, 0)).toBe("right");
	});

	test("reads a diagonal tie as vertical", () => {
		expect(swipeDirection(60, 60)).toBe("down");
	});

	test("takes the caller's threshold", () => {
		expect(swipeDirection(30, 0, 20)).toBe("right");
		expect(swipeDirection(30, 0, 40)).toBeNull();
	});
});
