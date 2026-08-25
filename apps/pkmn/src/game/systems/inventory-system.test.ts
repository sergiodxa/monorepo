/**
 * Verifies the inventory system's add and remove rules: new and existing
 * stacks, non-positive-count no-ops, partial and stack-emptying removals,
 * and rejecting a removal larger than the held count.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { createPlayerId } from "../world/ids";
import { migrateWorld } from "../world/migrate";
import { getPlayerInventory, type World } from "../world/world";

import { addInventoryItem, removeInventoryItem } from "./inventory-system";

let ITEM_ID = "POTION";
let OTHER_ITEM_ID = "ELIXIR";

/** Builds a one-player world seeded with an optional starting inventory. */
function createWorld(items: Record<string, number> = {}): { world: World; playerId: string } {
	let playerId = createPlayerId("hero");
	let world = migrateWorld({
		entities: [playerId],
		playerId,
		playerProfile: { [playerId]: { name: "Hero" } },
		party: { [playerId]: { creatureIds: [] } },
		inventory: { [playerId]: { items } },
		money: { [playerId]: { amount: 0 } },
		bestiary: { [playerId]: { seen: [], caught: [] } },
		storageBoxes: { [playerId]: { boxes: [] } },
		creature: {},
	});
	return { world, playerId };
}

test("addInventoryItem creates a new stack with the default count of one", () => {
	let { world, playerId } = createWorld();
	let inventory = addInventoryItem(world, playerId, ITEM_ID);
	expect(inventory.items[ITEM_ID]).toBe(1);
	expect(getPlayerInventory(world).items[ITEM_ID]).toBe(1);
});

test("addInventoryItem sums onto an existing stack", () => {
	let { world, playerId } = createWorld({ [ITEM_ID]: 2 });
	let inventory = addInventoryItem(world, playerId, ITEM_ID, 3);
	expect(inventory.items[ITEM_ID]).toBe(5);
});

test("addInventoryItem leaves other stacks untouched", () => {
	let { world, playerId } = createWorld({ [OTHER_ITEM_ID]: 4 });
	let inventory = addInventoryItem(world, playerId, ITEM_ID, 2);
	expect(inventory.items[ITEM_ID]).toBe(2);
	expect(inventory.items[OTHER_ITEM_ID]).toBe(4);
});

test("addInventoryItem is a no-op for a zero count", () => {
	let { world, playerId } = createWorld({ [ITEM_ID]: 1 });
	let inventory = addInventoryItem(world, playerId, ITEM_ID, 0);
	expect(inventory.items[ITEM_ID]).toBe(1);
});

test("addInventoryItem is a no-op for a negative count", () => {
	let { world, playerId } = createWorld({ [ITEM_ID]: 1 });
	let inventory = addInventoryItem(world, playerId, ITEM_ID, -5);
	expect(inventory.items[ITEM_ID]).toBe(1);
});

test("removeInventoryItem returns true and reduces the stack on a partial removal", () => {
	let { world, playerId } = createWorld({ [ITEM_ID]: 5 });
	expect(removeInventoryItem(world, playerId, ITEM_ID, 2)).toBe(true);
	expect(getPlayerInventory(world).items[ITEM_ID]).toBe(3);
});

test("removeInventoryItem deletes the stack entirely when the count reaches zero", () => {
	let { world, playerId } = createWorld({ [ITEM_ID]: 3 });
	expect(removeInventoryItem(world, playerId, ITEM_ID, 3)).toBe(true);
	expect(ITEM_ID in getPlayerInventory(world).items).toBe(false);
	expect(getPlayerInventory(world).items[ITEM_ID]).toBeUndefined();
});

test("removeInventoryItem rejects removing more than is held and leaves the stack unchanged", () => {
	let { world, playerId } = createWorld({ [ITEM_ID]: 2 });
	expect(removeInventoryItem(world, playerId, ITEM_ID, 3)).toBe(false);
	expect(getPlayerInventory(world).items[ITEM_ID]).toBe(2);
});

test("removeInventoryItem rejects removing an item the player does not hold", () => {
	let { world, playerId } = createWorld();
	expect(removeInventoryItem(world, playerId, ITEM_ID, 1)).toBe(false);
	expect(getPlayerInventory(world).items[ITEM_ID]).toBeUndefined();
});

test("removeInventoryItem is a no-op success for a zero count", () => {
	let { world, playerId } = createWorld({ [ITEM_ID]: 2 });
	expect(removeInventoryItem(world, playerId, ITEM_ID, 0)).toBe(true);
	expect(getPlayerInventory(world).items[ITEM_ID]).toBe(2);
});

test("removeInventoryItem is a no-op success for a negative count", () => {
	let { world, playerId } = createWorld({ [ITEM_ID]: 2 });
	expect(removeInventoryItem(world, playerId, ITEM_ID, -3)).toBe(true);
	expect(getPlayerInventory(world).items[ITEM_ID]).toBe(2);
});

test("removeInventoryItem leaves sibling stacks intact when deleting an emptied stack", () => {
	let { world, playerId } = createWorld({ [ITEM_ID]: 1, [OTHER_ITEM_ID]: 4 });
	expect(removeInventoryItem(world, playerId, ITEM_ID, 1)).toBe(true);
	expect(getPlayerInventory(world).items[ITEM_ID]).toBeUndefined();
	expect(getPlayerInventory(world).items[OTHER_ITEM_ID]).toBe(4);
});
