import { unwrap } from "@pkg/result";
/**
 * Verifies the party system's full-restoration behavior: `healParty` clears
 * damage and status, refills PP from authored move maxima, treats an empty
 * or missing party as a zero-count no-op, and leaves empty move slots at
 * zero PP.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { LegacyCreatureComponent } from "../world/components";
import type { MoveSet } from "../world/creature";

import { GameData, type GameDataSource } from "../data/game-data";
import { DamageClass, type Move } from "../data/move";
import { State } from "../data/status";
import { createCreatureId, createPlayerId } from "../world/ids";
import { migrateWorld } from "../world/migrate";
import { type World } from "../world/world";

import { healParty } from "./party-system";

let SPECIES_ID = "SPECIES_A";
let NATURE_ID = "HARDY";
let MOVE_A = "MOVE_A";
let MOVE_B = "MOVE_B";

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

/** Builds a content source with two moves that have distinct PP maxima. */
function createGameData(): GameData {
	let move = (pp: number): Move => ({
		type: "normal",
		damageClass: DamageClass.Physical,
		power: 40,
		accuracy: 100,
		pp,
		effect: { kind: "none" },
	});
	let source: GameDataSource = {
		species: {},
		moves: { [MOVE_A]: move(35), [MOVE_B]: move(10) },
		items: {},
		natures: { [NATURE_ID]: { increases: null, decreases: null } },
		typeChart: {},
	};
	return unwrap(GameData.create(source));
}

/** Builds one creature blob with a chosen moveset, PP, damage, and status. */
function createCreature(args: {
	moveset: MoveSet;
	pp: [number, number, number, number];
	damage?: number;
	state?: State | null;
}): LegacyCreatureComponent {
	return {
		species: SPECIES_ID,
		nature: NATURE_ID,
		experience: 125,
		moveset: args.moveset,
		status: { state: args.state ?? null, damage: args.damage ?? 0, pp: args.pp },
		iv: statSet(0),
		ev: statSet(0),
	};
}

/** Builds a one-player world holding the given party creatures by id. */
function createWorld(creatures: Record<string, LegacyCreatureComponent>): {
	world: World;
	playerId: string;
} {
	let playerId = createPlayerId("hero");
	let creatureIds = Object.keys(creatures);
	let world = migrateWorld({
		entities: [playerId, ...creatureIds],
		playerId,
		playerProfile: { [playerId]: { name: "Hero" } },
		party: { [playerId]: { creatureIds } },
		inventory: { [playerId]: { items: {} } },
		money: { [playerId]: { amount: 0 } },
		bestiary: { [playerId]: { seen: [], caught: [] } },
		storageBoxes: { [playerId]: { boxes: [] } },
		creature: creatures,
	});
	return { world, playerId };
}

test("healParty clears damage and status and refills PP from move maxima", () => {
	let id = createCreatureId("one");
	let { world, playerId } = createWorld({
		[id]: createCreature({
			moveset: [MOVE_A, MOVE_B, null, null],
			pp: [1, 0, 0, 0],
			damage: 12,
			state: State.Poisoned,
		}),
	});

	let count = healParty(createGameData(), world, playerId);

	expect(count).toBe(1);
	expect(world.creatureHealth[id]).toEqual({ damage: 0 });
	expect(world.creatureStatus[id]).toEqual({ state: null });
	expect(world.creatureMoves[id]?.pp).toEqual([35, 10, 0, 0]);
});

test("healParty leaves empty move slots at zero PP", () => {
	let id = createCreatureId("one");
	let { world, playerId } = createWorld({
		[id]: createCreature({ moveset: [MOVE_A, null, null, null], pp: [0, 0, 0, 0] }),
	});

	healParty(createGameData(), world, playerId);

	expect(world.creatureMoves[id]?.pp).toEqual([35, 0, 0, 0]);
});

test("healParty restores every party member and returns the count", () => {
	let a = createCreatureId("a");
	let b = createCreatureId("b");
	let { world, playerId } = createWorld({
		[a]: createCreature({ moveset: [MOVE_A, null, null, null], pp: [5, 0, 0, 0], damage: 3 }),
		[b]: createCreature({
			moveset: [MOVE_B, null, null, null],
			pp: [2, 0, 0, 0],
			damage: 7,
			state: State.Burned,
		}),
	});

	let count = healParty(createGameData(), world, playerId);

	expect(count).toBe(2);
	expect(world.creatureHealth[a]).toEqual({ damage: 0 });
	expect(world.creatureHealth[b]).toEqual({ damage: 0 });
	expect(world.creatureStatus[b]).toEqual({ state: null });
	expect(world.creatureMoves[a]?.pp).toEqual([35, 0, 0, 0]);
	expect(world.creatureMoves[b]?.pp).toEqual([10, 0, 0, 0]);
});

test("healParty returns zero for an empty party", () => {
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

	expect(healParty(createGameData(), world, playerId)).toBe(0);
});

test("healParty returns zero when the player has no party component", () => {
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
	delete world.party[playerId];

	expect(healParty(createGameData(), world, playerId)).toBe(0);
});

test("healParty falls back to zero PP for a move missing from game data", () => {
	let id = createCreatureId("one");
	let { world, playerId } = createWorld({
		[id]: createCreature({
			moveset: [MOVE_A, "MISSING_MOVE", null, null],
			pp: [0, 0, 0, 0],
		}),
	});

	healParty(createGameData(), world, playerId);

	expect(world.creatureMoves[id]?.pp).toEqual([35, 0, 0, 0]);
});
