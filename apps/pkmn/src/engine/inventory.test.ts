import { expect, test } from "bun:test";

import { unwrap } from "@pkg/result";

import { ITEMS } from "../content/items";
import { TYPE_MATCHUPS } from "../content/matchups";
import { MOVES } from "../content/moves";
import { NATURES } from "../content/natures";
import { SPECIES } from "../content/species";
import { GameData } from "../domain/game-data";
import { ItemCategory } from "../domain/item";

import { Inventory } from "./inventory";

let GAME_DATA = unwrap(
	GameData.create({
		species: SPECIES,
		moves: MOVES,
		items: ITEMS,
		natures: NATURES,
		typeChart: TYPE_MATCHUPS,
	}),
);

test("Inventory groups duplicate entries and lists items by category", () => {
	let inventory = new Inventory(GAME_DATA, [
		{ id: "POTION", count: 1 },
		{ id: "POTION", count: 2 },
		{ id: "POKEBALL", count: 3 },
	]);

	expect(inventory.count("POTION")).toBe(3);
	expect(inventory.listByCategory(ItemCategory.Medicine)).toEqual([{ id: "POTION", count: 3 }]);
	expect(inventory.listByCategory(ItemCategory.StandardBalls)).toEqual([
		{ id: "POKEBALL", count: 3 },
	]);
});

test("Inventory add merges counts and list returns grouped entries", () => {
	let inventory = new Inventory(GAME_DATA, [{ id: "POTION", count: 1 }]);

	inventory.add("POTION", 2);
	inventory.add("SUPERPOTION", 1);

	expect(inventory.list()).toEqual([
		{ id: "POTION", count: 3 },
		{ id: "SUPERPOTION", count: 1 },
	]);
});

test("Inventory remove subtracts counts and deletes empty stacks", () => {
	let inventory = new Inventory(GAME_DATA, [
		{ id: "POTION", count: 3 },
		{ id: "POKEBALL", count: 1 },
	]);

	expect(inventory.remove("POTION", 2)).toBe(true);
	expect(inventory.count("POTION")).toBe(1);
	expect(inventory.remove("POKEBALL", 1)).toBe(true);
	expect(inventory.count("POKEBALL")).toBe(0);
	expect(inventory.list()).toEqual([{ id: "POTION", count: 1 }]);
});

test("Inventory remove returns false and leaves state unchanged when count is unavailable", () => {
	let inventory = new Inventory(GAME_DATA, [{ id: "POTION", count: 1 }]);

	expect(inventory.remove("POTION", 2)).toBe(false);
	expect(inventory.remove("SUPERPOTION", 1)).toBe(false);
	expect(inventory.list()).toEqual([{ id: "POTION", count: 1 }]);
});

test("Inventory rejects unknown items from construction and add", () => {
	expect(() => new Inventory(GAME_DATA, [{ id: "MISSING_ITEM", count: 1 }])).toThrow(
		"Unknown item MISSING_ITEM.",
	);

	let inventory = new Inventory(GAME_DATA, []);
	expect(() => inventory.add("MISSING_ITEM", 1)).toThrow("Unknown item MISSING_ITEM.");
});

test("Inventory toJSON and fromJSON preserve grouped stacks", () => {
	let inventory = new Inventory(GAME_DATA, [
		{ id: "POTION", count: 2 },
		{ id: "POKEBALL", count: 5 },
	]);
	let json = inventory.toJSON();
	let restored = Inventory.fromJSON(GAME_DATA, json);

	expect(restored.list()).toEqual([
		{ id: "POTION", count: 2 },
		{ id: "POKEBALL", count: 5 },
	]);
	expect(restored.listByCategory(ItemCategory.StandardBalls)).toEqual([
		{ id: "POKEBALL", count: 5 },
	]);
});
