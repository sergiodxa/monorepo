/**
 * Tests for the shop's buy/sell list derivation.
 *
 * Covers which content items a shop will sell (finite, positive buy price only)
 * and which inventory entries it will buy back (held stock whose item has a
 * positive sell price), including the priceless-item and unknown-item edge
 * cases that must be excluded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import type { Item } from "~/game/data/item";

import { ItemAttribute } from "~/game/data/item";

import { buyableItems, sellableItems } from "./shop-list";

/** Builds a minimal misc item with an optional price for the tests. */
function item(price?: { buy: number; sell: number }): Item {
	return { category: "misc", attributes: [ItemAttribute.Countable], price };
}

let items: Record<string, Item> = {
	POTION: item({ buy: 200, sell: 100 }),
	POKEBALL: item({ buy: 100, sell: 50 }),
	MASTERBALL: item({ buy: Number.POSITIVE_INFINITY, sell: 0 }),
	FREEBIE: item(),
};

test("buyableItems keeps only items with a finite positive buy price, sorted by id", () => {
	let entries = buyableItems(items);
	expect(entries.map((entry) => entry.id)).toEqual(["POKEBALL", "POTION"]);
	expect(entries.find((entry) => entry.id === "POTION")?.price).toBe(200);
});

test("buyableItems excludes priceless (Infinity) and priceless-missing items", () => {
	let ids = buyableItems(items).map((entry) => entry.id);
	expect(ids).not.toContain("MASTERBALL");
	expect(ids).not.toContain("FREEBIE");
});

test("sellableItems keeps held stock whose item has a positive sell price", () => {
	let inventory = [
		{ id: "POTION", count: 3 },
		{ id: "MASTERBALL", count: 1 },
	];
	let entries = sellableItems(inventory, items);
	expect(entries).toEqual([{ id: "POTION", price: 100, count: 3 }]);
});

test("sellableItems excludes zero-count entries and unknown items", () => {
	let inventory = [
		{ id: "POTION", count: 0 },
		{ id: "UNKNOWN", count: 5 },
	];
	expect(sellableItems(inventory, items)).toEqual([]);
});
