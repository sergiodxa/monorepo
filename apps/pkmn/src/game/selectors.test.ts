/**
 * Tests for the creature summary selector's stat-training fields.
 *
 * Verifies that `selectCreatureSummaryView` carries a creature's individual
 * values, effort values, and nature through from its progress component into the
 * UI-oriented read model without altering them, and that the exposed stat sets
 * are copies rather than references into the world stores.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { unwrap } from "@pkg/result";

import { ITEMS } from "~/content/items";
import { TYPE_MATCHUPS } from "~/content/matchups";
import { MOVES } from "~/content/moves";
import { NATURES } from "~/content/natures";
import { SPECIES } from "~/content/species";

import type { StatSet } from "./data/stat";

import { GameData } from "./data/game-data";
import { selectCreatureSummaryView } from "./selectors";
import { createCreatureId, createPlayerId } from "./world/ids";
import { migrateWorld } from "./world/migrate";

let SPECIES_ID = Object.keys(SPECIES)[0]!;
let NATURE_ID = Object.keys(NATURES)[0]!;
let MOVE_ID = Object.keys(MOVES)[0]!;

/** Distinct per-stat values so a mixed-up field is easy to spot in assertions. */
let KNOWN_IVS: StatSet = {
	hp: 31,
	attack: 30,
	defense: 29,
	"special-attack": 28,
	"special-defense": 27,
	speed: 26,
};

/** Distinct EV spread that differs from the IVs on every stat. */
let KNOWN_EVS: StatSet = {
	hp: 252,
	attack: 6,
	defense: 0,
	"special-attack": 100,
	"special-defense": 50,
	speed: 100,
};

/** Builds validated game data from the real authored content. */
function gameData() {
	return unwrap(
		GameData.create({
			species: SPECIES,
			moves: MOVES,
			items: ITEMS,
			natures: NATURES,
			typeChart: TYPE_MATCHUPS,
		}),
	);
}

/** Builds a world holding one party creature with the given progress fields. */
function worldWithCreature(ivs: StatSet, evs: StatSet, natureId: string) {
	let playerId = createPlayerId("hero");
	let creatureId = createCreatureId("ally-1");
	let world = migrateWorld({
		entities: [playerId, creatureId],
		playerId,
		playerProfile: { [playerId]: { name: "Hero" } },
		party: { [playerId]: { creatureIds: [creatureId] } },
		inventory: { [playerId]: { items: {} } },
		bestiary: { [playerId]: { seen: [], caught: [] } },
		storageBoxes: { [playerId]: { boxes: [] } },
		creature: {
			[creatureId]: {
				species: SPECIES_ID,
				nature: natureId,
				experience: 0,
				moveset: [MOVE_ID, null, null, null] as [string, null, null, null],
				status: {
					state: null,
					damage: 0,
					pp: [35, 0, 0, 0] as [number, number, number, number],
				},
				iv: ivs,
				ev: evs,
			},
		},
	});
	return { world, creatureId };
}

test("selectCreatureSummaryView carries IVs, EVs, and nature through exactly", () => {
	let { world, creatureId } = worldWithCreature(KNOWN_IVS, KNOWN_EVS, NATURE_ID);

	let view = selectCreatureSummaryView(gameData(), world, creatureId);

	expect(view.ivs).toEqual(KNOWN_IVS);
	expect(view.evs).toEqual(KNOWN_EVS);
	expect(view.nature).toBe(NATURE_ID);
});

test("selectCreatureSummaryView copies the stat sets instead of sharing world state", () => {
	let { world, creatureId } = worldWithCreature(KNOWN_IVS, KNOWN_EVS, NATURE_ID);

	let view = selectCreatureSummaryView(gameData(), world, creatureId);

	// Mutating the view must not reach back into the world's progress component.
	view.ivs.hp = 0;
	view.evs.speed = 0;

	expect(world.creatureProgress[creatureId]!.iv.hp).toBe(KNOWN_IVS.hp);
	expect(world.creatureProgress[creatureId]!.ev.speed).toBe(KNOWN_EVS.speed);
});
