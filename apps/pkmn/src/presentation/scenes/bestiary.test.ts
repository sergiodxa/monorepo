/**
 * Tests for the bestiary scene's confirm-to-open wiring.
 *
 * Covers the selection gating driven through a minimal fake client: confirming a
 * species the player has seen pushes a species-detail scene for that species,
 * while confirming an entry that is recorded but not yet seen pushes nothing, and
 * cancelling leaves the bestiary. The canvas drawing is not exercised; only the
 * input routing and the scene it pushes are asserted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { Button } from "../core/input";

import { BestiaryScene } from "./bestiary";
import { SpeciesDetailScene } from "./species-detail";

/** One bestiary entry as the selector exposes it. */
interface Entry {
	speciesId: string;
	name: string;
	seen: boolean;
	caught: boolean;
}

/** A fake input where each queried button reports pressed/repeating this frame. */
class FakeInput {
	private frame = new Set<Button>();

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

/** Records the scenes the bestiary pushes and how many times it pops. */
class FakeClient {
	readonly pushed: unknown[] = [];
	popped = 0;

	readonly input = new FakeInput();
	readonly audio = { playSynthSfx() {} };

	constructor(private readonly entries: Entry[]) {}

	readonly engine = {
		selectBestiary: () => ({ playerId: "hero", entries: this.entries }),
	};

	readonly scenes = {
		push: (scene: unknown) => this.pushed.push(scene),
		pop: () => {
			this.popped++;
		},
	};
}

/** Builds a bestiary scene entered against a fake client holding `entries`. */
function bestiaryWith(entries: Entry[]): { scene: BestiaryScene; client: FakeClient } {
	let client = new FakeClient(entries);
	let scene = new BestiaryScene();
	// biome-ignore lint/suspicious/noExplicitAny: the scene only touches the faked surface.
	scene.enter(client as any);
	return { scene, client };
}

/** Advances the scene one frame with the given buttons pressed. */
function step(scene: BestiaryScene, client: FakeClient, ...buttons: Button[]) {
	client.input.set(...buttons);
	// biome-ignore lint/suspicious/noExplicitAny: the scene only touches the faked surface.
	scene.update(client as any);
}

test("confirming a seen entry opens the species-detail scene for that species", () => {
	let { scene, client } = bestiaryWith([
		{ speciesId: "PIDGEY", name: "PIDGEY", seen: true, caught: false },
	]);

	step(scene, client, Button.A);

	expect(client.pushed).toHaveLength(1);
	let pushed = client.pushed[0];
	expect(pushed).toBeInstanceOf(SpeciesDetailScene);
});

test("confirming an unseen entry opens nothing", () => {
	let { scene, client } = bestiaryWith([
		{ speciesId: "MEWTWO", name: "MEWTWO", seen: false, caught: false },
	]);

	step(scene, client, Button.A);

	expect(client.pushed).toHaveLength(0);
	expect(client.popped).toBe(0);
});

test("cancelling leaves the bestiary and opens nothing", () => {
	let { scene, client } = bestiaryWith([
		{ speciesId: "PIDGEY", name: "PIDGEY", seen: true, caught: false },
	]);

	step(scene, client, Button.B);

	expect(client.popped).toBe(1);
	expect(client.pushed).toHaveLength(0);
});
