import { unwrap } from "@pkg/result";
/**
 * Tests for the creature summary and species-detail selectors.
 *
 * Verifies that `selectCreatureSummaryView` exposes a creature's current
 * computed stat values (derived through the shared stat formula), carries its
 * individual values, effort values, and nature through from its progress
 * component without altering them, and that the exposed stat sets are copies
 * rather than references into the world stores. Also verifies that
 * `selectSpeciesDetailView` exposes a species' number, types, and base stats,
 * reports the player's seen/caught flags, carries the injected habitat through,
 * and copies the base stats so the view never aliases content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { ITEMS } from "~/content/items";
import { TYPE_MATCHUPS } from "~/content/matchups";
import { MOVES } from "~/content/moves";
import { NATURES } from "~/content/natures";
import { SPECIES } from "~/content/species";

import type { StatSet } from "./data/stat";

import { getCreatureStat } from "./battle/mechanics";
import { GameData } from "./data/game-data";
import { Stat } from "./data/stat";
import { selectCreatureSummaryView, selectSpeciesDetailView } from "./selectors";
import { createCreatureId, createPlayerId } from "./world/ids";
import { migrateWorld } from "./world/migrate";
import { createCreatureFromWorld } from "./world/world";

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

test("selectCreatureSummaryView exposes current computed stat values via the stat formula", () => {
	let { world, creatureId } = worldWithCreature(KNOWN_IVS, KNOWN_EVS, NATURE_ID);
	let data = gameData();

	let view = selectCreatureSummaryView(data, world, creatureId);

	// The summary's stats must match the shared battle stat path exactly, stat
	// for stat, so the screen reflects the creature's real current values.
	let creature = createCreatureFromWorld(world, creatureId);
	let expected: StatSet = {
		hp: getCreatureStat(data, creature, Stat.HP),
		attack: getCreatureStat(data, creature, Stat.Attack),
		defense: getCreatureStat(data, creature, Stat.Defense),
		"special-attack": getCreatureStat(data, creature, Stat.SpecialAttack),
		"special-defense": getCreatureStat(data, creature, Stat.SpecialDefense),
		speed: getCreatureStat(data, creature, Stat.Speed),
	};

	expect(view.stats).toEqual(expected);
	// The HP stat and the exposed max HP come from the same computation.
	expect(view.stats.hp).toBe(view.maxHP);
	// Current stats are distinct from the effort-value spread they are not.
	expect(view.stats).not.toEqual(KNOWN_EVS);
});

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

/** Builds a world whose player has the given species recorded as seen and caught. */
function worldWithBestiary(seen: string[], caught: string[]) {
	let playerId = createPlayerId("hero");
	return migrateWorld({
		entities: [playerId],
		playerId,
		playerProfile: { [playerId]: { name: "Hero" } },
		party: { [playerId]: { creatureIds: [] } },
		inventory: { [playerId]: { items: {} } },
		bestiary: { [playerId]: { seen, caught } },
		storageBoxes: { [playerId]: { boxes: [] } },
		creature: {},
	});
}

test("selectSpeciesDetailView exposes the species number, types, and base stats", () => {
	let data = gameData();
	let world = worldWithBestiary([SPECIES_ID], []);
	let species = SPECIES[SPECIES_ID]!;

	let view = selectSpeciesDetailView(data, world, SPECIES_ID, []);

	expect(view.speciesId).toBe(SPECIES_ID);
	expect(view.number).toBe(species.number);
	expect(view.types).toEqual([...species.types]);
	expect(view.baseStats).toEqual(species.stats);
});

test("selectSpeciesDetailView reports seen and caught flags from the player's record", () => {
	let data = gameData();
	let ids = Object.keys(SPECIES);
	let seenOnly = ids[0]!;
	let caught = ids[1]!;
	let unrecorded = ids[2]!;
	let world = worldWithBestiary([seenOnly, caught], [caught]);

	let seenView = selectSpeciesDetailView(data, world, seenOnly, []);
	expect(seenView.seen).toBe(true);
	expect(seenView.caught).toBe(false);

	let caughtView = selectSpeciesDetailView(data, world, caught, []);
	expect(caughtView.seen).toBe(true);
	expect(caughtView.caught).toBe(true);

	let unrecordedView = selectSpeciesDetailView(data, world, unrecorded, []);
	expect(unrecordedView.seen).toBe(false);
	expect(unrecordedView.caught).toBe(false);
});

test("selectSpeciesDetailView carries the injected habitat and copies the base stats", () => {
	let data = gameData();
	let world = worldWithBestiary([SPECIES_ID], []);

	let view = selectSpeciesDetailView(data, world, SPECIES_ID, ["route-1", "cave-2"]);
	expect(view.habitat).toEqual(["route-1", "cave-2"]);

	// The exposed base stats must be a copy: mutating them cannot reach content.
	view.baseStats.hp = 0;
	expect(SPECIES[SPECIES_ID]!.stats.hp).not.toBe(0);
});
