/**
 * Tests for the in-battle switch/replacement picker and its decision helper.
 *
 * Covers the pure `decideReplacement` classifier — zero healthy choices lose, one
 * auto-sends, two or more prompt — and the `BattleSwitch` component: a forced
 * replacement blocks cancel (the fainted creature cannot be left in play) while a
 * voluntary switch allows it, and confirming a row returns its team-local creature
 * index. A scripted fake `InputManager` supplies the button edges; `render` needs a
 * canvas and is not tested.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { Button, type InputManager } from "../core/input";

import { BattleSwitch, decideReplacement, type SwitchChoice } from "./battle-switch";

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

/** Two healthy benched creatures the picker lists (team-local indices 1 and 2). */
const CHOICES: SwitchChoice[] = [
	{ creature: 1, name: "Ivy", level: 12, currentHP: 30, maxHP: 30, status: null },
	{ creature: 2, name: "Char", level: 10, currentHP: 24, maxHP: 24, status: null },
];

test("decideReplacement loses when no healthy creature remains", () => {
	expect(decideReplacement([])).toEqual({ kind: "lose" });
});

test("decideReplacement auto-sends the lone remaining creature", () => {
	expect(decideReplacement([3])).toEqual({ kind: "auto", creature: 3 });
});

test("decideReplacement prompts when two or more creatures remain", () => {
	expect(decideReplacement([1, 2])).toEqual({ kind: "prompt", choices: [1, 2] });
	expect(decideReplacement([1, 2, 4])).toEqual({ kind: "prompt", choices: [1, 2, 4] });
});

test("confirming a row returns its team-local creature index", () => {
	let picker = new BattleSwitch();
	picker.open(false);
	let result = picker.update(fakeInput({ pressed: [Button.A] }), CHOICES);
	expect(result).toEqual({ kind: "switch", creature: 1 });
});

test("moving down then confirming returns the second creature", () => {
	let picker = new BattleSwitch();
	picker.open(false);
	picker.update(fakeInput({ repeating: [Button.Down] }), CHOICES);
	let result = picker.update(fakeInput({ pressed: [Button.A] }), CHOICES);
	expect(result).toEqual({ kind: "switch", creature: 2 });
});

test("a voluntary switch allows cancel back to the action menu", () => {
	let picker = new BattleSwitch();
	picker.open(false);
	expect(picker.update(fakeInput({ pressed: [Button.B] }), CHOICES)).toEqual({ kind: "cancel" });
});

test("a forced replacement blocks cancel: the fainted creature cannot be left in play", () => {
	let picker = new BattleSwitch();
	picker.open(true);
	// Pressing B (cancel) is ignored while the replacement is mandatory.
	expect(picker.update(fakeInput({ pressed: [Button.B] }), CHOICES)).toBe(null);
	// Only confirming a creature resolves a forced replacement.
	expect(picker.update(fakeInput({ pressed: [Button.A] }), CHOICES)).toEqual({
		kind: "switch",
		creature: 1,
	});
});

test("confirming with no choices resolves nothing", () => {
	let picker = new BattleSwitch();
	picker.open(true);
	expect(picker.update(fakeInput({ pressed: [Button.A] }), [])).toBe(null);
});
