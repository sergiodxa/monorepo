import { unwrap } from "@pkg/result";
/**
 * Verifies the capture system's status bonus, catch-value roll, and placement rules.
 *
 * The tests pin `captureStatusBonus` to the Gen 3 multipliers, drive `computeCaptureAttempt` with
 * a seeded RNG for reproducible catches and shake counts, and confirm `captureCreature` claims
 * ownership and places creatures into the party or first storage box, recording the location.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { LegacyCreatureComponent } from "../world/components";

import { GameData, type GameDataSource } from "../data/game-data";
import { GrowthRate } from "../data/growth-rate";
import { Gender, type Species } from "../data/species";
import { State } from "../data/status";
import { createCreatureId, createPlayerId } from "../world/ids";
import { migrateWorld } from "../world/migrate";
import { getPlayerParty, getPlayerStorageBoxes, type World } from "../world/world";

import { captureCreature, captureStatusBonus, computeCaptureAttempt } from "./capture-system";

/** Builds a minimal unowned encounter creature blob. */
function createCreature(): LegacyCreatureComponent {
	return {
		species: "SPECIES_A",
		nature: "HARDY",
		experience: 0,
		moveset: ["MOVE_A", null, null, null],
		status: { state: null, damage: 0, pp: [10, 0, 0, 0] },
		iv: { hp: 0, attack: 0, defense: 0, "special-attack": 0, "special-defense": 0, speed: 0 },
		ev: { hp: 0, attack: 0, defense: 0, "special-attack": 0, "special-defense": 0, speed: 0 },
	};
}

/** Builds a one-player world with the given party members plus one wild target creature. */
function createWorld(partyIds: string[], wildId: string): { world: World; playerId: string } {
	let playerId = createPlayerId("hero");
	let creature: Record<string, LegacyCreatureComponent> = { [wildId]: createCreature() };
	let entities = [playerId, wildId];
	for (let id of partyIds) {
		creature[id] = createCreature();
		entities.push(id);
	}
	let world = migrateWorld({
		entities,
		playerId,
		playerProfile: { [playerId]: { name: "Hero" } },
		party: { [playerId]: { creatureIds: partyIds } },
		inventory: { [playerId]: { items: {} } },
		money: { [playerId]: { amount: 0 } },
		bestiary: { [playerId]: { seen: [], caught: [] } },
		storageBoxes: { [playerId]: { boxes: [] } },
		creature,
	});
	return { world, playerId };
}

test("captureStatusBonus doubles for sleep", () => {
	expect(captureStatusBonus(State.Asleep)).toBe(2);
});

test("captureStatusBonus doubles for freeze", () => {
	expect(captureStatusBonus(State.Frozen)).toBe(2);
});

test("captureStatusBonus is 1.5 for other major statuses", () => {
	expect(captureStatusBonus(State.Burned)).toBe(1.5);
	expect(captureStatusBonus(State.Paralyzed)).toBe(1.5);
	expect(captureStatusBonus(State.Poisoned)).toBe(1.5);
});

test("captureStatusBonus is 1 with no status", () => {
	expect(captureStatusBonus(null)).toBe(1);
});

/**
 * A low-HP target with a strong ball pushes a to 506, past the guaranteed threshold, so
 * the RNG is never consulted (random() === 1 would fail every shake if it were).
 */
test("computeCaptureAttempt guarantees a catch when a >= 255", () => {
	let result = computeCaptureAttempt({
		maxHP: 100,
		currentHP: 1,
		catchRate: 255,
		ballMultiplier: 2,
		statusBonus: 1,
		random: () => 1,
	});
	expect(result).toEqual({ shakes: 3, success: true });
});

/** catchRate 0 zeroes out a, so no shakes can pass. */
test("computeCaptureAttempt fails immediately when a is below 1", () => {
	let result = computeCaptureAttempt({
		maxHP: 100,
		currentHP: 100,
		catchRate: 0,
		ballMultiplier: 1,
		statusBonus: 1,
		random: () => 0,
	});
	expect(result).toEqual({ shakes: 0, success: false });
});

/** random() === 0 makes floor(0 * 65536) === 0 < b for all four checks. */
test("computeCaptureAttempt catches when every shake check passes", () => {
	let result = computeCaptureAttempt({
		maxHP: 100,
		currentHP: 1,
		catchRate: 100,
		ballMultiplier: 1,
		statusBonus: 1,
		random: () => 0,
	});
	expect(result).toEqual({ shakes: 3, success: true });
});

/**
 * random() === 1 makes floor(1 * 65536) === 65536, never less than b, so it breaks
 * immediately.
 */
test("computeCaptureAttempt reports zero shakes when the first check fails", () => {
	let result = computeCaptureAttempt({
		maxHP: 100,
		currentHP: 1,
		catchRate: 100,
		ballMultiplier: 1,
		statusBonus: 1,
		random: () => 1,
	});
	expect(result).toEqual({ shakes: 0, success: false });
});

/**
 * First two checks pass (0 < b), the third fails and breaks the loop, so exactly two
 * shakes.
 */
test("computeCaptureAttempt reports a partial shake count from a scripted RNG", () => {
	let rolls = [0, 0, 1, 0];
	let index = 0;
	let result = computeCaptureAttempt({
		maxHP: 100,
		currentHP: 1,
		catchRate: 100,
		ballMultiplier: 1,
		statusBonus: 1,
		random: () => rolls[index++]!,
	});
	expect(result).toEqual({ shakes: 2, success: false });
});

/** A content source whose one species always rolls female (100% female ratio). */
function createGameData(): GameData {
	let species: Species = {
		number: 1,
		size: { weight: 10, height: 1 },
		types: ["normal"],
		baseExperience: 64,
		catchRate: 45,
		growthRate: GrowthRate.MediumFast,
		stats: {
			hp: 50,
			attack: 50,
			defense: 50,
			"special-attack": 50,
			"special-defense": 50,
			speed: 50,
		},
		evolutions: [],
		learnset: [],
		gender: { [Gender.Female]: 100 },
		eggGroup: ["monster"],
	} as unknown as Species;
	let source: GameDataSource = {
		species: { SPECIES_A: species },
		moves: {},
		items: {},
		natures: { HARDY: { increases: null, decreases: null } },
		typeChart: {},
	};
	return unwrap(GameData.create(source));
}

/**
 * Simulates a wild that reached capture without instance state, as if it predates the
 * store; the 100%-female species still rolls female deterministically under any draw.
 */
test("captureCreature rolls a gender when the instance state is missing", () => {
	let wild = createCreatureId("wild");
	let { world, playerId } = createWorld([], wild);
	delete world.creatureInstance[wild];

	captureCreature(world, playerId, wild, createGameData(), () => 0.5);

	expect(world.creatureInstance[wild]?.gender).toBe(Gender.Female);
});

test("captureCreature preserves an already-rolled gender instead of re-rolling", () => {
	let wild = createCreatureId("wild");
	let { world, playerId } = createWorld([], wild);
	world.creatureInstance[wild] = { gender: Gender.Male, heldItemId: null, friendship: 0 };

	captureCreature(world, playerId, wild, createGameData(), () => 0.5);

	expect(world.creatureInstance[wild]?.gender).toBe(Gender.Male);
});

test("captureCreature places the creature into the party when there is room", () => {
	let wild = createCreatureId("wild");
	let existing = createCreatureId("existing");
	let { world, playerId } = createWorld([existing], wild);

	let result = captureCreature(world, playerId, wild);

	expect(result).toEqual({ placement: "party" });
	expect(world.ownership[wild]).toEqual({ ownerId: playerId });
	expect(getPlayerParty(world).creatureIds).toEqual([existing, wild]);
	expect(world.creatureLocation[wild]).toEqual({ kind: "party", playerId, slot: 1 });
});

test("captureCreature places the creature into the party at slot zero when empty", () => {
	let wild = createCreatureId("wild");
	let { world, playerId } = createWorld([], wild);

	let result = captureCreature(world, playerId, wild);

	expect(result).toEqual({ placement: "party" });
	expect(getPlayerParty(world).creatureIds).toEqual([wild]);
	expect(world.creatureLocation[wild]).toEqual({ kind: "party", playerId, slot: 0 });
});

test("captureCreature falls back to the first storage box when the party is full", () => {
	let full = ["c0", "c1", "c2", "c3", "c4", "c5"].map((key) => createCreatureId(key));
	let wild = createCreatureId("wild");
	let { world, playerId } = createWorld(full, wild);

	let result = captureCreature(world, playerId, wild);

	expect(result).toEqual({ placement: "storage", boxId: "box-1" });
	expect(world.ownership[wild]).toEqual({ ownerId: playerId });
	expect(getPlayerParty(world).creatureIds).toEqual(full);
	let box = getPlayerStorageBoxes(world).boxes[0];
	expect(box?.id).toBe("box-1");
	expect(box?.creatureIds).toEqual([wild]);
	expect(world.creatureLocation[wild]).toEqual({
		kind: "storage",
		playerId,
		boxId: "box-1",
		slot: 0,
	});
});
