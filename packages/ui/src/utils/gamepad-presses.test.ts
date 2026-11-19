/**
 * Holds `gamepadPresses` to its contract: a button reports once, on the poll it goes down, and
 * never while it is held or after it is released.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { gamepadPresses } from "./gamepad-presses.js";

/** The buttons of a 16-button pad with only `down` pressed. */
function pad(...down: number[]): boolean[] {
	return Array.from({ length: 16 }, (_, index) => down.includes(index));
}

describe(gamepadPresses, () => {
	test("reports a button once, on the poll it goes down", () => {
		expect(gamepadPresses([], pad(0, 13))).toEqual([0, 13]);
		expect(gamepadPresses(pad(0, 13), pad(0, 13))).toEqual([]);
	});

	test("reports only the buttons that are new since the previous poll", () => {
		expect(gamepadPresses(pad(0), pad(0, 4, 9))).toEqual([4, 9]);
	});

	test("reports nothing for a release", () => {
		expect(gamepadPresses(pad(5), pad())).toEqual([]);
	});
});
