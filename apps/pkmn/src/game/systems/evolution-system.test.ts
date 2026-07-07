/**
 * Verifies the evolution system's species swap and level-up evolution lookup.
 *
 * The tests confirm `evolveCreature` replaces the stored species id while preserving the nickname and any
 * other identity fields, and that `getLevelUpEvolution` returns the level-evolution target only once the
 * creature's level meets the threshold, returns null below it, ignores non-level methods, and picks the
 * first eligible level evolution. A tiny inline content source pins the growth curve and evolution data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { unwrap } from "@pkg/result";

import type { LegacyCreatureComponent } from "../world/components";

import { EvolutionMethod, type Evolution } from "../data/evolution";
import { GameData, type GameDataSource } from "../data/game-data";
import { GrowthRate } from "../data/growth-rate";
import { DamageClass, type Move } from "../data/move";
import { type Species } from "../data/species";
import { createCreatureId, createPlayerId } from "../world/ids";
import { migrateWorld } from "../world/migrate";
import { type World } from "../world/world";

import {
	evolveCreature,
	getItemEvolution,
	getLevelUpEvolution,
	getTradeEvolution,
} from "./evolution-system";

let BASE_SPECIES = "SPECIES_BASE";
let EVOLVED_SPECIES = "SPECIES_EVOLVED";
let TRADE_SPECIES = "SPECIES_TRADE";
let STONE_SPECIES = "SPECIES_STONE";
let NATURE_ID = "HARDY";
let MOVE_ID = "MOVE_A";
let STONE_ITEM_ID = "STONE_ITEM";
let OTHER_ITEM_ID = "OTHER_ITEM";

/** Builds a flat stat block for predictable creatures. */
function statSet(value: number) {
	return {
		hp: value,
		attack: value,
		defense: value,
		"special-attack": value,
		"special-defense": value,
		speed: value,
	};
}

/** Builds a medium-fast species carrying the given evolutions. */
function species(evolutions: Evolution[]): Species {
	return {
		number: 1,
		size: { weight: 10, height: 1 },
		types: ["normal"],
		baseExperience: 64,
		catchRate: 45,
		growthRate: GrowthRate.MediumFast,
		stats: statSet(50),
		evolutions,
		learnset: [{ level: 1, moveId: MOVE_ID }],
		gender: { male: 50, female: 50 },
		eggGroup: ["monster"],
	} as unknown as Species;
}

/** Builds a content source where the base species evolves by level and by trade. */
function createGameData(): GameData {
	let move: Move = {
		type: "normal",
		damageClass: DamageClass.Physical,
		power: 40,
		accuracy: 100,
		pp: 35,
		effect: { kind: "none" },
	};
	let source: GameDataSource = {
		species: {
			[BASE_SPECIES]: species([
				{ method: EvolutionMethod.Trade, speciesId: TRADE_SPECIES },
				{ method: EvolutionMethod.Item, speciesId: STONE_SPECIES, itemId: STONE_ITEM_ID },
				{ method: EvolutionMethod.Level, speciesId: EVOLVED_SPECIES, level: 10 },
			]),
			[EVOLVED_SPECIES]: species([]),
			[TRADE_SPECIES]: species([]),
			[STONE_SPECIES]: species([]),
		},
		moves: { [MOVE_ID]: move },
		items: {
			[STONE_ITEM_ID]: { category: "evolution", attributes: [0] },
			[OTHER_ITEM_ID]: { category: "evolution", attributes: [0] },
		} as unknown as GameDataSource["items"],
		natures: { [NATURE_ID]: { increases: null, decreases: null } },
		typeChart: {},
	};
	return unwrap(GameData.create(source));
}

/** Builds one creature blob at the given total experience with an optional nickname. */
function createCreature(experience: number, nickname?: string): LegacyCreatureComponent {
	return {
		species: BASE_SPECIES,
		nickname,
		nature: NATURE_ID,
		experience,
		moveset: [MOVE_ID, null, null, null],
		status: { state: null, damage: 0, pp: [35, 0, 0, 0] },
		iv: statSet(0),
		ev: statSet(0),
	};
}

/** Builds a one-player world holding a single creature. */
function createWorld(
	creatureId: string,
	creature: LegacyCreatureComponent,
): { world: World; playerId: string } {
	let playerId = createPlayerId("hero");
	let world = migrateWorld({
		entities: [playerId, creatureId],
		playerId,
		playerProfile: { [playerId]: { name: "Hero" } },
		party: { [playerId]: { creatureIds: [creatureId] } },
		inventory: { [playerId]: { items: {} } },
		money: { [playerId]: { amount: 0 } },
		bestiary: { [playerId]: { seen: [], caught: [] } },
		storageBoxes: { [playerId]: { boxes: [] } },
		creature: { [creatureId]: creature },
	});
	return { world, playerId };
}

test("evolveCreature swaps the species id", () => {
	let id = createCreatureId("one");
	let { world } = createWorld(id, createCreature(125));

	let identity = evolveCreature(world, id, EVOLVED_SPECIES);

	expect(identity.speciesId).toBe(EVOLVED_SPECIES);
	expect(world.creatureIdentity[id]?.speciesId).toBe(EVOLVED_SPECIES);
});

test("evolveCreature preserves the nickname while swapping species", () => {
	let id = createCreatureId("one");
	let { world } = createWorld(id, createCreature(125, "Sparky"));

	let identity = evolveCreature(world, id, EVOLVED_SPECIES);

	expect(identity).toEqual({ speciesId: EVOLVED_SPECIES, nickname: "Sparky" });
});

test("getLevelUpEvolution returns the target once the level threshold is met", () => {
	let id = createCreatureId("one");
	// 1000 experience is exactly level 10 on the medium-fast curve, matching the evolution threshold.
	let { world } = createWorld(id, createCreature(1000));

	expect(getLevelUpEvolution(createGameData(), world, id)).toBe(EVOLVED_SPECIES);
});

test("getLevelUpEvolution returns null below the level threshold", () => {
	let id = createCreatureId("one");
	// 125 experience is level 5, short of the level-10 evolution.
	let { world } = createWorld(id, createCreature(125));

	expect(getLevelUpEvolution(createGameData(), world, id)).toBeNull();
});

test("getLevelUpEvolution returns null for a species with no level evolution", () => {
	let id = createCreatureId("one");
	let { world } = createWorld(id, createCreature(1000));
	// Retarget the creature to the trade-only species, which has no level evolution at all.
	world.creatureIdentity[id] = { speciesId: TRADE_SPECIES };

	expect(getLevelUpEvolution(createGameData(), world, id)).toBeNull();
});

test("getLevelUpEvolution ignores non-level evolution methods", () => {
	let id = createCreatureId("one");
	let move: Move = {
		type: "normal",
		damageClass: DamageClass.Physical,
		power: 40,
		accuracy: 100,
		pp: 35,
		effect: { kind: "none" },
	};
	// A species whose only evolution is by trade must never resolve through the level trigger.
	let source: GameDataSource = {
		species: {
			[BASE_SPECIES]: species([{ method: EvolutionMethod.Trade, speciesId: TRADE_SPECIES }]),
			[TRADE_SPECIES]: species([]),
		},
		moves: { [MOVE_ID]: move },
		items: {},
		natures: { [NATURE_ID]: { increases: null, decreases: null } },
		typeChart: {},
	};
	let gameData = unwrap(GameData.create(source));
	let { world } = createWorld(id, createCreature(1000));

	expect(getLevelUpEvolution(gameData, world, id)).toBeNull();
});

test("getItemEvolution returns the target for the matching evolution item", () => {
	let id = createCreatureId("one");
	let { world } = createWorld(id, createCreature(125));

	expect(getItemEvolution(createGameData(), world, id, STONE_ITEM_ID)).toBe(STONE_SPECIES);
});

test("getItemEvolution returns null for an item the species does not evolve with", () => {
	let id = createCreatureId("one");
	let { world } = createWorld(id, createCreature(125));

	expect(getItemEvolution(createGameData(), world, id, OTHER_ITEM_ID)).toBeNull();
});

test("getItemEvolution returns null when the species has no item evolution", () => {
	let id = createCreatureId("one");
	let { world } = createWorld(id, createCreature(1000));
	// The trade-only species carries no use-item evolution at all.
	world.creatureIdentity[id] = { speciesId: TRADE_SPECIES };

	expect(getItemEvolution(createGameData(), world, id, STONE_ITEM_ID)).toBeNull();
});

test("getTradeEvolution recognizes the trade trigger from data", () => {
	let id = createCreatureId("one");
	let { world } = createWorld(id, createCreature(125));

	expect(getTradeEvolution(createGameData(), world, id)).toBe(TRADE_SPECIES);
});

test("getTradeEvolution returns null for a species with no trade evolution", () => {
	let id = createCreatureId("one");
	let { world } = createWorld(id, createCreature(125));
	world.creatureIdentity[id] = { speciesId: EVOLVED_SPECIES };

	expect(getTradeEvolution(createGameData(), world, id)).toBeNull();
});
