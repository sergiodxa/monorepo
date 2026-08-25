/**
 * Verifies the persisted story-flag store: reading, writing, the migration
 * default, and survival across the persistent snapshot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { LegacyWorld } from "./migrate";

import { pickPersistentWorld } from "./helpers";
import { createPlayerId } from "./ids";
import { migrateWorld } from "./migrate";
import { getFlag, selfSwitchFlag, setFlag } from "./world";

let PLAYER_ID = createPlayerId("hero");

/** Builds a legacy save with no flags store at all. */
function legacyWorld(): LegacyWorld {
	return {
		entities: [PLAYER_ID],
		playerId: PLAYER_ID,
		playerProfile: { [PLAYER_ID]: { name: "Hero" } },
		party: { [PLAYER_ID]: { creatureIds: [] } },
		inventory: { [PLAYER_ID]: { items: {} } },
		money: { [PLAYER_ID]: { amount: 0 } },
		bestiary: { [PLAYER_ID]: { seen: [], caught: [] } },
		storageBoxes: { [PLAYER_ID]: { boxes: [] } },
	};
}

test("migrateWorld defaults the flags store to empty for saves without one", () => {
	let world = migrateWorld(legacyWorld());
	expect(world.flags).toEqual({});
	expect(getFlag(world, "any-flag")).toBe(false);
});

test("setFlag persists a flag the selector then reads", () => {
	let world = migrateWorld(legacyWorld());
	expect(getFlag(world, "met-professor")).toBe(false);

	setFlag(world, "met-professor");
	expect(getFlag(world, "met-professor")).toBe(true);
});

test("setFlag can clear a previously set flag", () => {
	let world = migrateWorld(legacyWorld());
	setFlag(world, "gate-open");
	expect(getFlag(world, "gate-open")).toBe(true);

	setFlag(world, "gate-open", false);
	expect(getFlag(world, "gate-open")).toBe(false);
});

test("the persistent snapshot carries story flags", () => {
	let world = migrateWorld(legacyWorld());
	setFlag(world, "caught-legendary");

	let snapshot = pickPersistentWorld(world);
	expect(snapshot.flags[PLAYER_ID]?.values["caught-legendary"]).toBe(true);
});

test("selfSwitchFlag namespaces a switch by its map and entity id", () => {
	expect(selfSwitchFlag("route-1", "npc-a", "A")).toBe("event:route-1:npc-a:A");
	expect(selfSwitchFlag("route-2", "npc-a", "A")).not.toBe(selfSwitchFlag("route-1", "npc-a", "A"));
	expect(selfSwitchFlag("route-1", "npc-b", "A")).not.toBe(selfSwitchFlag("route-1", "npc-a", "A"));
});

test("a self-switch flag reads and persists like any other flag", () => {
	let world = migrateWorld(legacyWorld());
	let flag = selfSwitchFlag("route-1", "gate", "A");
	expect(getFlag(world, flag)).toBe(false);

	setFlag(world, flag);
	expect(getFlag(world, flag)).toBe(true);

	let snapshot = pickPersistentWorld(world);
	expect(snapshot.flags[PLAYER_ID]?.values[flag]).toBe(true);
});
