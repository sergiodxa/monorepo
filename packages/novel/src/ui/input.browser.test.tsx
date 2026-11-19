/**
 * Holds the non-keyboard input helpers to their contracts in a real browser: gamepad buttons
 * read as edges, D-pad focus moving through visible controls with wraparound, and the travel
 * that tells a swipe from a tap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { describe, expect, test } from "vitest";

import { gamepadActions, moveFocus, swipeDirection } from "./input.js";

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

describe(moveFocus, () => {
	test("moves through visible controls and wraps around", () => {
		let root = document.createElement("div");
		root.innerHTML =
			'<button id="a">A</button><button id="hidden" hidden>H</button><button id="b">B</button><button id="c" disabled>C</button>';
		document.body.append(root);
		expect(moveFocus(root, 1)?.id).toBe("a");
		expect(moveFocus(root, 1)?.id).toBe("b");
		expect(moveFocus(root, 1)?.id).toBe("a");
		expect(moveFocus(root, -1)?.id).toBe("b");
		root.remove();
	});

	test("answers null when there is nothing to focus", () => {
		let root = document.createElement("div");
		document.body.append(root);
		expect(moveFocus(root, 1)).toBeNull();
		root.remove();
	});
});

describe(swipeDirection, () => {
	test("reads short travel as a tap and longer travel by its main axis", () => {
		expect(swipeDirection(10, 12)).toBeNull();
		expect(swipeDirection(5, 80)).toBe("down");
		expect(swipeDirection(5, -80)).toBe("up");
		expect(swipeDirection(-90, 20)).toBe("left");
	});
});
