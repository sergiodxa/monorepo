/**
 * Verifies the shop system's money and transaction behaviors in isolation from the engine boundary.
 *
 * The tests exercise buying (success, insufficient funds, and missing buy price), selling (success, not-owned,
 * and missing sell price), and the generic money adjustment (positive, negative, and the non-negative clamp).
 * They build a tiny inline content source with priced and unpriced items so the assertions describe the
 * system's rules directly rather than depending on any specific authored catalog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { unwrap } from "@pkg/result";

import { GameData, type GameDataSource } from "../data/game-data";
import { ItemAttribute, type Item } from "../data/item";
import { createPlayerId } from "../world/ids";
import { migrateWorld } from "../world/migrate";
import { getPlayerInventory, getPlayerMoney, type World } from "../world/world";

import { buyItem, changeMoney, getMoney, sellItem } from "./shop-system";

let PRICED_ITEM_ID = "PRICED_ITEM";
let FREE_ITEM_ID = "FREE_ITEM";

/** Builds the minimal game data source needed to price shop transactions. */
function createGameData(): GameData {
	let priced: Item = {
		category: "misc",
		attributes: [ItemAttribute.Countable],
		price: { buy: 100, sell: 40 },
	};
	// An item with no `price` cannot be bought or sold.
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
