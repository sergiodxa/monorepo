/**
 * Inventory system utilities for reading and mutating the inventory state attached to player entities.
 * This module centralizes the rules for adding and removing item counts so callers can interact with
 * inventory data through a small, predictable surface instead of updating world state manually.
 *
 * The functions in this module preserve the module's responsibility as a focused ECS system layer:
 * they coordinate inventory-specific state transitions, enforce basic count invariants, and return
 * values that let other systems react to successful or rejected inventory updates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ItemId } from "~/game/data/item";

import type { PlayerId } from "../world/ids";
import type { World } from "../world/world";

import { getPlayerInventory } from "../world/world";

/** Adds one or more items to the player's inventory component. */
export function addInventoryItem(world: World, playerId: PlayerId, itemId: ItemId, count = 1) {
	if (count <= 0) return getPlayerInventory(world);

	let inventory = getPlayerInventory(world);
	let nextCount = (inventory.items[itemId] ?? 0) + count;
	world.inventory[playerId] = {
		items: {
			...inventory.items,
			[itemId]: nextCount,
		},
	};

	return getPlayerInventory(world);
}

/** Removes one or more items when enough copies are available. */
export function removeInventoryItem(
	world: World,
	playerId: PlayerId,
	itemId: ItemId,
	count = 1,
): boolean {
	if (count <= 0) return true;

	let inventory = getPlayerInventory(world);
	let current = inventory.items[itemId] ?? 0;
	if (current < count) return false;

	let nextItems = { ...inventory.items };
	let nextCount = current - count;
	if (nextCount === 0) delete nextItems[itemId];
	else nextItems[itemId] = nextCount;

	world.inventory[playerId] = { items: nextItems };
	return true;
}
