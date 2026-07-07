/**
 * Tests for the map wrapper and the built-in sample map.
 *
 * Covers `createSampleMap`'s shape (walled 20x15 field with a grass patch and a
 * pond) and the `GameMap` queries movement and encounters depend on: `inBounds`,
 * `isBlocked` for solid/water/out-of-bounds, `isEncounter`, `encounterRate`,
 * `encounterTableAt`, and `warpAt`. Also covers the pure `habitatZones` lookup
 * that scans maps' encounter tables to list the zones where a species appears.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { TILE_SIZE } from "../core/loop";
import { Collision, type EncounterEntry, type TileMap } from "../render/tilemap";

import { createSampleMap, createSampleNpcs, GameMap, habitatZones } from "./map-loader";

test("createSampleMap returns a 20x15 route with a walled border", () => {
	let map = createSampleMap();
	expect(map.width).toBe(20);
	expect(map.height).toBe(15);
	// Every border cell is solid.
	expect(map.collision[0]).toBe(Collision.Solid); // top-left corner
	expect(map.collision[map.width - 1]).toBe(Collision.Solid); // top-right corner
	expect(map.collision[(map.height - 1) * map.width]).toBe(Collision.Solid); // bottom-left
});

test("createSampleMap carves a walkable interior and a single encounter zone", () => {
	let map = createSampleMap();
	// The spawn tile (5,5) is interior and walkable.
	expect(map.collision[5 * map.width + 5]).toBe(Collision.Walkable);
	expect(map.encounters).toHaveLength(1);
	expect(map.encounters[0]!.rate).toBe(40);
});

let SAMPLE = new GameMap(createSampleMap());

test("widthPx and heightPx scale the tile grid by the tile size", () => {
	expect(SAMPLE.widthPx).toBe(20 * TILE_SIZE);
	expect(SAMPLE.heightPx).toBe(15 * TILE_SIZE);
});

test("inBounds accepts interior tiles and rejects tiles outside the grid", () => {
	expect(SAMPLE.inBounds(5, 5)).toBe(true);
	expect(SAMPLE.inBounds(0, 0)).toBe(true);
	expect(SAMPLE.inBounds(-1, 5)).toBe(false);
	expect(SAMPLE.inBounds(5, -1)).toBe(false);
	expect(SAMPLE.inBounds(20, 5)).toBe(false);
	expect(SAMPLE.inBounds(5, 15)).toBe(false);
});

test("isBlocked blocks solid, water, and out-of-bounds tiles but allows plain ground", () => {
	expect(SAMPLE.isBlocked(0, 0)).toBe(true); // solid border
	expect(SAMPLE.isBlocked(4, 10)).toBe(true); // inside the pond (water)
	expect(SAMPLE.isBlocked(-1, 5)).toBe(true); // out of bounds
	expect(SAMPLE.isBlocked(5, 5)).toBe(false); // walkable spawn
});

test("isEncounter is true only for tiles in the grass zone", () => {
	expect(SAMPLE.isEncounter(9, 3)).toBe(true); // inside the zone
	expect(SAMPLE.isEncounter(5, 5)).toBe(false); // plain ground
});

test("encounterRate returns the zone rate on grass and 0 elsewhere", () => {
	expect(SAMPLE.encounterRate(9, 3)).toBe(40);
	expect(SAMPLE.encounterRate(5, 5)).toBe(0);
});

test("encounterTableAt returns the tile's table (empty for the sample map)", () => {
	expect(SAMPLE.encounterTableAt(9, 3)).toEqual([]);
	expect(SAMPLE.encounterTableAt(5, 5)).toEqual([]);
});

test("createSampleNpcs gives the trainer a named, rewarded, multi-creature party", () => {
	let npcs = createSampleNpcs(["FIRST", "SECOND"]);
	let trainer = npcs.find((npc) => npc.role === "trainer");
	expect(trainer?.trainer?.name).toBe("Rival");
	expect(trainer?.trainer?.reward).toBe(500);
	expect(trainer?.trainer?.party).toEqual([
		{ speciesId: "FIRST", level: 5 },
		{ speciesId: "SECOND", level: 6 },
	]);
	// The healer and shop carry no trainer data.
	expect(npcs.find((npc) => npc.role === "healer")?.trainer).toBeUndefined();
});

test("createSampleNpcs fields the sole species twice when no second is offered", () => {
	let trainer = createSampleNpcs(["ONLY"]).find((npc) => npc.role === "trainer");
	expect(trainer?.trainer?.party).toEqual([
		{ speciesId: "ONLY", level: 5 },
		{ speciesId: "ONLY", level: 6 },
	]);
});

/** Builds a map with the given id whose single zone rolls the listed species. */
function mapWith(id: string, speciesIds: string[]): TileMap {
	let base = createSampleMap();
	let table: EncounterEntry[] = speciesIds.map((speciesId) => ({
		speciesId,
		minLevel: 2,
		maxLevel: 4,
		weight: 1,
	}));
	return { ...base, id, encounters: [{ zone: [2 * base.width + 2], table, rate: 25 }] };
}

test("habitatZones lists each map whose encounter tables roll the species", () => {
	let maps = [mapWith("route-1", ["PIDGEY", "RATTATA"]), mapWith("route-2", ["PIDGEY"])];
	// PIDGEY appears in both zones; the map ids come back in first-seen order.
	expect(habitatZones(maps, "PIDGEY")).toEqual(["route-1", "route-2"]);
	// RATTATA only appears on route-1.
	expect(habitatZones(maps, "RATTATA")).toEqual(["route-1"]);
});

test("habitatZones returns an empty list for a species in no encounter table", () => {
	let maps = [mapWith("route-1", ["PIDGEY"])];
	expect(habitatZones(maps, "MEWTWO")).toEqual([]);
	// The built-in sample map ships no populated tables, so nothing has a habitat.
	expect(habitatZones([createSampleMap()], "PIDGEY")).toEqual([]);
});

test("habitatZones lists a map id once even when several zones roll the species", () => {
	let base = createSampleMap();
	let table: EncounterEntry[] = [{ speciesId: "ZUBAT", minLevel: 5, maxLevel: 7, weight: 1 }];
	let multiZone: TileMap = {
		...base,
		id: "cave-1",
		encounters: [
			{ zone: [10], table, rate: 20 },
			{ zone: [11], table, rate: 20 },
		],
	};
	expect(habitatZones([multiZone], "ZUBAT")).toEqual(["cave-1"]);
});

test("warpAt finds a warp on its tile and returns null elsewhere", () => {
	let data: TileMap = createSampleMap();
	let table: EncounterEntry[] = [{ speciesId: "x", minLevel: 2, maxLevel: 3, weight: 1 }];
	let withWarp: TileMap = {
		...data,
		warps: [{ x: 8, y: 8, to: { map: "town", x: 1, y: 2 } }],
		encounters: [{ zone: [2 * data.width + 2], table, rate: 25 }],
	};
	let map = new GameMap(withWarp);

	expect(map.warpAt(8, 8)).toEqual({ map: "town", x: 1, y: 2 });
	expect(map.warpAt(5, 5)).toBeNull();
	// The authored table now flows through encounterTableAt/encounterRate.
	expect(map.encounterTableAt(2, 2)).toEqual(table);
	expect(map.encounterRate(2, 2)).toBe(25);
});
