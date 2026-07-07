/**
 * Tests for the map loader, the map wrapper, and the built-in sample map.
 *
 * Covers `loadMap`'s validation (a valid map loads; malformed maps — bad layer
 * length, out-of-range tile ref, unknown tileset index — are rejected with a
 * clear `MapLoadError`), `createSampleMap`'s shape (a walled 20x15 field with a
 * grass patch and a pond), and the `GameMap` queries movement and encounters
 * depend on: `inBounds`, `isBlocked`, `isEncounter`, `encounterRate`,
 * `encounterTableAt`, `warpAt`, plus the renderer-facing `tilesets`/`layer`
 * accessors. Also covers the pure `habitatZones` lookup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { isFailure, isSuccess } from "@pkg/result";

import route1 from "~/content/maps/route-1.json";

import { TILE_SIZE } from "../core/loop";
import { EMPTY_CELL, packTileRef } from "../render/map-schema";
import { Collision, type EncounterEntry, type TileMap } from "../render/tilemap";

import {
	createSampleMap,
	createSampleNpcs,
	GameMap,
	habitatZones,
	loadMap,
	MapLoadError,
} from "./map-loader";

/** A minimal well-formed 2x1 map JSON value, overridden per test. */
function validMapJson(overrides: Record<string, unknown> = {}) {
	return {
		id: "m",
		width: 2,
		height: 1,
		tileWidth: 16,
		tileHeight: 16,
		tilesets: [{ id: "t", image: "sheet", columns: 8, tileWidth: 16, tileHeight: 16 }],
		layers: {
			ground: [0, EMPTY_CELL],
			decor: [EMPTY_CELL, EMPTY_CELL],
			overhead: [EMPTY_CELL, EMPTY_CELL],
		},
		collision: [0, 1],
		...overrides,
	};
}

test("loadMap accepts a well-formed map JSON value", () => {
	let result = loadMap(validMapJson());
	expect(isSuccess(result)).toBe(true);
	if (isFailure(result)) return;
	expect(result.data.id).toBe("m");
	expect(result.data.tilesets).toHaveLength(1);
});

test("loadMap rejects a schema-invalid value with a MapLoadError", () => {
	let result = loadMap({ id: "m" });
	expect(isFailure(result)).toBe(true);
	if (!isFailure(result)) return;
	expect(result.error).toBeInstanceOf(MapLoadError);
});

test("loadMap rejects a layer whose length does not match width*height", () => {
	let result = loadMap(
		validMapJson({
			layers: { ground: [0], decor: [EMPTY_CELL, EMPTY_CELL], overhead: [EMPTY_CELL, EMPTY_CELL] },
		}),
	);
	expect(isFailure(result)).toBe(true);
	if (!isFailure(result)) return;
	expect(result.error.message).toContain('Layer "ground"');
	expect(result.error.message).toContain("1 cells");
});

test("loadMap rejects a collision grid of the wrong length", () => {
	let result = loadMap(validMapJson({ collision: [0] }));
	expect(isFailure(result)).toBe(true);
	if (!isFailure(result)) return;
	expect(result.error.message).toContain("Collision grid");
});

test("loadMap rejects a tile ref naming a tileset index that does not exist", () => {
	// Cell packs tileset index 3 but the map declares only one tileset.
	let result = loadMap(
		validMapJson({
			layers: {
				ground: [packTileRef(3, 0), EMPTY_CELL],
				decor: [EMPTY_CELL, EMPTY_CELL],
				overhead: [EMPTY_CELL, EMPTY_CELL],
			},
		}),
	);
	expect(isFailure(result)).toBe(true);
	if (!isFailure(result)) return;
	expect(result.error.message).toContain("references tileset 3");
});

test("createSampleMap loads through the validator unchanged", () => {
	let result = loadMap(createSampleMap());
	expect(isSuccess(result)).toBe(true);
});

test("the authored route-1.json loads through the validator with its migrated events", () => {
	let result = loadMap(route1);
	expect(isSuccess(result)).toBe(true);
	if (isFailure(result)) return;
	expect(result.data.events).toHaveLength(3);
	// Each migrated event is a single page carrying its trigger and command list.
	let youngster = result.data.events.find((event) => event.id === "route-1-youngster")!;
	expect(youngster.pages).toHaveLength(1);
	expect(youngster.pages[0]!.trigger).toBe("action");
	expect(youngster.pages[0]!.autonomousMovement).toEqual({
		type: "route",
		speed: undefined,
		freq: undefined,
		route: ["left", "left", "right", "right"],
	});
	expect(youngster.pages[0]!.commands[1]).toEqual({
		kind: "start-trainer-battle",
		trainer: { name: "Youngster Joey", party: [{ speciesId: "RATTATA", level: 5 }], reward: 400 },
	});
	let legendary = result.data.events.find((event) => event.id === "route-1-legendary")!;
	expect(legendary.pages[0]!.commands.at(-1)).toEqual({
		kind: "wild-encounter",
		speciesId: "MEW",
		level: 30,
	});
});

test("createSampleMap returns a 20x15 route with a walled border", () => {
	let map = createSampleMap();
	expect(map.width).toBe(20);
	expect(map.height).toBe(15);
	expect(map.collision[0]).toBe(Collision.Solid); // top-left corner
	expect(map.collision[map.width - 1]).toBe(Collision.Solid); // top-right corner
	expect(map.collision[(map.height - 1) * map.width]).toBe(Collision.Solid); // bottom-left
});

test("createSampleMap carves a walkable interior and a single encounter zone", () => {
	let map = createSampleMap();
	expect(map.collision[5 * map.width + 5]).toBe(Collision.Walkable);
	expect(map.encounters).toHaveLength(1);
	expect(map.encounters[0]!.rate).toBe(40);
});

let SAMPLE = new GameMap(createSampleMap());

test("widthPx and heightPx scale the tile grid by the map's tile size", () => {
	expect(SAMPLE.widthPx).toBe(20 * TILE_SIZE);
	expect(SAMPLE.heightPx).toBe(15 * TILE_SIZE);
});

test("tilesets and layer expose the renderer-facing map data", () => {
	expect(SAMPLE.tilesets).toHaveLength(1);
	expect(SAMPLE.tilesets[0]!.id).toBe("overworld");
	expect(SAMPLE.layer("ground")).toHaveLength(20 * 15);
	expect(SAMPLE.layer("overhead").every((cell) => cell === EMPTY_CELL)).toBe(true);
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
	expect(habitatZones(maps, "PIDGEY")).toEqual(["route-1", "route-2"]);
	expect(habitatZones(maps, "RATTATA")).toEqual(["route-1"]);
});

test("habitatZones returns an empty list for a species in no encounter table", () => {
	let maps = [mapWith("route-1", ["PIDGEY"])];
	expect(habitatZones(maps, "MEWTWO")).toEqual([]);
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
	expect(map.encounterTableAt(2, 2)).toEqual(table);
	expect(map.encounterRate(2, 2)).toBe(25);
});
