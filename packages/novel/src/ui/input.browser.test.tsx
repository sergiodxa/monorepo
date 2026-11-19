/**
 * Holds the player's gamepad map to its contract in a real browser: each button reports its
 * action once, when it goes down, and the shoulder and start buttons take theirs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { describe, expect, test } from "vitest";

import { gamepadActions } from "./input.js";

describe(gamepadActions, () => {
	test("reports a button once, when it goes down", () => {
		let pressed = Array.from({ length: 16 }, (_, index) => index === 0 || index === 13);
		expect(gamepadActions([], pressed)).toEqual(["activate", "focus-next"]);
		expect(gamepadActions(pressed, pressed)).toEqual([]);
	});

	test("maps the shoulder and start buttons", () => {
		let pressed = Array.from({ length: 16 }, (_, index) => index === 4 || index === 9);
		expect(gamepadActions([], pressed)).toEqual(["rollback", "settings"]);
	});
});
