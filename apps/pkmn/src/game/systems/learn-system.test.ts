import { unwrap } from "@sdxc/result";
/**
 * Verifies the learn system's move-window math and moveset mutation rules:
 * `movesLearnedBetween`'s exclusive-lower/inclusive-upper window with
 * de-duplication, `applyLearnedMove`'s slot rules, and `learnMove`'s PP
 * refresh and replaced-move reporting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { LearnsetEntry } from "../data/species";
import type { LegacyCreatureComponent } from "../world/components";
import type { MoveSet } from "../world/creature";

import { GameData, type GameDataSource } from "../data/game-data";
import { GrowthRate } from "../data/growth-rate";
import { DamageClass, type Move } from "../data/move";
import { type Species } from "../data/species";
import { createCreatureId, createPlayerId } from "../world/ids";
import { migrateWorld } from "../world/migrate";
import { getCreatureComponentSet, type World } from "../world/world";

import { applyLearnedMove, hasFreeMoveSlot, learnMove, movesLearnedBetween } from "./learn-system";

let NATURE_ID = "HARDY";

/** Move ids used across the fixtures; each is authored with a distinct PP. */
let MOVE_A = "MOVE_A";
let MOVE_B = "MOVE_B";
let MOVE_C = "MOVE_C";
let MOVE_D = "MOVE_D";
let MOVE_NEW = "MOVE_NEW";

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

/** Builds a move with the given PP so learned-move PP can be asserted exactly. */
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

/** Builds a content source whose sole species carries the given learnset. */
function createGameData(learnset: LearnsetEntry[]): GameData {
	let species: Species = {
		number: 1,
		size: { weight: 10, height: 1 },
		types: ["normal"],
		baseExperience: 64,
		catchRate: 45,
		growthRate: GrowthRate.MediumFast,
		stats: statSet(50),
		evolutions: [],
		learnset,
		gender: { male: 50, female: 50 },
		eggGroup: ["monster"],
	} as unknown as Species;
	let source: GameDataSource = {
		species: { SPECIES_A: species },
		moves: {
			[MOVE_A]: move(35),
			[MOVE_B]: move(20),
			[MOVE_C]: move(15),
			[MOVE_D]: move(10),
			[MOVE_NEW]: move(25),
		},
		items: {},
		natures: { [NATURE_ID]: { increases: null, decreases: null } },
		typeChart: {},
	};
	return unwrap(GameData.create(source));
}

/** Builds one creature blob with the given moveset and per-slot PP. */
function createCreature(
	moveset: MoveSet,
	pp: [number, number, number, number],
): LegacyCreatureComponent {
	return {
		species: "SPECIES_A",
		nature: NATURE_ID,
		experience: 0,
		moveset,
		status: { state: null, damage: 0, pp },
		iv: statSet(0),
		ev: statSet(0),
	};
}

/** Builds a one-player world holding a single creature. */
function createWorld(creatureId: string, creature: LegacyCreatureComponent): World {
	let playerId = createPlayerId("hero");
	return migrateWorld({
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
}

test("movesLearnedBetween returns only moves in the exclusive-inclusive window", () => {
	let learnset: LearnsetEntry[] = [
		{ level: 3, moveId: MOVE_A },
		{ level: 6, moveId: MOVE_B },
		{ level: 9, moveId: MOVE_C },
	];
	expect(movesLearnedBetween(learnset, 5, 6)).toEqual([MOVE_B]);
	expect(movesLearnedBetween(learnset, 3, 9)).toEqual([MOVE_B, MOVE_C]);
});

test("movesLearnedBetween sorts by level, de-duplicates, and ignores non level-up entries", () => {
	let learnset: LearnsetEntry[] = [
		{ level: 8, moveId: MOVE_C },
		{ level: 4, moveId: MOVE_A },
		{ level: 4, moveId: MOVE_A },
		{ level: 6, moveId: MOVE_B },
		{ egg: true, moveId: MOVE_D },
		{ tutor: true, moveId: MOVE_NEW },
		{ tmhm: 1 },
	];
	expect(movesLearnedBetween(learnset, 0, 10)).toEqual([MOVE_A, MOVE_B, MOVE_C]);
});

test("movesLearnedBetween returns nothing when no level lands in the window", () => {
	let learnset: LearnsetEntry[] = [{ level: 12, moveId: MOVE_A }];
	expect(movesLearnedBetween(learnset, 5, 10)).toEqual([]);
});

test("applyLearnedMove auto-appends into the first free slot when not full", () => {
	let moveset: MoveSet = [MOVE_A, MOVE_B, null, null];
	expect(applyLearnedMove(moveset, MOVE_NEW)).toEqual([MOVE_A, MOVE_B, MOVE_NEW, null]);
});

test("applyLearnedMove overwrites the named slot when the moveset is full", () => {
	let moveset: MoveSet = [MOVE_A, MOVE_B, MOVE_C, MOVE_D];
	expect(applyLearnedMove(moveset, MOVE_NEW, 1)).toEqual([MOVE_A, MOVE_NEW, MOVE_C, MOVE_D]);
});

test("applyLearnedMove treats an out-of-range or negative slot as declined", () => {
	let moveset: MoveSet = [MOVE_A, MOVE_B, MOVE_C, MOVE_D];
	expect(applyLearnedMove(moveset, MOVE_NEW, 4)).toEqual(moveset);
	expect(applyLearnedMove(moveset, MOVE_NEW, -1)).toEqual(moveset);
});

test("applyLearnedMove never relearns a move already known", () => {
	let moveset: MoveSet = [MOVE_A, MOVE_B, null, null];
	expect(applyLearnedMove(moveset, MOVE_A)).toBe(moveset);
	expect(applyLearnedMove([MOVE_A, MOVE_B, MOVE_C, MOVE_D], MOVE_A, 2)).toEqual([
		MOVE_A,
		MOVE_B,
		MOVE_C,
		MOVE_D,
	]);
});

test("hasFreeMoveSlot reflects whether a null slot remains", () => {
	expect(hasFreeMoveSlot([MOVE_A, null, null, null])).toBe(true);
	expect(hasFreeMoveSlot([MOVE_A, MOVE_B, MOVE_C, MOVE_D])).toBe(false);
});

test("learnMove auto-appends into a free slot and gives the new move full PP", () => {
	let gameData = createGameData([{ level: 1, moveId: MOVE_A }]);
	let id = createCreatureId("one");
	let world = createWorld(id, createCreature([MOVE_A, null, null, null], [30, 0, 0, 0]));

	let result = learnMove(gameData, world, id, MOVE_NEW);

	expect(result).toEqual({ learned: true, slotIndex: 1 });
	let moves = getCreatureComponentSet(world, id).moves;
	expect(moves.moveset).toEqual([MOVE_A, MOVE_NEW, null, null]);
	expect(moves.pp).toEqual([30, 25, 0, 0]);
});

test("learnMove overwrites the chosen slot and reports the replaced move", () => {
	let gameData = createGameData([{ level: 1, moveId: MOVE_A }]);
	let id = createCreatureId("one");
	let world = createWorld(id, createCreature([MOVE_A, MOVE_B, MOVE_C, MOVE_D], [1, 2, 3, 4]));

	let result = learnMove(gameData, world, id, MOVE_NEW, 2);

	expect(result).toEqual({ learned: true, slotIndex: 2, replacedMoveId: MOVE_C });
	let moves = getCreatureComponentSet(world, id).moves;
	expect(moves.moveset).toEqual([MOVE_A, MOVE_B, MOVE_NEW, MOVE_D]);
	expect(moves.pp).toEqual([1, 2, 25, 4]);
});

test("learnMove leaves the moveset unchanged for a declined full moveset", () => {
	let gameData = createGameData([{ level: 1, moveId: MOVE_A }]);
	let id = createCreatureId("one");
	let world = createWorld(id, createCreature([MOVE_A, MOVE_B, MOVE_C, MOVE_D], [1, 2, 3, 4]));

	let result = learnMove(gameData, world, id, MOVE_NEW, -1);

	expect(result.learned).toBe(false);
	let moves = getCreatureComponentSet(world, id).moves;
	expect(moves.moveset).toEqual([MOVE_A, MOVE_B, MOVE_C, MOVE_D]);
	expect(moves.pp).toEqual([1, 2, 3, 4]);
});
