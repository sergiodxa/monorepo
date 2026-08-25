import { unwrap } from "@pkg/result";
/**
 * Verifies the shop system's money and transaction behaviors: buying,
 * selling, and the generic money adjustment, using a tiny inline content
 * source so the assertions describe the system's rules directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { GameData, type GameDataSource } from "../data/game-data";
import { ItemAttribute, type Item } from "../data/item";
import { createPlayerId } from "../world/ids";
import { migrateWorld } from "../world/migrate";
import { getPlayerInventory, getPlayerMoney, type World } from "../world/world";

import {
	buyItem,
	changeMoney,
	getMoney,
	MAX_PURCHASE_COUNT,
	maxAffordable,
	sellItem,
} from "./shop-system";

let PRICED_ITEM_ID = "PRICED_ITEM";
let FREE_ITEM_ID = "FREE_ITEM";

/**
 * Builds the minimal game data source needed to price shop transactions;
 * the unpriced item exercises paths where a missing price blocks the trade.
 */
function createGameData(): GameData {
	let priced: Item = {
		category: "misc",
		attributes: [ItemAttribute.Countable],
		price: { buy: 100, sell: 40 },
	};
	let free: Item = {
		category: "misc",
		attributes: [ItemAttribute.Countable],
	};

	let source: GameDataSource = {
		species: {},
		moves: {},
		items: { [PRICED_ITEM_ID]: priced, [FREE_ITEM_ID]: free },
		natures: {},
		typeChart: {},
	};

	return unwrap(GameData.create(source));
}

/** Builds a one-player world with an optional starting balance and inventory. */
function createWorld(
	amount: number,
	items: Record<string, number> = {},
): { world: World; playerId: string } {
	let playerId = createPlayerId("hero");
	let world = migrateWorld({
		entities: [playerId],
		playerId,
		playerProfile: { [playerId]: { name: "Hero" } },
		party: { [playerId]: { creatureIds: [] } },
		inventory: { [playerId]: { items } },
		money: { [playerId]: { amount } },
		bestiary: { [playerId]: { seen: [], caught: [] } },
		storageBoxes: { [playerId]: { boxes: [] } },
		creature: {},
	});
	return { world, playerId };
}

test("maxAffordable divides money by price and floors the result", () => {
	expect(maxAffordable(1000, 100)).toBe(10);
	expect(maxAffordable(950, 100)).toBe(9);
	expect(maxAffordable(199, 100)).toBe(1);
});

test("maxAffordable returns zero when the balance cannot cover one unit", () => {
	expect(maxAffordable(99, 100)).toBe(0);
	expect(maxAffordable(0, 100)).toBe(0);
});

test("maxAffordable caps at MAX_PURCHASE_COUNT for a huge balance", () => {
	expect(maxAffordable(10_000_000, 1)).toBe(MAX_PURCHASE_COUNT);
	expect(MAX_PURCHASE_COUNT).toBe(999);
});

test("maxAffordable hits exact multiples on the boundary", () => {
	expect(maxAffordable(500, 100)).toBe(5);
	expect(maxAffordable(999, 1)).toBe(999);
	expect(maxAffordable(1000, 1)).toBe(999);
});

test("maxAffordable returns zero for a non-positive price", () => {
	expect(maxAffordable(1000, 0)).toBe(0);
	expect(maxAffordable(1000, -5)).toBe(0);
});

test("getMoney defaults to zero when the player has no money component", () => {
	let { world, playerId } = createWorld(0);
	delete world.money[playerId];
	expect(getMoney(world, playerId)).toBe(0);
});

test("changeMoney adds a positive delta", () => {
	let { world, playerId } = createWorld(100);
	expect(changeMoney(world, playerId, 50)).toBe(150);
	expect(getPlayerMoney(world, playerId)).toBe(150);
});

test("changeMoney subtracts a negative delta", () => {
	let { world, playerId } = createWorld(100);
	expect(changeMoney(world, playerId, -30)).toBe(70);
	expect(getPlayerMoney(world, playerId)).toBe(70);
});

test("changeMoney clamps the balance at zero", () => {
	let { world, playerId } = createWorld(50);
	expect(changeMoney(world, playerId, -200)).toBe(0);
	expect(getPlayerMoney(world, playerId)).toBe(0);
});

test("buyItem deducts money and adds the items on success", () => {
	let gameData = createGameData();
	let { world, playerId } = createWorld(500);

	let result = buyItem(gameData, world, playerId, PRICED_ITEM_ID, 3);

	expect(result).toEqual({ ok: true, balance: 200 });
	expect(getPlayerInventory(world).items[PRICED_ITEM_ID]).toBe(3);
});

test("buyItem fails and leaves the world unchanged with insufficient funds", () => {
	let gameData = createGameData();
	let { world, playerId } = createWorld(150);

	let result = buyItem(gameData, world, playerId, PRICED_ITEM_ID, 2);

	expect(result).toEqual({ ok: false, balance: 150 });
	expect(getPlayerInventory(world).items[PRICED_ITEM_ID]).toBeUndefined();
	expect(getPlayerMoney(world, playerId)).toBe(150);
});

test("buyItem fails when the item has no buy price", () => {
	let gameData = createGameData();
	let { world, playerId } = createWorld(500);

	let result = buyItem(gameData, world, playerId, FREE_ITEM_ID, 1);

	expect(result).toEqual({ ok: false, balance: 500 });
	expect(getPlayerInventory(world).items[FREE_ITEM_ID]).toBeUndefined();
	expect(getPlayerMoney(world, playerId)).toBe(500);
});

test("sellItem removes the items and credits money on success", () => {
	let gameData = createGameData();
	let { world, playerId } = createWorld(0, { [PRICED_ITEM_ID]: 5 });

	let result = sellItem(gameData, world, playerId, PRICED_ITEM_ID, 2);

	expect(result).toEqual({ ok: true, balance: 80 });
	expect(getPlayerInventory(world).items[PRICED_ITEM_ID]).toBe(3);
});

test("sellItem fails when the player does not own enough copies", () => {
	let gameData = createGameData();
	let { world, playerId } = createWorld(0, { [PRICED_ITEM_ID]: 1 });

	let result = sellItem(gameData, world, playerId, PRICED_ITEM_ID, 2);

	expect(result).toEqual({ ok: false, balance: 0 });
	expect(getPlayerInventory(world).items[PRICED_ITEM_ID]).toBe(1);
	expect(getPlayerMoney(world, playerId)).toBe(0);
});

test("sellItem fails when the item has no sell price", () => {
	let gameData = createGameData();
	let { world, playerId } = createWorld(0, { [FREE_ITEM_ID]: 3 });

	let result = sellItem(gameData, world, playerId, FREE_ITEM_ID, 1);

	expect(result).toEqual({ ok: false, balance: 0 });
	expect(getPlayerInventory(world).items[FREE_ITEM_ID]).toBe(3);
});
