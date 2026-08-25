import { unwrap } from "@pkg/result";
/**
 * Verifies the encounter system spawns reproducible, unowned wild creatures.
 *
 * The tests confirm `spawnEncounter` writes the full component set deterministically under
 * a seeded RNG, sets experience from the species growth curve, honors explicit overrides,
 * and leaves the creature unowned until a capture converts it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { GameData, type GameDataSource } from "../data/game-data";
import { GrowthRate } from "../data/growth-rate";
import { DamageClass, type Move } from "../data/move";
import { Gender, type Species } from "../data/species";
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

/**
 * Builds a medium-fast content source with two natures and a small level-up learnset;
 * insertion order is A then B, so a nature RNG index maps directly to the nature id.
 */
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

/**
 * The fixture species has a 50/50 gender ratio, so a low random draw resolves female
 * and a high draw resolves male.
 */
test("spawnEncounter rolls a gender deterministically from the even ratio", () => {
	let { world } = createWorld();
	let female = spawnEncounter(
		createGameData(),
		world,
		{ encounterId: "route-1", speciesId: SPECIES_ID, level: 5 },
		() => 0.1,
	);
	let male = spawnEncounter(
		createGameData(),
		world,
		{ encounterId: "route-2", speciesId: SPECIES_ID, level: 5 },
		() => 0.9,
	);

	expect(world.creatureInstance[female.creatureId]?.gender).toBe(Gender.Female);
	expect(world.creatureInstance[male.creatureId]?.gender).toBe(Gender.Male);
	expect(world.creatureInstance[female.creatureId]?.heldItemId).toBeNull();
	expect(world.creatureInstance[female.creatureId]?.friendship).toBe(0);
});

/**
 * A genderless species never consults the ratio branch, so any random draw still
 * resolves as genderless.
 */
test("spawnEncounter always yields genderless for a species with no ratio", () => {
	let { world } = createWorld();
	let genderlessSource: GameDataSource = {
		natures: {
			[NATURE_A]: { increases: null, decreases: null },
			[NATURE_B]: { increases: null, decreases: null },
		},
		species: {
			[SPECIES_ID]: {
				number: 1,
				size: { weight: 10, height: 1 },
				types: ["normal"],
				baseExperience: 64,
				catchRate: 45,
				growthRate: GrowthRate.MediumFast,
				stats: statSet(50),
				evolutions: [],
				learnset: [{ level: 1, moveId: TACKLE }],
				gender: Gender.Genderless,
				eggGroup: ["monster"],
			} as unknown as Species,
		},
		moves: { [TACKLE]: move(35) },
		items: {},
		typeChart: {},
	};
	let gameData = unwrap(GameData.create(genderlessSource));

	let { creatureId } = spawnEncounter(
		gameData,
		world,
		{ encounterId: "route-1", speciesId: SPECIES_ID, level: 5 },
		() => 0.5,
	);

	expect(world.creatureInstance[creatureId]?.gender).toBe(Gender.Genderless);
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

/** Medium-fast level 8 works out to 8^3, or 512 experience on the growth curve. */
test("spawnEncounter sets experience to the species curve total for the level", () => {
	let { world } = createWorld();
	let { creatureId } = spawnEncounter(
		createGameData(),
		world,
		{ encounterId: "route-1", speciesId: SPECIES_ID, level: 8 },
		() => 0,
	);

	expect(world.creatureProgress[creatureId]?.experience).toBe(512);
});

/**
 * Rolls consume the RNG in order: one nature index, then six IVs in HP, Attack, Defense,
 * SpAtk, SpDef, Speed order. A 0.6 nature roll floors to index 1 (NATURE_B); each IV roll
 * r floors to r * 32.
 */
test("spawnEncounter rolls nature and IVs deterministically from a scripted RNG", () => {
	let { world } = createWorld();
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
	expect(progress.ev).toEqual(statSet(0));
});

/**
 * At level 5 the species knows Tackle (learned at 1) and Growl (learned at 3) but not
 * Ember (learned at 7); PP mirrors each move's authored maximum, with empty slots at zero.
 */
test("spawnEncounter derives the most recent level-up moves for the level", () => {
	let { world } = createWorld();
	let { creatureId } = spawnEncounter(
		createGameData(),
		world,
		{ encounterId: "route-1", speciesId: SPECIES_ID, level: 5 },
		() => 0,
	);

	let moves = world.creatureMoves[creatureId]!;
	expect(moves.moveset).toEqual([TACKLE, GROWL, null, null]);
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

/** A throwing random function proves the overrides bypass every random roll. */
test("spawnEncounter honors explicit nature, IV, and move overrides without the RNG", () => {
	let { world } = createWorld();
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
			gender: Gender.Male,
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

/**
 * Only nature and HP are pinned; the remaining five IVs still consume RNG rolls in stat
 * order, so HP keeps its override of 15 while every other stat rolls floor(0.5 * 32) === 16.
 */
test("spawnEncounter rolls IVs for stats missing from a partial IV override", () => {
	let { world } = createWorld();
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
