/**
 * Verifies the storage system keeps party, storage boxes, and creature locations in sync.
 *
 * The tests cover ensuring a box exists (creating one, being idempotent, and honoring custom ids),
 * moving a creature from the party into a box, moving one back into the party, and the full-party and
 * missing-creature guard rails. They assert that slot indices reindex after a move so the location
 * components always mirror the ordered membership.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import type { LegacyCreatureComponent } from "../world/components";
import type { StorageBoxesComponent } from "../world/world";

import { createCreatureId, createPlayerId } from "../world/ids";
import { migrateWorld } from "../world/migrate";
import { getPlayerParty, getPlayerStorageBoxes, type World } from "../world/world";

import { ensureStorageBox, moveCreatureToParty, moveCreatureToStorage } from "./storage-system";

/** Builds a minimal legacy creature blob; storage never inspects its content. */
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

/** Builds a one-player world with the given party members and storage boxes. */
function createWorld(
	partyIds: string[] = [],
	boxes: StorageBoxesComponent["boxes"] = [],
): { world: World; playerId: string } {
	let playerId = createPlayerId("hero");
	let creature: Record<string, LegacyCreatureComponent> = {};
	let entities = [playerId];
	for (let id of partyIds) {
		creature[id] = createCreature();
		entities.push(id);
	}
	for (let box of boxes) {
		for (let id of box.creatureIds) {
			creature[id] = createCreature();
			entities.push(id);
		}
	}
	let world = migrateWorld({
		entities,
		playerId,
		playerProfile: { [playerId]: { name: "Hero" } },
		party: { [playerId]: { creatureIds: partyIds } },
		inventory: { [playerId]: { items: {} } },
		money: { [playerId]: { amount: 0 } },
		bestiary: { [playerId]: { seen: [], caught: [] } },
		storageBoxes: { [playerId]: { boxes } },
		creature,
	});
	return { world, playerId };
}

test("ensureStorageBox creates a default box when none exist", () => {
	let { world, playerId } = createWorld();
	let storage = ensureStorageBox(world, playerId);
	expect(storage.boxes).toEqual([{ id: "box-1", name: "Box 1", creatureIds: [] }]);
});

test("ensureStorageBox honors a custom id and name", () => {
	let { world, playerId } = createWorld();
	let storage = ensureStorageBox(world, playerId, "vault", "Vault");
	expect(storage.boxes).toEqual([{ id: "vault", name: "Vault", creatureIds: [] }]);
});

test("ensureStorageBox is idempotent for an existing box id", () => {
	let { world, playerId } = createWorld([], [{ id: "box-1", name: "Box 1", creatureIds: [] }]);
	let storage = ensureStorageBox(world, playerId);
	expect(storage.boxes).toHaveLength(1);
});

test("moveCreatureToStorage moves the party member into the box and tracks its location", () => {
	let one = createCreatureId("one");
	let { world, playerId } = createWorld([one], [{ id: "box-1", name: "Box 1", creatureIds: [] }]);

	expect(moveCreatureToStorage(world, playerId, one, "box-1")).toBe(true);

	expect(getPlayerParty(world).creatureIds).toEqual([]);
	expect(getPlayerStorageBoxes(world).boxes[0]?.creatureIds).toEqual([one]);
	expect(world.creatureLocation[one]).toEqual({
		kind: "storage",
		playerId,
		boxId: "box-1",
		slot: 0,
	});
});

test("moveCreatureToStorage reindexes the remaining party slots", () => {
	let one = createCreatureId("one");
	let two = createCreatureId("two");
	let three = createCreatureId("three");
	let { world, playerId } = createWorld(
		[one, two, three],
		[{ id: "box-1", name: "Box 1", creatureIds: [] }],
	);

	expect(moveCreatureToStorage(world, playerId, two, "box-1")).toBe(true);

	expect(getPlayerParty(world).creatureIds).toEqual([one, three]);
	expect(world.creatureLocation[one]).toEqual({ kind: "party", playerId, slot: 0 });
	expect(world.creatureLocation[three]).toEqual({ kind: "party", playerId, slot: 1 });
});

test("moveCreatureToStorage returns false when the creature is not in the party", () => {
	let one = createCreatureId("one");
	let ghost = createCreatureId("ghost");
	let { world, playerId } = createWorld([one], [{ id: "box-1", name: "Box 1", creatureIds: [] }]);

	expect(moveCreatureToStorage(world, playerId, ghost, "box-1")).toBe(false);
	expect(getPlayerParty(world).creatureIds).toEqual([one]);
});

test("moveCreatureToStorage returns false when the target box does not exist", () => {
	let one = createCreatureId("one");
	let { world, playerId } = createWorld([one]);

	expect(moveCreatureToStorage(world, playerId, one, "missing")).toBe(false);
	expect(getPlayerParty(world).creatureIds).toEqual([one]);
});

test("moveCreatureToStorage appends to a box that already holds a creature", () => {
	let stored = createCreatureId("stored");
	let mover = createCreatureId("mover");
	let { world, playerId } = createWorld(
		[mover],
		[{ id: "box-1", name: "Box 1", creatureIds: [stored] }],
	);

	expect(moveCreatureToStorage(world, playerId, mover, "box-1")).toBe(true);
	expect(getPlayerStorageBoxes(world).boxes[0]?.creatureIds).toEqual([stored, mover]);
	expect(world.creatureLocation[mover]).toEqual({
		kind: "storage",
		playerId,
		boxId: "box-1",
		slot: 1,
	});
});

test("moveCreatureToParty moves a stored creature to the end of the party", () => {
	let stored = createCreatureId("stored");
	let { world, playerId } = createWorld(
		[],
		[{ id: "box-1", name: "Box 1", creatureIds: [stored] }],
	);

	expect(moveCreatureToParty(world, playerId, stored, "box-1")).toBe(true);

	expect(getPlayerParty(world).creatureIds).toEqual([stored]);
	expect(getPlayerStorageBoxes(world).boxes[0]?.creatureIds).toEqual([]);
	expect(world.creatureLocation[stored]).toEqual({ kind: "party", playerId, slot: 0 });
});

test("moveCreatureToParty reindexes the storage slots left behind", () => {
	let a = createCreatureId("a");
	let b = createCreatureId("b");
	let c = createCreatureId("c");
	let { world, playerId } = createWorld(
		[],
		[{ id: "box-1", name: "Box 1", creatureIds: [a, b, c] }],
	);

	expect(moveCreatureToParty(world, playerId, b, "box-1")).toBe(true);

	expect(getPlayerStorageBoxes(world).boxes[0]?.creatureIds).toEqual([a, c]);
	expect(world.creatureLocation[a]).toEqual({ kind: "storage", playerId, boxId: "box-1", slot: 0 });
	expect(world.creatureLocation[c]).toEqual({ kind: "storage", playerId, boxId: "box-1", slot: 1 });
	expect(world.creatureLocation[b]).toEqual({ kind: "party", playerId, slot: 0 });
});

test("moveCreatureToParty places the mover after existing party members", () => {
	let existing = createCreatureId("existing");
	let stored = createCreatureId("stored");
	let { world, playerId } = createWorld(
		[existing],
		[{ id: "box-1", name: "Box 1", creatureIds: [stored] }],
	);

	expect(moveCreatureToParty(world, playerId, stored, "box-1")).toBe(true);
	expect(getPlayerParty(world).creatureIds).toEqual([existing, stored]);
	expect(world.creatureLocation[stored]).toEqual({ kind: "party", playerId, slot: 1 });
});

test("moveCreatureToParty returns false when the party is already full", () => {
	let full = ["c0", "c1", "c2", "c3", "c4", "c5"].map((key) => createCreatureId(key));
	let stored = createCreatureId("stored");
	let { world, playerId } = createWorld(full, [
		{ id: "box-1", name: "Box 1", creatureIds: [stored] },
	]);

	expect(moveCreatureToParty(world, playerId, stored, "box-1")).toBe(false);
	expect(getPlayerParty(world).creatureIds).toEqual(full);
	expect(getPlayerStorageBoxes(world).boxes[0]?.creatureIds).toEqual([stored]);
});

test("moveCreatureToParty returns false when the box does not exist", () => {
	let stored = createCreatureId("stored");
	let { world, playerId } = createWorld(
		[],
		[{ id: "box-1", name: "Box 1", creatureIds: [stored] }],
	);

	expect(moveCreatureToParty(world, playerId, stored, "missing")).toBe(false);
	expect(getPlayerStorageBoxes(world).boxes[0]?.creatureIds).toEqual([stored]);
});

test("moveCreatureToParty returns false when the box does not hold the creature", () => {
	let stored = createCreatureId("stored");
	let other = createCreatureId("other");
	let { world, playerId } = createWorld(
		[],
		[{ id: "box-1", name: "Box 1", creatureIds: [stored] }],
	);

	expect(moveCreatureToParty(world, playerId, other, "box-1")).toBe(false);
	expect(getPlayerStorageBoxes(world).boxes[0]?.creatureIds).toEqual([stored]);
});

test("a party-to-box round trip preserves the creature and its location", () => {
	let one = createCreatureId("one");
	let { world, playerId } = createWorld([one], [{ id: "box-1", name: "Box 1", creatureIds: [] }]);

	expect(moveCreatureToStorage(world, playerId, one, "box-1")).toBe(true);
	expect(moveCreatureToParty(world, playerId, one, "box-1")).toBe(true);

	expect(getPlayerParty(world).creatureIds).toEqual([one]);
	expect(getPlayerStorageBoxes(world).boxes[0]?.creatureIds).toEqual([]);
	expect(world.creatureLocation[one]).toEqual({ kind: "party", playerId, slot: 0 });
});
