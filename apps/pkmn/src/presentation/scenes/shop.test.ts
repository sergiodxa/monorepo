/**
 * Tests for the shop scene's buy quantity flow.
 *
 * Covers the pure `clampQuantity` helper (the ±1 and ±10 steps both clamp within
 * `[1, max]` rather than wrapping) and the buy-prompt wiring driven through a
 * minimal fake client: confirming an item opens the quantity prompt, dialing a
 * count and pressing A dispatches a single `buy-item` carrying that count, and an
 * item the player cannot afford shows a message instead of opening the prompt or
 * dispatching. The canvas drawing is not exercised; only the input routing and the
 * dispatched command are asserted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import type { Command } from "~/game/commands";

import { Button } from "../core/input";
import { HERO_ID } from "../core/new-game";

import { clampQuantity, ShopScene } from "./shop";

test("clampQuantity steps up and down by one, clamped to the range", () => {
	expect(clampQuantity(1, 1, 5)).toBe(2);
	expect(clampQuantity(5, 1, 5)).toBe(5); // clamps at the max
	expect(clampQuantity(1, -1, 5)).toBe(1); // clamps at 1
	expect(clampQuantity(3, -1, 5)).toBe(2);
});

test("clampQuantity steps by ten and still clamps at both ends", () => {
	expect(clampQuantity(1, 10, 999)).toBe(11);
	expect(clampQuantity(995, 10, 999)).toBe(999); // +10 clamps at the max
	expect(clampQuantity(5, -10, 999)).toBe(1); // -10 clamps at 1
});

test("clampQuantity collapses a max below one to a single unit", () => {
	expect(clampQuantity(1, 1, 0)).toBe(1);
	expect(clampQuantity(1, 10, 0)).toBe(1);
});

/** A fake input where each queried button reports pressed/repeating this frame. */
class FakeInput {
	private frame = new Set<Button>();

	/** Marks `buttons` as active for the next `update` call, replacing any prior set. */
	set(...buttons: Button[]) {
		this.frame = new Set(buttons);
	}

	isPressed(button: Button): boolean {
		return this.frame.has(button);
	}

	isRepeating(button: Button): boolean {
		return this.frame.has(button);
	}

	isHeld(): boolean {
		return false;
	}
}

/** Records the commands a scene dispatches and the scenes it pushes. */
class FakeClient {
	readonly dispatched: Command[] = [];
	readonly pushed: unknown[] = [];
	popped = 0;

	readonly input = new FakeInput();
	readonly audio = { playSynthSfx() {} };

	constructor(private money: number) {}

	readonly content = {
		items: { POTION: { category: "misc", price: { buy: 100, sell: 40 } } },
	};

	readonly engine = {
		selectPlayer: () => ({ money: this.money }),
		selectInventory: () => ({ entries: [] }),
	};

	readonly scenes = {
		push: (scene: unknown) => this.pushed.push(scene),
		pop: () => {
			this.popped++;
		},
	};

	dispatch(command: Command) {
		this.dispatched.push(command);
		return [];
	}
}

/** Builds a shop scene entered against a fake client holding `money`. */
function shopWith(money: number): { scene: ShopScene; client: FakeClient } {
	let client = new FakeClient(money);
	let scene = new ShopScene();
	// biome-ignore lint/suspicious/noExplicitAny: the scene only touches the faked surface.
	scene.enter(client as any);
	return { scene, client };
}

/** Advances the scene one frame with the given buttons pressed. */
function step(scene: ShopScene, client: FakeClient, ...buttons: Button[]) {
	client.input.set(...buttons);
	// biome-ignore lint/suspicious/noExplicitAny: the scene only touches the faked surface.
	scene.update(client as any);
}

test("confirming an affordable item opens the prompt and buys the chosen count", () => {
	let { scene, client } = shopWith(1000); // 10 POTIONs at ₽100

	step(scene, client, Button.A); // confirm the (single, top) buy entry
	expect(client.dispatched).toHaveLength(0); // no purchase yet — the prompt is open

	step(scene, client, Button.Up); // quantity 1 -> 2
	step(scene, client, Button.Right); // quantity 2 -> 10 (clamped at max, +10)
	step(scene, client, Button.A); // confirm the purchase

	expect(client.dispatched).toEqual([
		{ type: "buy-item", playerId: HERO_ID, itemId: "POTION", count: 10 },
	]);
});

test("confirming buys exactly one when the quantity is left at its default", () => {
	let { scene, client } = shopWith(1000);

	step(scene, client, Button.A); // open the prompt
	step(scene, client, Button.A); // confirm without changing the quantity

	expect(client.dispatched).toEqual([
		{ type: "buy-item", playerId: HERO_ID, itemId: "POTION", count: 1 },
	]);
});

test("cancelling the prompt returns to the list without dispatching", () => {
	let { scene, client } = shopWith(1000);

	step(scene, client, Button.A); // open the prompt
	step(scene, client, Button.B); // back out

	expect(client.dispatched).toHaveLength(0);
	expect(client.popped).toBe(0); // stays in the shop, does not leave

	// The list is live again: cancelling now leaves the shop.
	step(scene, client, Button.B);
	expect(client.popped).toBe(1);
});

test("an unaffordable item shows a message and never opens the prompt or dispatches", () => {
	let { scene, client } = shopWith(50); // cannot afford one ₽100 POTION

	step(scene, client, Button.A); // confirm the buy entry

	expect(client.dispatched).toHaveLength(0);
	expect(client.pushed).toHaveLength(1); // a message window was shown

	// Because no prompt opened, the list is still live and A would re-trigger it.
	step(scene, client, Button.A);
	expect(client.dispatched).toHaveLength(0);
	expect(client.pushed).toHaveLength(2);
});
