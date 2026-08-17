/**
 * Tests for the in-battle Bag menu and its item classifier.
 *
 * The key regression: selecting a ball routes to the capture flow and a medicine
 * routes to the use-item turn, so choosing "Bag" no longer auto-captures. Covers
 * the pure `battleItemUse` classifier (ball vs medicine vs unusable) and the
 * `BattleBag` component confirming a ball, opening the target picker for a medicine
 * then returning its target, and cancelling out of both the list and the picker. A
 * scripted fake `InputManager` supplies the button edges; `render` needs a canvas
 * and is not tested.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { Item } from "~/game/data/item";

import { ItemAttribute } from "~/game/data/item";

import { Button, type InputManager } from "../core/input";

import { BattleBag, type BattleBagItem, battleItemUse } from "./battle-bag";

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

/** A minimal capture (ball) item record. */
function ballItem(): Item {
	return {
		category: "standard-balls",
		attributes: [ItemAttribute.Countable],
		effect: { multiplier: 1 },
	};
}

/** A minimal healing-medicine item record. */
function medicineItem(): Item {
	return {
		category: "medicine",
		attributes: [ItemAttribute.Countable],
		effect: { kind: "heal-hp", amount: 20 },
	};
}

test("battleItemUse classifies a capture ball as a ball", () => {
	expect(battleItemUse(ballItem())).toBe("ball");
});

test("battleItemUse classifies a healing medicine as a medicine", () => {
	expect(battleItemUse(medicineItem())).toBe("medicine");
});

test("battleItemUse leaves non-usable and unknown items out", () => {
	let heldItem: Item = { category: "held-items", attributes: [ItemAttribute.Holdable] };
	expect(battleItemUse(heldItem)).toBe(null);
	expect(battleItemUse(undefined)).toBe(null);
});

/** Two usable items: a ball and a medicine, in list order. */
const ITEMS: BattleBagItem[] = [
	{ id: "poke-ball", name: "Poke Ball", count: 5, use: "ball" },
	{ id: "potion", name: "Potion", count: 3, use: "medicine" },
];

test("confirming a ball routes to the capture flow, not an auto-capture", () => {
	let bag = new BattleBag();
	// The ball is the first item; a plain confirm selects it.
	let result = bag.update(fakeInput({ pressed: [Button.A] }), ITEMS, ["Bulba"]);
	expect(result).toEqual({ kind: "ball", itemId: "poke-ball" });
});

test("confirming a medicine opens the target picker, then returns the target", () => {
	let bag = new BattleBag();
	// Move down to the medicine and confirm; this opens the picker, not a turn.
	bag.update(fakeInput({ repeating: [Button.Down] }), ITEMS, ["Bulba"]);
	let opening = bag.update(fakeInput({ pressed: [Button.A] }), ITEMS, ["Bulba"]);
	expect(opening).toBe(null);
	// Confirming a target returns the medicine plus the chosen target index.
	let chosen = bag.update(fakeInput({ pressed: [Button.A] }), ITEMS, ["Bulba"]);
	expect(chosen).toEqual({ kind: "medicine", itemId: "potion", target: 0 });
});

test("selecting Bag never returns a capture on its own", () => {
	// The first frame in the bag (no button) resolves to nothing: opening the bag
	// does not itself throw a ball, which is the bug being guarded against.
	let bag = new BattleBag();
	expect(bag.update(fakeInput({}), ITEMS, ["Bulba"])).toBe(null);
});

test("cancelling the item list returns to the action menu", () => {
	let bag = new BattleBag();
	expect(bag.update(fakeInput({ pressed: [Button.B] }), ITEMS, ["Bulba"])).toEqual({
		kind: "cancel",
	});
});

test("cancelling the target picker steps back to the item list, not the menu", () => {
	let bag = new BattleBag();
	bag.update(fakeInput({ repeating: [Button.Down] }), ITEMS, ["Bulba"]); // -> Potion
	bag.update(fakeInput({ pressed: [Button.A] }), ITEMS, ["Bulba"]); // open picker
	let back = bag.update(fakeInput({ pressed: [Button.B] }), ITEMS, ["Bulba"]);
	expect(back).toBe(null); // returned to the item list, no decision yet
	// The list cursor is preserved on Potion, so confirming re-opens its picker
	// (a decision only comes after picking a target) rather than acting immediately.
	let reopened = bag.update(fakeInput({ pressed: [Button.A] }), ITEMS, ["Bulba"]);
	expect(reopened).toBe(null);
	let chosen = bag.update(fakeInput({ pressed: [Button.A] }), ITEMS, ["Bulba"]);
	expect(chosen).toEqual({ kind: "medicine", itemId: "potion", target: 0 });
});

test("an empty bag returns nothing on confirm", () => {
	let bag = new BattleBag();
	expect(bag.update(fakeInput({ pressed: [Button.A] }), [], ["Bulba"])).toBe(null);
});
