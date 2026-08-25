/**
 * Tests for the in-battle command menu.
 *
 * Covers the move submenu's grid navigation (Left/Right columns, Up/Down
 * rows) and the root menu's column-width math, which must hold the widest
 * label ("Creatures") so it never overruns into "Run".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { Button, type InputManager } from "../core/input";
import { SCREEN_WIDTH } from "../core/loop";

import { BattleCommandMenu, type MoveOption, rootMenuLayout } from "./command-menu";
import { textWidth } from "./status-layout";

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

/** Four usable moves for the 2x2 move grid. */
const FOUR_MOVES: MoveOption[] = [
	{ id: "tackle", pp: 10 },
	{ id: "growl", pp: 10 },
	{ id: "ember", pp: 10 },
	{ id: "scratch", pp: 10 },
];

/** Enters the Fight submenu, leaving the cursor on move 0. */
function openMoves(menu: BattleCommandMenu) {
	menu.update(fakeInput({ pressed: [Button.A] }), FOUR_MOVES);
}

test("Right from move0 selects move1 (a column step, not a linear one)", () => {
	let menu = new BattleCommandMenu();
	openMoves(menu);
	menu.update(fakeInput({ repeating: [Button.Right] }), FOUR_MOVES);
	let result = menu.update(fakeInput({ pressed: [Button.A] }), FOUR_MOVES);
	expect(result).toEqual({ kind: "fight", move: 1 });
});

test("Down from move0 selects move2 (a row step)", () => {
	let menu = new BattleCommandMenu();
	openMoves(menu);
	menu.update(fakeInput({ repeating: [Button.Down] }), FOUR_MOVES);
	let result = menu.update(fakeInput({ pressed: [Button.A] }), FOUR_MOVES);
	expect(result).toEqual({ kind: "fight", move: 2 });
});

test("Right then Down from move0 reaches move3 (bottom-right)", () => {
	let menu = new BattleCommandMenu();
	openMoves(menu);
	menu.update(fakeInput({ repeating: [Button.Right] }), FOUR_MOVES);
	menu.update(fakeInput({ repeating: [Button.Down] }), FOUR_MOVES);
	let result = menu.update(fakeInput({ pressed: [Button.A] }), FOUR_MOVES);
	expect(result).toEqual({ kind: "fight", move: 3 });
});

test("selecting Creatures returns a switch decision (not a no-op)", () => {
	let menu = new BattleCommandMenu();
	menu.update(fakeInput({ repeating: [Button.Down] }), FOUR_MOVES);
	let result = menu.update(fakeInput({ pressed: [Button.A] }), FOUR_MOVES);
	expect(result).toEqual({ kind: "switch" });
});

test("selecting Bag returns a bag decision", () => {
	let menu = new BattleCommandMenu();
	menu.update(fakeInput({ repeating: [Button.Right] }), FOUR_MOVES);
	let result = menu.update(fakeInput({ pressed: [Button.A] }), FOUR_MOVES);
	expect(result).toEqual({ kind: "bag" });
});

test("selecting Run returns a run decision", () => {
	let menu = new BattleCommandMenu();
	menu.update(fakeInput({ repeating: [Button.Right, Button.Down] }), FOUR_MOVES);
	let result = menu.update(fakeInput({ pressed: [Button.A] }), FOUR_MOVES);
	expect(result).toEqual({ kind: "run" });
});

test("the root menu box fits both columns on screen", () => {
	let layout = rootMenuLayout();
	expect(layout.boxWidth).toBeLessThanOrEqual(SCREEN_WIDTH);
});

test("the Creatures label fits within one column stride, so labels never collide", () => {
	let layout = rootMenuLayout();
	expect(textWidth("Creatures")).toBeLessThan(layout.stride);
});
