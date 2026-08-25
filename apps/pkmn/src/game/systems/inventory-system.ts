/**
 * Centralizes item-count mutations for the inventory attached to player
 * entities, so callers interact through a small, predictable surface
 * instead of updating world state manually.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ItemId } from "~/game/data/item";

import type { PlayerId } from "../world/ids";
import type { World } from "../world/world";

import { getPlayerInventory } from "../world/world";

/**
 * Adds a positive count to an item's stack; a non-positive count leaves
 * the inventory unchanged.
 */
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

/**
 * Removes a positive count when enough copies are held, returning false
 * otherwise; a non-positive count is a no-op that returns true.
 */
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
