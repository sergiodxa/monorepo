/**
 * Tests for the scrolling vertical list menu.
 *
 * Covers cursor navigation with wrap-around, keeping the selection valid when
 * the list shrinks, empty-list reset, `reset`, and the confirm/cancel edge
 * readers. A scripted fake `InputManager` supplies the `isRepeating`/`isPressed`/
 * `isHeld` booleans the widget queries. `render` needs a real canvas (arc/path
 * drawing) and is not tested; the scroll window it consumes is internal state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { Button, type InputManager } from "../core/input";

import { ListMenu } from "./list-menu";

/** Builds a fake input where the given buttons read as repeating and/or pressed. */
function fakeInput(state: { repeating?: Button[]; pressed?: Button[] }): InputManager {
	let repeating = new Set(state.repeating ?? []);
	let pressed = new Set(state.pressed ?? []);
	return {
		isRepeating: (button: Button) => repeating.has(button),
		isPressed: (button: Button) => pressed.has(button),
		isHeld: () => false,
	} as unknown as InputManager;
}

test("update moves the cursor down on a repeating Down", () => {
	let menu = new ListMenu();
	menu.update(fakeInput({ repeating: [Button.Down] }), 5);
	expect(menu.selected).toBe(1);
});

test("update moves the cursor up on a repeating Up", () => {
	let menu = new ListMenu();
	menu.update(fakeInput({ repeating: [Button.Down] }), 5);
	menu.update(fakeInput({ repeating: [Button.Down] }), 5);
	menu.update(fakeInput({ repeating: [Button.Up] }), 5);
	expect(menu.selected).toBe(1);
});

test("update wraps from the last item down to the first", () => {
	let menu = new ListMenu();
	for (let step = 0; step < 3; step++) menu.update(fakeInput({ repeating: [Button.Down] }), 3);
	expect(menu.selected).toBe(0);
});

test("update wraps from the first item up to the last", () => {
	let menu = new ListMenu();
	menu.update(fakeInput({ repeating: [Button.Up] }), 3);
	expect(menu.selected).toBe(2);
});

test("update leaves the selection put when no navigation button repeats", () => {
	let menu = new ListMenu();
	menu.update(fakeInput({ repeating: [Button.Down] }), 5);
	menu.update(fakeInput({}), 5);
	expect(menu.selected).toBe(1);
});

test("update clamps the cursor when the list shrinks below the current index", () => {
	let menu = new ListMenu();
	for (let step = 0; step < 4; step++) menu.update(fakeInput({ repeating: [Button.Down] }), 5);
	expect(menu.selected).toBe(4);
	menu.update(fakeInput({}), 2); // list shrank to 2 items
	expect(menu.selected).toBe(1);
});

test("update resets selection when the list becomes empty", () => {
	let menu = new ListMenu();
	menu.update(fakeInput({ repeating: [Button.Down] }), 5);
	menu.update(fakeInput({}), 0);
	expect(menu.selected).toBe(0);
});

test("reset returns selection to the top", () => {
	let menu = new ListMenu();
	for (let step = 0; step < 3; step++) menu.update(fakeInput({ repeating: [Button.Down] }), 8);
	menu.reset();
	expect(menu.selected).toBe(0);
});

test("confirmed and cancelled report the A/B press edges", () => {
	let menu = new ListMenu();
	expect(menu.confirmed(fakeInput({ pressed: [Button.A] }))).toBe(true);
	expect(menu.confirmed(fakeInput({ pressed: [Button.B] }))).toBe(false);
	expect(menu.cancelled(fakeInput({ pressed: [Button.B] }))).toBe(true);
	expect(menu.cancelled(fakeInput({ pressed: [Button.A] }))).toBe(false);
});
