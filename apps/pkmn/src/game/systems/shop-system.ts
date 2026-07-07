/**
 * Shop system utilities for reading and mutating the money balance attached to player entities and for
 * exchanging that balance for inventory items. This module centralizes the rules for buying, selling, and
 * adjusting currency so callers interact with money through a small, predictable surface instead of updating
 * world state manually.
 *
 * The functions here keep the module's responsibility as a focused ECS system layer: they coordinate
 * money-specific state transitions, enforce a non-negative balance invariant, and lean on the inventory
 * system for the item side of a transaction so purchases and sales stay consistent with the rest of the
 * engine. Pricing is read from authored item data, keeping the engine agnostic to any specific content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameData } from "../data/game-data";
import type { ItemId } from "../data/item";
import type { PlayerId } from "../world/ids";
import type { World } from "../world/world";

import { getPlayerMoney } from "../world/world";

import { addInventoryItem, removeInventoryItem } from "./inventory-system";

/** Outcome of a buy or sell transaction, reporting success and the resulting balance. */
export interface TransactionResult {
	/** Whether the transaction was applied; false leaves the world unchanged. */
	ok: boolean;
	/** The player's money balance after the transaction (or the unchanged balance on failure). */
	balance: number;
}

/** Upper bound on how many copies of one item a single purchase may request. */
export const MAX_PURCHASE_COUNT = 999;

/** Returns one player's current money balance, defaulting to zero when absent. */
export function getMoney(world: World, playerId: PlayerId): number {
	return getPlayerMoney(world, playerId);
}

/**
 * The most copies of a `price`-each item a `money` balance can afford at once.
 *
 * Returns `min(MAX_PURCHASE_COUNT, floor(money / price))`, so it is `0` when the
 * balance cannot cover a single copy and caps at `MAX_PURCHASE_COUNT` however
 * large the balance grows. A non-positive price yields `0`, since such an item
 * has no meaningful per-unit cost to divide by.
 */
export function maxAffordable(money: number, price: number): number {
	if (price <= 0) return 0;
	return Math.min(MAX_PURCHASE_COUNT, Math.floor(money / price));
}

/**
 * Adjusts one player's money by a signed delta and returns the new balance.
 *
 * The balance is clamped to a non-negative value so penalties can never push a player into debt.
 */
export function changeMoney(world: World, playerId: PlayerId, delta: number): number {
	let next = Math.max(0, getPlayerMoney(world, playerId) + delta);
	world.money[playerId] = { amount: next };
	return next;
}

/**
 * Buys `count` copies of one item, deducting `buy * count` from the player's money.
 *
 * Fails without touching the world when the item has no buy price or the player cannot afford the total.
 */
export function buyItem(
	gameData: GameData,
	world: World,
	playerId: PlayerId,
	itemId: ItemId,
	count: number,
): TransactionResult {
	let balance = getPlayerMoney(world, playerId);
	if (count <= 0) return { ok: false, balance };

	let item = gameData.items.get(itemId);
	let buyPrice = item?.price?.buy;
	if (buyPrice === undefined) return { ok: false, balance };

	let total = buyPrice * count;
	if (total > balance) return { ok: false, balance };

	addInventoryItem(world, playerId, itemId, count);
	return { ok: true, balance: changeMoney(world, playerId, -total) };
}

/**
 * Sells `count` copies of one item, crediting `sell * count` to the player's money.
 *
 * Fails without touching the world when the item has no sell price or the player lacks enough copies.
 */
export function sellItem(
	gameData: GameData,
	world: World,
	playerId: PlayerId,
	itemId: ItemId,
	count: number,
): TransactionResult {
	let balance = getPlayerMoney(world, playerId);
	if (count <= 0) return { ok: false, balance };

	let item = gameData.items.get(itemId);
	let sellPrice = item?.price?.sell;
	if (sellPrice === undefined) return { ok: false, balance };

	if (!removeInventoryItem(world, playerId, itemId, count)) return { ok: false, balance };

	let total = sellPrice * count;
	return { ok: true, balance: changeMoney(world, playerId, total) };
}
