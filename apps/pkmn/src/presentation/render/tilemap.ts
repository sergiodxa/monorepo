/**
 * Tilemap data shapes and their renderer.
 *
 * `TileMap` is the authored JSON contract for one map: three tile layers, a
 * collision grid, encounter zones, warps, NPCs, and triggers. `ScriptCommand` is
 * the small declarative language NPCs and triggers run so map content stays
 * data. `TileMapRenderer` pre-renders the static ground and decor layers to an
 * offscreen canvas once, then blits the camera view each frame; when no tileset
 * image is available it draws procedural colored tiles so maps are visible before
 * art exists. The overhead layer draws above actors and is exposed separately.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Direction } from "../core/direction";

import { SCREEN_HEIGHT, SCREEN_WIDTH, TILE_SIZE } from "../core/loop";

import { type Camera } from "./camera";
import { Tile } from "./theme";

/** One declarative step an NPC or trigger script runs. */
export type ScriptCommand =
	| { do: "message"; text: string }
	| { do: "choice"; options: string[]; branches: ScriptCommand[][] }
	| { do: "give-item"; itemId: string; count: number }
	| { do: "heal-party" }
	| { do: "start-trainer-battle"; trainerId: string }
	| { do: "set-flag"; flag: string }
	| { do: "if-flag"; flag: string; then: ScriptCommand[]; else?: ScriptCommand[] }
	| { do: "warp"; toMap: string; toX: number; toY: number }
	| { do: "face-player" }
	| { do: "move"; route: Direction[] };

/** One weighted encounter-table entry. */
export interface EncounterEntry {
	speciesId: string;
	minLevel: number;
	maxLevel: number;
	weight: number;
}

/** An authored NPC placed on a map. */
export interface MapNpc {
	id: string;
	x: number;
	y: number;
	sheet: string;
	facing: Direction;
	movement: "static" | "wander" | { route: Direction[] };
	script: ScriptCommand[];
}

/** The authored data for one map. */
export interface TileMap {
	id: string;
	tileset: string;
	width: number;
	height: number;
	layers: { ground: number[]; decor: number[]; overhead: number[] };
	collision: number[];
	encounters: Array<{ zone: number[]; table: EncounterEntry[]; rate: number }>;
	warps: Array<{ x: number; y: number; to: { map: string; x: number; y: number } }>;
	npcs: MapNpc[];
	triggers: Array<{ x: number; y: number; once?: boolean; flag?: string; script: ScriptCommand[] }>;
	bgm: string;
}

/** Collision cell meanings used by the placeholder renderer and movement. */
export const enum Collision {
	Walkable = 0,
	Solid = 1,
	Water = 2,
	LedgeDown = 3,
}

/** Pre-renders and blits one map's tile layers. */
export class TileMapRenderer {
	/** Cached full-map render of the ground+decor layers, or null before prerender. */
	private ground: HTMLCanvasElement | null = null;

	/** Tiles in this map that belong to any encounter zone, for grass tinting. */
	private readonly encounterTiles: Set<number>;

	/**
	 * @param map - The map to render.
	 * @param tileset - The tileset image, or null to draw procedural tiles.
	 */
	constructor(
		private readonly map: TileMap,
		private readonly tileset: HTMLImageElement | null,
	) {
		this.encounterTiles = new Set(map.encounters.flatMap((zone) => zone.zone));
		this.prerender();
	}

	/** Draws the static ground+decor layers for the current camera view. */
	drawGround(ctx: CanvasRenderingContext2D, camera: Camera) {
		if (this.ground) ctx.drawImage(this.ground, -Math.round(camera.x), -Math.round(camera.y));
	}

	/** Draws the overhead layer above actors (procedural fallback draws nothing). */
	drawOverhead(ctx: CanvasRenderingContext2D, camera: Camera) {
		if (!this.tileset) return;
		this.drawLayer(ctx, this.map.layers.overhead, -camera.x, -camera.y, true);
	}

	/** Builds the offscreen ground+decor canvas once. */
	private prerender() {
		let canvas = globalThis.document?.createElement("canvas");
		if (!canvas) return;
		canvas.width = this.map.width * TILE_SIZE;
		canvas.height = this.map.height * TILE_SIZE;
		let ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.imageSmoothingEnabled = false;

		if (this.tileset) {
			this.drawLayer(ctx, this.map.layers.ground, 0, 0, false);
			this.drawLayer(ctx, this.map.layers.decor, 0, 0, true);
		} else {
			this.drawProcedural(ctx);
		}
		this.ground = canvas;
	}

	/** Draws one tile layer from a tileset, skipping empty (-1) cells. */
	private drawLayer(
		ctx: CanvasRenderingContext2D,
		layer: number[],
		offsetX: number,
		offsetY: number,
		skipEmpty: boolean,
	) {
		if (!this.tileset) return;
		let columns = Math.max(1, Math.floor(this.tileset.width / TILE_SIZE));
		for (let index = 0; index < layer.length; index++) {
			let tile = layer[index]!;
			if (skipEmpty && tile < 0) continue;
			if (tile < 0) continue;
			let dx = (index % this.map.width) * TILE_SIZE + offsetX;
			let dy = Math.floor(index / this.map.width) * TILE_SIZE + offsetY;
			let sx = (tile % columns) * TILE_SIZE;
			let sy = Math.floor(tile / columns) * TILE_SIZE;
			ctx.drawImage(this.tileset, sx, sy, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
		}
	}

	/** Colors each cell from its collision value and encounter membership. */
	private drawProcedural(ctx: CanvasRenderingContext2D) {
		for (let index = 0; index < this.map.collision.length; index++) {
			let x = (index % this.map.width) * TILE_SIZE;
			let y = Math.floor(index / this.map.width) * TILE_SIZE;
			ctx.fillStyle = this.tileColor(index);
			ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
			ctx.strokeStyle = Tile.gridLine;
			ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
		}
	}

	/** Picks a placeholder color for one cell. */
	private tileColor(index: number): string {
		if (this.encounterTiles.has(index)) return Tile.grass;
		switch (this.map.collision[index]) {
			case Collision.Solid:
				return Tile.solid;
			case Collision.Water:
				return Tile.water;
			case Collision.LedgeDown:
				return Tile.ledge;
			default:
				return Tile.walkable;
		}
	}
}

/** The internal-resolution viewport size, re-exported for scene layout math. */
export const VIEWPORT = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } as const;
