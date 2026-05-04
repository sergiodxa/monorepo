import type { GameData } from "../domain/game-data";
import type { Item, ItemId } from "../domain/item";

import { ItemCategory } from "../domain/item";

/** Mutable saved stack count for one item in the bag. */
export interface InventoryStack {
	id: ItemId;
	count: number;
}

/** Grouped item count returned when listing bag contents. */
export interface InventoryEntry {
	id: ItemId;
	count: number;
}

/** Mutable bag state grouped by item identifier and validated against loaded game data. */
export class Inventory {
	private readonly itemCatalog: ReadonlyMap<ItemId, Item>;
	private readonly items = new Map<ItemId, number>();

	/**
	 * @param gameData - Loaded content used to validate item identifiers and categories
	 * @param items - Saved grouped or duplicate stacks to seed the inventory with
	 */
	constructor(gameData: GameData, items: InventoryStack[]) {
		this.itemCatalog = gameData.items;

		for (let { id, count } of items) {
			this.assertKnownItem(id);
			if (count <= 0) continue;
			this.items.set(id, (this.items.get(id) ?? 0) + count);
		}
	}

	/** Returns the current grouped count for one item identifier. */
	count(id: ItemId): number {
		return this.items.get(id) ?? 0;
	}

	/** Adds one or more copies of an item to the inventory. */
	add(id: ItemId, count = 1) {
		this.assertKnownItem(id);
		if (count <= 0) return;
		this.items.set(id, this.count(id) + count);
	}

	/** Removes one or more copies of an item when enough copies are available. */
	remove(id: ItemId, count = 1): boolean {
		if (count <= 0) return true;
		let current = this.count(id);
		if (current < count) return false;
		let next = current - count;
		if (next === 0) {
			this.items.delete(id);
			return true;
		}
		this.items.set(id, next);
		return true;
	}

	/** Returns every grouped item stack in insertion order. */
	list(): InventoryEntry[] {
		return Array.from(this.items, ([id, count]) => ({ id, count }));
	}

	/** Returns grouped item stacks that belong to one inventory category. */
	listByCategory(category: ItemCategory): InventoryEntry[] {
		return this.list().filter((entry) => this.itemCatalog.get(entry.id)?.category === category);
	}

	/** Serializes only mutable grouped inventory counts for saves. */
	toJSON() {
		return { items: this.list() };
	}

	/** Rebuilds an inventory from saved grouped counts and loaded game data. */
	static fromJSON(gameData: GameData, input: ReturnType<Inventory["toJSON"]>) {
		return new Inventory(gameData, input.items);
	}

	/** Fails fast when saved or runtime item identifiers are not present in loaded content. */
	private assertKnownItem(id: ItemId) {
		if (this.itemCatalog.has(id)) return;
		throw new ReferenceError(`Unknown item ${id}.`);
	}
}
