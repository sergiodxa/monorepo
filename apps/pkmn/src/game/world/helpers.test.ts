/**
 * Verifies world helper behavior across persistence-oriented transformations:
 * snapshots and migration keep the structural contract of long-lived state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { pickPersistentWorld } from "./helpers";
import { createCreatureId, createPlayerId } from "./ids";
import { migrateWorld } from "./migrate";

let TEST_SPECIES_ID = "SPECIES_ALPHA";
let TEST_NATURE_ID = "NATURE_ALPHA";
let TEST_MOVE_ID = "MOVE_ALPHA";

test("migrateWorld splits legacy creature blobs into component stores", () => {
	let playerId = createPlayerId("hero");
	let creatureId = createCreatureId("starter-1");
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
				species: TEST_SPECIES_ID,
				nature: TEST_NATURE_ID,
				experience: 0,
				moveset: [TEST_MOVE_ID, null, null, null],
				status: { state: null, damage: 0, pp: [35, 0, 0, 0] },
				iv: {
					hp: 31,
					attack: 31,
					defense: 31,
					"special-attack": 31,
					"special-defense": 31,
					speed: 31,
				},
				ev: {
					hp: 0,
					attack: 0,
					defense: 0,
					"special-attack": 0,
					"special-defense": 0,
					speed: 0,
				},
			},
		},
	});

	expect(world.creatureIdentity[creatureId]?.speciesId).toBe(TEST_SPECIES_ID);
	expect(world.creatureProgress[creatureId]?.natureId).toBe(TEST_NATURE_ID);
	expect(world.creatureLocation[creatureId]).toEqual({ kind: "party", playerId, slot: 0 });
});

test("pickPersistentWorld omits transient battle stores", () => {
	let playerId = createPlayerId("hero");
	let world = migrateWorld({
		entities: [playerId],
		playerId,
		playerProfile: { [playerId]: { name: "Hero" } },
		party: { [playerId]: { creatureIds: [] } },
		inventory: { [playerId]: { items: {} } },
		bestiary: { [playerId]: { seen: [], caught: [] } },
		storageBoxes: { [playerId]: { boxes: [] } },
		creature: {},
	});
	world.activeBattle[playerId] = { battleId: "battle:demo" };

	let snapshot = pickPersistentWorld(world);
	expect("activeBattle" in snapshot).toBe(false);
	expect(snapshot.playerProfile[playerId]?.name).toBe("Hero");
});

test("pickPersistentWorld excludes encounter and trainer creatures from the save", () => {
	let playerId = createPlayerId("hero");
	let ownedId = createCreatureId("owned-1");
	let wildId = createCreatureId("wild-1");
	let trainerId = createCreatureId("trainer-1");
	let world = migrateWorld({
		entities: [playerId],
		playerId,
		playerProfile: { [playerId]: { name: "Hero" } },
		party: { [playerId]: { creatureIds: [] } },
		inventory: { [playerId]: { items: {} } },
		bestiary: { [playerId]: { seen: [], caught: [] } },
		storageBoxes: { [playerId]: { boxes: [] } },
		creature: {},
	});

	let identity = { speciesId: TEST_SPECIES_ID };
	for (let id of [ownedId, wildId, trainerId]) {
		world.entities.push(id);
		world.creatureIdentity[id] = { ...identity };
	}
	world.creatureLocation[ownedId] = { kind: "party", playerId, slot: 0 };
	world.creatureLocation[wildId] = { kind: "encounter", encounterId: "e1" };
	world.creatureLocation[trainerId] = { kind: "trainer", trainerId: "rival-0" };

	let snapshot = pickPersistentWorld(world);
	expect(snapshot.entities.includes(ownedId)).toBe(true);
	expect(snapshot.entities.includes(wildId)).toBe(false);
	expect(snapshot.entities.includes(trainerId)).toBe(false);
	expect(trainerId in snapshot.creatureIdentity).toBe(false);
	expect(trainerId in snapshot.creatureLocation).toBe(false);
});
