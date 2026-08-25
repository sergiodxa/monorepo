/**
 * Tests for wild-encounter rolling and species selection.
 *
 * Covers `rollEncounter` honouring the tile's rate threshold and
 * `chooseEncounter` picking from a weighted table or falling back to a
 * content species when the tile ships no table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { EncounterEntry } from "../render/tilemap";

import { chooseEncounter, rollEncounter } from "./encounters";
import { createSampleMap, GameMap } from "./map-loader";

/** Returns a `random` that yields the scripted values in order, then repeats the last. */
function scriptedRandom(...values: number[]): () => number {
	let index = 0;
	return () => {
		let value = values[Math.min(index, values.length - 1)]!;
		index++;
		return value;
	};
}

/** The sample map has an encounter zone at rate 40 covering rows 3..7, cols 9..14. */
let SAMPLE = new GameMap(createSampleMap());
let GRASS_TILE = { x: 9, y: 3 };
let PLAIN_TILE = { x: 5, y: 5 };

test("rollEncounter never triggers off a non-encounter tile", () => {
	expect(rollEncounter(SAMPLE, PLAIN_TILE.x, PLAIN_TILE.y, () => 0)).toBe(false);
});

test("rollEncounter triggers when random is below rate/255", () => {
	expect(rollEncounter(SAMPLE, GRASS_TILE.x, GRASS_TILE.y, () => 0.1)).toBe(true);
});

test("rollEncounter stays quiet when random is at or above rate/255", () => {
	expect(rollEncounter(SAMPLE, GRASS_TILE.x, GRASS_TILE.y, () => 0.2)).toBe(false);
});

let TABLE: EncounterEntry[] = [
	{ speciesId: "alpha", minLevel: 2, maxLevel: 4, weight: 1 },
	{ speciesId: "beta", minLevel: 5, maxLevel: 5, weight: 3 },
];

test("chooseEncounter picks the first table entry when the roll lands in its weight", () => {
	let choice = chooseEncounter(TABLE, [], scriptedRandom(0.1, 0));
	expect(choice).toEqual({ speciesId: "alpha", level: 2 });
});

test("chooseEncounter picks a later table entry as the roll accumulates", () => {
	let choice = chooseEncounter(TABLE, [], scriptedRandom(0.5, 0));
	expect(choice?.speciesId).toBe("beta");
	expect(choice?.level).toBe(5);
});

test("chooseEncounter keeps the rolled level inside the entry's inclusive range", () => {
	let choice = chooseEncounter(TABLE, [], scriptedRandom(0.1, 0.999));
	expect(choice?.speciesId).toBe("alpha");
	expect(choice?.level).toBeGreaterThanOrEqual(2);
	expect(choice?.level).toBeLessThanOrEqual(4);
});

test("chooseEncounter falls back to a content species when the table is empty", () => {
	let choice = chooseEncounter([], ["fallbackmon"], scriptedRandom(0, 0));
	expect(choice?.speciesId).toBe("fallbackmon");
	expect(choice?.level).toBeGreaterThanOrEqual(2);
	expect(choice?.level).toBeLessThanOrEqual(5);
});

test("chooseEncounter fallback picks by index from the species list", () => {
	let choice = chooseEncounter([], ["first", "second"], scriptedRandom(0.5, 0));
	expect(choice?.speciesId).toBe("second");
});

test("chooseEncounter returns null when there is no table and no fallback", () => {
	expect(chooseEncounter([], [], scriptedRandom(0))).toBeNull();
});
