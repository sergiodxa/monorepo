/**
 * Verifies the encounter system spawns reproducible, unowned wild creatures.
 *
 * The tests confirm `spawnEncounter` writes identity, progress, moves, health, status, and an encounter
 * location; that under a seeded RNG the nature, per-stat IVs (0..31), and derived moveset are
 * deterministic; that experience matches the species growth curve for the requested level; that explicit
 * nature/IV/move overrides bypass the RNG; and that the creature is left unowned until a capture converts
 * it. A tiny inline content source pins the roster so the assertions are exact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { unwrap } from "@pkg/result";

import { GameData, type GameDataSource } from "../data/game-data";
import { GrowthRate } from "../data/growth-rate";
import { DamageClass, type Move } from "../data/move";
import { type Species } from "../data/species";
import { Stat } from "../data/stat";
import { createPlayerId } from "../world/ids";
import { migrateWorld } from "../world/migrate";
import { type World } from "../world/world";

import { spawnEncounter } from "./encounter-system";

let SPECIES_ID = "SPECIES_A";
let TACKLE = "MOVE_TACKLE";
let GROWL = "MOVE_GROWL";
let EMBER = "MOVE_EMBER";
let NATURE_A = "NATURE_A";
let NATURE_B = "NATURE_B";

/** Builds a flat stat block for predictable species base stats. */
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

/** Builds a move with a chosen PP maximum. */
function move(pp: number): Move {
	return {
		type: "normal",
		damageClass: DamageClass.Physical,
		power: 40,
		accuracy: 100,
		pp,
		effect: { kind: "none" },
	};
}

/** Builds a medium-fast content source with two natures and a small level-up learnset. */
function createGameData(): GameData {
	let species: Species = {
		number: 1,
		size: { weight: 10, height: 1 },
		types: ["normal"],
		baseExperience: 64,
		catchRate: 45,
		growthRate: GrowthRate.MediumFast,
		stats: statSet(50),
		evolutions: [],
		learnset: [
			{ level: 1, moveId: TACKLE },
			{ level: 3, moveId: GROWL },
			{ level: 7, moveId: EMBER },
		],
		gender: { male: 50, female: 50 },
		eggGroup: ["monster"],
	} as unknown as Species;
	let source: GameDataSource = {
		// Nature insertion order is A then B, so the RNG index maps directly to the nature id.
		natures: {
			[NATURE_A]: { increases: null, decreases: null },
			[NATURE_B]: { increases: null, decreases: null },
		},
		species: { [SPECIES_ID]: species },
		moves: { [TACKLE]: move(35), [GROWL]: move(40), [EMBER]: move(25) },
		items: {},
		typeChart: {},
	};
	return unwrap(GameData.create(source));
}

/** Builds an empty one-player world ready to receive an encounter. */
function createWorld(): { world: World; playerId: string } {
	let playerId = createPlayerId("hero");
	let world = migrateWorld({
		entities: [playerId],
		playerId,
		playerProfile: { [playerId]: { name: "Hero" } },
		party: { [playerId]: { creatureIds: [] } },
		inventory: { [playerId]: { items: {} } },
		money: { [playerId]: { amount: 0 } },
		bestiary: { [playerId]: { seen: [], caught: [] } },
		storageBoxes: { [playerId]: { boxes: [] } },
		creature: {},
	});
	return { world, playerId };
}

test("spawnEncounter writes the full component set at an encounter location", () => {
	let { world } = createWorld();
	let { creatureId } = spawnEncounter(
		createGameData(),
		world,
		{ encounterId: "route-1", speciesId: SPECIES_ID, level: 5 },
		() => 0,
	);

	expect(world.creatureIdentity[creatureId]).toEqual({ speciesId: SPECIES_ID });
	expect(world.creatureProgress[creatureId]).toBeDefined();
	expect(world.creatureMoves[creatureId]).toBeDefined();
	expect(world.creatureHealth[creatureId]).toEqual({ damage: 0 });
	expect(world.creatureStatus[creatureId]).toEqual({ state: null });
	expect(world.creatureLocation[creatureId]).toEqual({
		kind: "encounter",
		encounterId: "route-1",
	});
	expect(world.entities).toContain(creatureId);
});

test("spawnEncounter leaves the creature unowned until a capture converts it", () => {
	let { world } = createWorld();
	let { creatureId } = spawnEncounter(
		createGameData(),
		world,
		{ encounterId: "route-1", speciesId: SPECIES_ID, level: 5 },
		() => 0,
	);

	expect(world.ownership[creatureId]).toBeUndefined();
});

test("spawnEncounter sets experience to the species curve total for the level", () => {
	let { world } = createWorld();
	// Medium-fast level 8 === 8^3 === 512.
	let { creatureId } = spawnEncounter(
		createGameData(),
		world,
		{ encounterId: "route-1", speciesId: SPECIES_ID, level: 8 },
		() => 0,
	);

	expect(world.creatureProgress[creatureId]?.experience).toBe(512);
});

test("spawnEncounter rolls nature and IVs deterministically from a scripted RNG", () => {
	let { world } = createWorld();
	// Call order: 1 nature index, then 6 IV rolls in HP, Attack, Defense, SpAtk, SpDef, Speed order.
	// Nature roll 0.6 -> floor(0.6 * 2) === 1 -> NATURE_B. IV roll r -> floor(r * 32).
	let rolls = [0.6, 0, 0.5, 0.99, 0.25, 0.75, 0.1];
	let index = 0;
	let random = () => rolls[index++]!;

	let { creatureId } = spawnEncounter(
		createGameData(),
		world,
		{ encounterId: "route-1", speciesId: SPECIES_ID, level: 5 },
		random,
	);

	let progress = world.creatureProgress[creatureId]!;
	expect(progress.natureId).toBe(NATURE_B);
	expect(progress.iv).toEqual({
		[Stat.HP]: 0,
		[Stat.Attack]: 16,
		[Stat.Defense]: 31,
		[Stat.SpecialAttack]: 8,
		[Stat.SpecialDefense]: 24,
		[Stat.Speed]: 3,
	});
	// EVs always start at zero.
	expect(progress.ev).toEqual(statSet(0));
});

test("spawnEncounter derives the most recent level-up moves for the level", () => {
	let { world } = createWorld();
	// At level 5 the species knows Tackle (1) and Growl (3) but not Ember (7).
	let { creatureId } = spawnEncounter(
		createGameData(),
		world,
		{ encounterId: "route-1", speciesId: SPECIES_ID, level: 5 },
		() => 0,
	);

	let moves = world.creatureMoves[creatureId]!;
	expect(moves.moveset).toEqual([TACKLE, GROWL, null, null]);
	// PP mirrors each move's authored maximum, with empty slots at zero.
	expect(moves.pp).toEqual([35, 40, 0, 0]);
});

test("spawnEncounter includes higher-level moves once the level qualifies", () => {
	let { world } = createWorld();
	let { creatureId } = spawnEncounter(
		createGameData(),
		world,
		{ encounterId: "route-1", speciesId: SPECIES_ID, level: 10 },
		() => 0,
	);

	expect(world.creatureMoves[creatureId]?.moveset).toEqual([TACKLE, GROWL, EMBER, null]);
});

test("spawnEncounter honors explicit nature, IV, and move overrides without the RNG", () => {
	let { world } = createWorld();
	// A throwing RNG proves the overrides bypass every random roll.
	let random = () => {
		throw new Error("random should not be called when everything is overridden");
	};

	let { creatureId } = spawnEncounter(
		createGameData(),
		world,
		{
			encounterId: "route-1",
			speciesId: SPECIES_ID,
			level: 5,
			natureId: NATURE_A,
			iv: {
				[Stat.HP]: 31,
				[Stat.Attack]: 30,
				[Stat.Defense]: 29,
				[Stat.SpecialAttack]: 28,
				[Stat.SpecialDefense]: 27,
				[Stat.Speed]: 26,
			},
			moveIds: [EMBER],
		},
		random,
	);

	let progress = world.creatureProgress[creatureId]!;
	expect(progress.natureId).toBe(NATURE_A);
	expect(progress.iv).toEqual({
		[Stat.HP]: 31,
		[Stat.Attack]: 30,
		[Stat.Defense]: 29,
		[Stat.SpecialAttack]: 28,
		[Stat.SpecialDefense]: 27,
		[Stat.Speed]: 26,
	});
	expect(world.creatureMoves[creatureId]?.moveset).toEqual([EMBER, null, null, null]);
});

test("spawnEncounter rolls IVs for stats missing from a partial IV override", () => {
	let { world } = createWorld();
	// Only nature and HP are pinned; the remaining five IVs still consume RNG rolls in stat order.
	let rolls = [0, 0.5, 0.5, 0.5, 0.5, 0.5];
	let index = 0;
	let random = () => rolls[index++]!;

	let { creatureId } = spawnEncounter(
		createGameData(),
		world,
		{
			encounterId: "route-1",
			speciesId: SPECIES_ID,
			level: 5,
			iv: { [Stat.HP]: 15 },
		},
		random,
	);

	let progress = world.creatureProgress[creatureId]!;
	// The override wins for HP; every other stat rolls floor(0.5 * 32) === 16.
	expect(progress.iv[Stat.HP]).toBe(15);
	expect(progress.iv[Stat.Attack]).toBe(16);
	expect(progress.iv[Stat.Speed]).toBe(16);
});

test("spawnEncounter throws for an unknown species", () => {
	let { world } = createWorld();
	expect(() =>
		spawnEncounter(
			createGameData(),
			world,
			{ encounterId: "route-1", speciesId: "MISSING", level: 5 },
			() => 0,
		),
	).toThrow(ReferenceError);
});
