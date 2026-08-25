/**
 * Pure derivation of a shop's buy and sell listings.
 *
 * The shop sells items with a finite buy price and buys back stock with a
 * positive sell price. Both derivations are pure functions of content and
 * inventory, so the rules are unit-testable without a live engine.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Item } from "~/game/data/item";

/** One row in the shop's buy list. */
export interface BuyEntry {
	/** The item's content id, doubling as its display name. */
	id: string;
	/** The price to buy one unit. */
	price: number;
}

/** One row in the shop's sell list, tied to the player's stock. */
export interface SellEntry {
	/** The item's content id, doubling as its display name. */
	id: string;
	/** The price paid for one unit. */
	price: number;
	/** How many the player currently holds. */
	count: number;
}

/** An inventory entry as returned by the inventory selector. */
interface InventoryEntry {
	id: string;
	count: number;
}

/**
 * Returns the items a shop will sell, sorted by id. Only a finite, positive
 * `price.buy` qualifies; `Infinity` (the priceless capture ball) or a missing
 * price marks an item as not for sale.
 */
export function buyableItems(items: Record<string, Item>): BuyEntry[] {
	let entries: BuyEntry[] = [];
	for (let [id, item] of Object.entries(items)) {
		let price = item.price?.buy;
		if (price === undefined || !Number.isFinite(price) || price <= 0) continue;
		entries.push({ id, price });
	}
	return entries.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Returns the player's stock the shop buys back, sorted by id. An entry
 * qualifies only when the player holds at least one and the item carries a
 * positive sell price; unknown and zero-value items are skipped.
 */
export function sellableItems(
	inventory: readonly InventoryEntry[],
	items: Record<string, Item>,
): SellEntry[] {
	let entries: SellEntry[] = [];
	for (let entry of inventory) {
		if (entry.count <= 0) continue;
		let price = items[entry.id]?.price?.sell;
		if (price === undefined || !Number.isFinite(price) || price <= 0) continue;
		entries.push({ id: entry.id, price, count: entry.count });
	}
	return entries.sort((a, b) => a.id.localeCompare(b.id));
}
