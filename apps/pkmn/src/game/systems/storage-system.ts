/**
 * Coordinates storage-related world updates for creatures owned by a player.
 *
 * This module contains the system-level operations that move creatures between
 * active party slots and persistent storage boxes, ensure storage capacity
 * exists for a player, and keep location metadata synchronized with those
 * changes.
 *
 * The behavior here is intentionally scoped to storage state transitions and
 * indexing concerns within the world model. It centralizes the rules needed to
 * maintain consistent party, box, and location records whenever storage data is
 * mutated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CreatureId, PlayerId } from "../world/ids";
import type { World } from "../world/world";

import { getPlayerParty, getPlayerStorageBoxes } from "../world/world";

/** Moves one creature from the party into the target storage box. */
export function moveCreatureToStorage(
	world: World,
	playerId: PlayerId,
	creatureId: CreatureId,
	boxId: string,
) {
	let party = getPlayerParty(world);
	let storage = getPlayerStorageBoxes(world);
	let partySlot = party.creatureIds.indexOf(creatureId);
	if (partySlot < 0) return false;

	let nextBoxes = storage.boxes.map((box) =>
		box.id === boxId ? { ...box, creatureIds: [...box.creatureIds, creatureId] } : box,
	);
	let targetBox = nextBoxes.find((box) => box.id === boxId);
	if (!targetBox) return false;

	world.party[playerId] = {
		creatureIds: party.creatureIds.filter((id) => id !== creatureId),
	};
	world.storageBoxes[playerId] = { boxes: nextBoxes };
	world.creatureLocation[creatureId] = {
		kind: "storage",
		playerId,
		boxId,
		slot: targetBox.creatureIds.length - 1,
	};

	reindexPartyLocations(world, playerId);
	return true;
}

/** Moves one creature from storage into the end of the party when room exists. */
export function moveCreatureToParty(
	world: World,
	playerId: PlayerId,
	creatureId: CreatureId,
	boxId: string,
) {
	let party = getPlayerParty(world);
	if (party.creatureIds.length >= 6) return false;

	let storage = getPlayerStorageBoxes(world);
	let box = storage.boxes.find((entry) => entry.id === boxId);
	if (!box || box.creatureIds.includes(creatureId) === false) return false;

	world.party[playerId] = {
		creatureIds: [...party.creatureIds, creatureId],
	};
	world.storageBoxes[playerId] = {
		boxes: storage.boxes.map((entry) =>
			entry.id === boxId
				? { ...entry, creatureIds: entry.creatureIds.filter((id) => id !== creatureId) }
				: entry,
		),
	};

	reindexStorageLocations(world, playerId, boxId);
	reindexPartyLocations(world, playerId);
	world.creatureLocation[creatureId] = {
		kind: "party",
		playerId,
		slot: getPlayerParty(world).creatureIds.length - 1,
	};

	return true;
}

/** Ensures the player has at least one storage box available for captured creatures. */
export function ensureStorageBox(
	world: World,
	playerId: PlayerId,
	boxId = "box-1",
	name = "Box 1",
) {
	let storage = getPlayerStorageBoxes(world);
	if (storage.boxes.some((box) => box.id === boxId)) return storage;

	world.storageBoxes[playerId] = {
		boxes: [...storage.boxes, { id: boxId, name, creatureIds: [] }],
	};

	return getPlayerStorageBoxes(world);
}

/** Refreshes party slot locations after party order changes. */
function reindexPartyLocations(world: World, playerId: PlayerId) {
	let party = getPlayerParty(world);
	for (let slot = 0; slot < party.creatureIds.length; slot += 1) {
		let creatureId = party.creatureIds[slot]!;
		world.creatureLocation[creatureId] = { kind: "party", playerId, slot };
	}
}

/** Refreshes storage slot locations after box order changes. */
function reindexStorageLocations(world: World, playerId: PlayerId, boxId: string) {
	let storage = getPlayerStorageBoxes(world);
	let box = storage.boxes.find((entry) => entry.id === boxId);
	if (!box) return;

	for (let slot = 0; slot < box.creatureIds.length; slot += 1) {
		let creatureId = box.creatureIds[slot]!;
		world.creatureLocation[creatureId] = { kind: "storage", playerId, boxId, slot };
	}
}
