/**
 * Verifies world migration backfills per-instance creature state and that
 * held-item accessors read and write it correctly.
 *
 * Older saves predate the instance store, so migration must materialize a
 * default instance for every creature and keep it in the persistent snapshot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { LegacyCreatureComponent } from "./components";
import type { LegacyWorld } from "./migrate";

import { DEFAULT_CREATURE_INSTANCE } from "./components";
import { pickPersistentWorld } from "./helpers";
import { createCreatureId, createPlayerId } from "./ids";
import { migrateWorld } from "./migrate";
import { getCreatureHeldItem, getCreatureInstance, setCreatureHeldItem } from "./world";

let PLAYER_ID = createPlayerId("hero");
let CREATURE_ID = createCreatureId("one");

/** Builds a legacy aggregate creature blob. */
function legacyCreature(): LegacyCreatureComponent {
	return {
		species: "SPECIES_A",
		nature: "HARDY",
		experience: 100,
		moveset: ["MOVE_A", null, null, null],
		status: { state: null, damage: 0, pp: [35, 0, 0, 0] },
		iv: { hp: 0, attack: 0, defense: 0, "special-attack": 0, "special-defense": 0, speed: 0 },
		ev: { hp: 0, attack: 0, defense: 0, "special-attack": 0, "special-defense": 0, speed: 0 },
	} as unknown as LegacyCreatureComponent;
}

/** Builds a legacy save that has a creature but no instance store at all. */
function legacyWorld(): LegacyWorld {
	return {
		entities: [PLAYER_ID, CREATURE_ID],
		playerId: PLAYER_ID,
		playerProfile: { [PLAYER_ID]: { name: "Hero" } },
		party: { [PLAYER_ID]: { creatureIds: [CREATURE_ID] } },
		inventory: { [PLAYER_ID]: { items: {} } },
		money: { [PLAYER_ID]: { amount: 0 } },
		bestiary: { [PLAYER_ID]: { seen: [], caught: [] } },
		storageBoxes: { [PLAYER_ID]: { boxes: [] } },
		creature: { [CREATURE_ID]: legacyCreature() },
	};
}

test("migrateWorld backfills the default instance state for saves without one", () => {
	let world = migrateWorld(legacyWorld());
	expect(world.creatureInstance[CREATURE_ID]).toEqual(DEFAULT_CREATURE_INSTANCE);
});

test("getCreatureInstance returns the default when the store has no entry", () => {
	let world = migrateWorld(legacyWorld());
	delete world.creatureInstance[CREATURE_ID];
	expect(getCreatureInstance(world, CREATURE_ID)).toEqual(DEFAULT_CREATURE_INSTANCE);
	expect(getCreatureHeldItem(world, CREATURE_ID)).toBeNull();
});

test("setCreatureHeldItem sets and clears the held item without touching other fields", () => {
	let world = migrateWorld(legacyWorld());

	setCreatureHeldItem(world, CREATURE_ID, "LEFTOVERS");
	expect(getCreatureHeldItem(world, CREATURE_ID)).toBe("LEFTOVERS");
	expect(world.creatureInstance[CREATURE_ID]?.gender).toBe(DEFAULT_CREATURE_INSTANCE.gender);
	expect(world.creatureInstance[CREATURE_ID]?.friendship).toBe(0);

	setCreatureHeldItem(world, CREATURE_ID, null);
	expect(getCreatureHeldItem(world, CREATURE_ID)).toBeNull();
});

test("the persistent snapshot carries per-instance creature state", () => {
	let world = migrateWorld(legacyWorld());
	setCreatureHeldItem(world, CREATURE_ID, "LEFTOVERS");

	let snapshot = pickPersistentWorld(world);
	expect(snapshot.creatureInstance[CREATURE_ID]?.heldItemId).toBe("LEFTOVERS");
});
