/**
 * Map loading, access helpers, and a built-in sample map.
 *
 * Validates untrusted map JSON against the cross-field invariants a shape
 * schema cannot express, then exposes typed map queries for movement and
 * encounters, plus a small built-in sample map.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { failure, type Result, success } from "@pkg/result";
import { parseSafe } from "remix/data-schema";

import { TILE_SIZE } from "../core/loop";
import {
	EMPTY_CELL,
	type MapData,
	MapDataSchema,
	type MapEvent,
	unpackTileRef,
} from "../render/map-schema";
import { Collision, type EncounterEntry, type TileMap, type Tileset } from "../render/tilemap";

import type { Npc } from "./npc";

/** Error describing why a map JSON value failed to load. */
export class MapLoadError extends Error {
	/** @param message - Human-readable reason the map is invalid. */
	constructor(message: string) {
		super(message);
		this.name = "MapLoadError";
	}
}

/** The three tile layers, in the order they are validated and named in errors. */
const LAYER_NAMES = ["ground", "decor", "overhead"] as const;

/**
 * Validates untrusted JSON into a {@link MapData}, checking that every layer
 * and the collision grid hold exactly `width*height` cells and every tile ref
 * names a real tileset that exists.
 *
 * @param value - The parsed JSON value to validate (untrusted).
 * @returns Success with the validated map, or failure with a {@link MapLoadError}.
 */
export function loadMap(value: unknown): Result<MapData, MapLoadError> {
	let parsed = parseSafe(MapDataSchema, value);
	if (!parsed.success) {
		let issue = parsed.issues[0];
		let where = issue?.path?.length ? ` at ${issue.path.map(String).join(".")}` : "";
		return failure(new MapLoadError(`Invalid map${where}: ${issue?.message ?? "unknown error"}`));
	}

	let map = parsed.value;
	let expected = map.width * map.height;

	for (let name of LAYER_NAMES) {
		let layer = map.layers[name];
		if (layer.length !== expected) {
			return failure(
				new MapLoadError(
					`Layer "${name}" has ${layer.length} cells but the ${map.width}x${map.height} map needs ${expected}.`,
				),
			);
		}
	}

	if (map.collision.length !== expected) {
		return failure(
			new MapLoadError(
				`Collision grid has ${map.collision.length} cells but the ${map.width}x${map.height} map needs ${expected}.`,
			),
		);
	}

	for (let name of LAYER_NAMES) {
		let layer = map.layers[name];
		for (let index = 0; index < layer.length; index++) {
			let cell = layer[index]!;
			if (cell === EMPTY_CELL) continue;
			let { tilesetIndex } = unpackTileRef(cell);
			if (tilesetIndex >= map.tilesets.length) {
				return failure(
					new MapLoadError(
						`Layer "${name}" cell ${index} references tileset ${tilesetIndex} but the map declares only ${map.tilesets.length}.`,
					),
				);
			}
		}
	}

	return success(map);
}

/** Queryable wrapper around one validated map. */
export class GameMap {
	/** Tile indices that belong to any encounter zone. */
	private readonly encounterTiles: Set<number>;

	/** @param data - The validated map this wraps. */
	constructor(readonly data: TileMap) {
		this.encounterTiles = new Set(data.encounters.flatMap((zone) => zone.zone));
	}

	/** Map width in pixels. */
	get widthPx(): number {
		return this.data.width * this.data.tileWidth;
	}

	/** Map height in pixels. */
	get heightPx(): number {
		return this.data.height * this.data.tileHeight;
	}

	/** The map's tilesets, in declaration order (index matches packed tile refs). */
	get tilesets(): readonly Tileset[] {
		return this.data.tilesets;
	}

	/** The authored events on this map (NPCs, wild creatures, invisible triggers). */
	get events(): readonly MapEvent[] {
		return this.data.events;
	}

	/** One tile layer's flat cell array by name (`-1` empty, else a packed tile ref). */
	layer(name: "ground" | "decor" | "overhead"): number[] {
		return this.data.layers[name];
	}

	/** True when a tile is inside the map. */
	inBounds(x: number, y: number): boolean {
		return x >= 0 && y >= 0 && x < this.data.width && y < this.data.height;
	}

	/** True when a tile cannot be walked onto (out of bounds, solid, or water). */
	isBlocked(x: number, y: number): boolean {
		if (!this.inBounds(x, y)) return true;
		let cell = this.data.collision[y * this.data.width + x];
		return cell === Collision.Solid || cell === Collision.Water;
	}

	/** True when a tile rolls wild encounters. */
	isEncounter(x: number, y: number): boolean {
		return this.encounterTiles.has(y * this.data.width + x);
	}

	/** The encounter rate (0..255) for a tile, or 0 when it is not an encounter tile. */
	encounterRate(x: number, y: number): number {
		let index = y * this.data.width + x;
		for (let zone of this.data.encounters) if (zone.zone.includes(index)) return zone.rate;
		return 0;
	}

	/** The encounter table for a tile, or an empty list when it has none. */
	encounterTableAt(x: number, y: number): EncounterEntry[] {
		let index = y * this.data.width + x;
		for (let zone of this.data.encounters) if (zone.zone.includes(index)) return zone.table;
		return [];
	}

	/** The warp at a tile, if any. */
	warpAt(x: number, y: number): { map: string; x: number; y: number } | null {
		for (let warp of this.data.warps) if (warp.x === x && warp.y === y) return warp.to;
		return null;
	}
}

/**
 * Lists the zones where a species can be encountered, for "where to catch"
 * lookups. Collects each map's id once, in first-seen order; a species absent
 * everywhere yields an empty list.
 *
 * @param maps - The authored maps to search.
 * @param speciesId - The species identifier to look for in encounter tables.
 */
export function habitatZones(maps: readonly TileMap[], speciesId: string): string[] {
	let zones: string[] = [];
	for (let map of maps) {
		let present = map.encounters.some((zone) =>
			zone.table.some((entry) => entry.speciesId === speciesId),
		);
		if (present && !zones.includes(map.id)) zones.push(map.id);
	}
	return zones;
}

/**
 * Builds a small explorable map: a walled field with a tall-grass patch, a
 * pond, and a couple of obstacles that give movement something to route
 * around.
 */
export function createSampleMap(): TileMap {
	let width = 20;
	let height = 15;
	let collision = Array.from({ length: width * height }, () => Collision.Walkable);

	for (let x = 0; x < width; x++) {
		collision[x] = Collision.Solid;
		collision[(height - 1) * width + x] = Collision.Solid;
	}
	for (let y = 0; y < height; y++) {
		collision[y * width] = Collision.Solid;
		collision[y * width + (width - 1)] = Collision.Solid;
	}

	for (let y = 9; y <= 11; y++)
		for (let x = 3; x <= 6; x++) collision[y * width + x] = Collision.Water;
	collision[5 * width + 14] = Collision.Solid;
	collision[6 * width + 14] = Collision.Solid;

	let zone: number[] = [];
	for (let y = 3; y <= 7; y++) for (let x = 9; x <= 14; x++) zone.push(y * width + x);

	let ground = Array.from({ length: width * height }, () => 0);
	let empty = Array.from({ length: width * height }, () => EMPTY_CELL);

	return {
		id: "route-1",
		width,
		height,
		tileWidth: TILE_SIZE,
		tileHeight: TILE_SIZE,
		tilesets: [
			{
				id: "overworld",
				image: "overworld",
				columns: 8,
				tileWidth: TILE_SIZE,
				tileHeight: TILE_SIZE,
			},
		],
		layers: { ground, decor: [...empty], overhead: [...empty] },
		collision,
		encounters: [{ zone, table: [], rate: 40 }],
		warps: [],
		events: [],
		bgm: "route-1",
	};
}

/** The default spawn tile and facing for a new game on the sample map. */
export const SAMPLE_SPAWN = { mapId: "route-1", x: 5, y: 5, facing: "down" as const };

/**
 * Builds the three interactable NPCs standing around the sample-map spawn, on
 * walkable tiles so the player meets them immediately. Fields the second
 * species twice, at staggered levels, when the caller supplies only one.
 *
 * @param trainerSpeciesIds - Ordered species the trainer's party is built from.
 */
export function createSampleNpcs(trainerSpeciesIds: readonly string[]): Npc[] {
	let first = trainerSpeciesIds[0] ?? "";
	let second = trainerSpeciesIds[1] ?? first;
	return [
		{ id: "healer", x: 7, y: 5, role: "healer", label: "H" },
		{ id: "shop", x: 7, y: 7, role: "shop", label: "$" },
		{
			id: "trainer",
			x: 5,
			y: 3,
			role: "trainer",
			label: "T",
			trainer: {
				name: "Rival",
				party: [
					{ speciesId: first, level: 5 },
					{ speciesId: second, level: 6 },
				],
				reward: 500,
			},
		},
	];
}
