/**
 * Map access helpers and a built-in sample map.
 *
 * `GameMap` wraps the authored `TileMap` data with the queries movement and
 * encounters need — bounds, collision, encounter membership and rate, warps —
 * keeping those rules out of the renderer and the scene. `createSampleMap`
 * returns a small hand-built map (a walled field with a patch of tall grass) so
 * the overworld is explorable before any authored maps ship; a real game loads
 * maps from the asset store instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { TILE_SIZE } from "../core/loop";
import { Collision, type EncounterEntry, type TileMap } from "../render/tilemap";

import type { Npc } from "./npc";

/** Queryable wrapper around one authored map. */
export class GameMap {
	/** Tile indices that belong to any encounter zone. */
	private readonly encounterTiles: Set<number>;

	/** @param data - The authored map this wraps. */
	constructor(readonly data: TileMap) {
		this.encounterTiles = new Set(data.encounters.flatMap((zone) => zone.zone));
	}

	/** Map width in pixels. */
	get widthPx(): number {
		return this.data.width * TILE_SIZE;
	}

	/** Map height in pixels. */
	get heightPx(): number {
		return this.data.height * TILE_SIZE;
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

/** Builds a small explorable map: a walled field with a tall-grass patch. */
export function createSampleMap(): TileMap {
	let width = 20;
	let height = 15;
	let collision = new Array<number>(width * height).fill(Collision.Walkable);

	for (let x = 0; x < width; x++) {
		collision[x] = Collision.Solid;
		collision[(height - 1) * width + x] = Collision.Solid;
	}
	for (let y = 0; y < height; y++) {
		collision[y * width] = Collision.Solid;
		collision[y * width + (width - 1)] = Collision.Solid;
	}

	// A pond and a couple of obstacles to make movement meaningful.
	for (let y = 9; y <= 11; y++)
		for (let x = 3; x <= 6; x++) collision[y * width + x] = Collision.Water;
	collision[5 * width + 14] = Collision.Solid;
	collision[6 * width + 14] = Collision.Solid;

	let zone: number[] = [];
	for (let y = 3; y <= 7; y++) for (let x = 9; x <= 14; x++) zone.push(y * width + x);

	let ground = new Array<number>(width * height).fill(0);
	let empty = new Array<number>(width * height).fill(-1);

	return {
		id: "route-1",
		tileset: "overworld",
		width,
		height,
		layers: { ground, decor: [...empty], overhead: [...empty] },
		collision,
		encounters: [{ zone, table: [], rate: 40 }],
		warps: [],
		npcs: [],
		triggers: [],
		bgm: "route-1",
	};
}

/** The default spawn tile and facing for a new game on the sample map. */
export const SAMPLE_SPAWN = { mapId: "route-1", x: 5, y: 5, facing: "down" as const };

/**
 * Builds the three interactable NPCs standing around the sample-map spawn.
 *
 * All three sit on walkable interior tiles a step or two from `SAMPLE_SPAWN`
 * (5,5) so the player meets them immediately. The trainer's creature species is
 * resolved by the caller from loaded content, keeping this helper free of any
 * content assumptions.
 *
 * @param trainerSpeciesId - The species the trainer NPC fields.
 */
export function createSampleNpcs(trainerSpeciesId: string): Npc[] {
	return [
		{ id: "healer", x: 7, y: 5, role: "healer", label: "H" },
		{ id: "shop", x: 7, y: 7, role: "shop", label: "$" },
		{
			id: "trainer",
			x: 5,
			y: 3,
			role: "trainer",
			label: "T",
			trainer: { speciesId: trainerSpeciesId, level: 5 },
		},
	];
}
