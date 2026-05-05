/**
 * Coordinates the capture flow for encounter creatures within the game world.
 *
 * This module converts a creature from an encounter-owned state into a player-owned state and records its resulting placement. It updates ownership, assigns the creature to the active party when capacity is available, and falls back to persistent storage when the party is full.
 *
 * By keeping these transitions together, the module centralizes the rules for where newly captured creatures are placed and how their world location is tracked after capture. This helps the rest of the game rely on a single, consistent entry point for capture-related state changes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CreatureId, PlayerId } from "../world/ids";
import type { World } from "../world/world";

import { getPlayerParty, getPlayerStorageBoxes } from "../world/world";

import { ensureStorageBox } from "./storage-system";

/** Converts one encounter creature into an owned creature and places it in party or storage. */
export function captureCreature(world: World, playerId: PlayerId, creatureId: CreatureId) {
	let party = getPlayerParty(world);
	world.ownership[creatureId] = { ownerId: playerId };

	if (party.creatureIds.length < 6) {
		world.party[playerId] = { creatureIds: [...party.creatureIds, creatureId] };
		world.creatureLocation[creatureId] = {
			kind: "party",
			playerId,
			slot: party.creatureIds.length,
		};
		return { placement: "party" as const };
	}

	ensureStorageBox(world, playerId);
	let storage = getPlayerStorageBoxes(world);
	let box = storage.boxes[0]!;
	world.storageBoxes[playerId] = {
		boxes: storage.boxes.map((entry, index) =>
			index === 0 ? { ...entry, creatureIds: [...entry.creatureIds, creatureId] } : entry,
		),
	};
	world.creatureLocation[creatureId] = {
		kind: "storage",
		playerId,
		boxId: box.id,
		slot: box.creatureIds.length,
	};

	return { placement: "storage" as const, boxId: box.id };
}
