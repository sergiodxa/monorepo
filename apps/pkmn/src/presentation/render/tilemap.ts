/**
 * The runtime map shape and its tile renderer.
 *
 * `TileMapRenderer` pre-renders `ground`/`decor` to an offscreen canvas per
 * frame; a missing tileset image falls back to procedural tiles keyed off
 * the collision grid, so every map renders before real art exists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { SCREEN_HEIGHT, SCREEN_WIDTH, TILE_SIZE } from "../core/loop";

import { type Atlas, drawSprite, type Rect } from "./atlas";
import { type Camera } from "./camera";
import { EMPTY_CELL, type MapData, type Tileset, unpackTileRef } from "./map-schema";
import * as theme from "./theme";

export type { EncounterEntry, EventCommand, EventPage, MapEvent, Tileset } from "./map-schema";

/** The runtime map type: the validated on-disk `MapData`. */
export type TileMap = MapData;

/** Collision cell meanings used by the placeholder renderer and movement. */
export const enum Collision {
	Walkable = 0,
	Solid = 1,
	Water = 2,
	LedgeDown = 3,
}

/** The tile layers drawn under the player, in back-to-front order. */
export const LAYERS_UNDER_ACTORS = ["ground", "decor"] as const;

/** The single tile layer drawn above the player. */
export const LAYER_OVER_ACTORS = "overhead" as const;

/**
 * The source rect of one tile within its tileset image, computed from the
 * tileset's column count and tile size so the renderer and its tests agree
 * on the blit math.
 *
 * @param tileset - The tileset the tile belongs to (its `columns` and tile size).
 * @param tileIndex - The zero-based tile index within the tileset grid.
 */
export function tileSourceRect(tileset: Tileset, tileIndex: number): Rect {
	let column = tileIndex % tileset.columns;
	let row = Math.floor(tileIndex / tileset.columns);
	return {
		x: column * tileset.tileWidth,
		y: row * tileset.tileHeight,
		w: tileset.tileWidth,
		h: tileset.tileHeight,
	};
}

/** Resolves a tileset image by its manifest image id, or null when missing. */
export type TilesetImageResolver = (imageId: string) => HTMLImageElement | null;

/** Pre-renders and blits one map's tile layers. */
export class TileMapRenderer {
	/** Cached full-map render of the ground+decor layers, or null before prerender. */
	private ground: HTMLCanvasElement | null = null;

	/** Tiles in this map that belong to any encounter zone, for grass tinting. */
	private readonly encounterTiles: Set<number>;

	/** Resolved tileset images by `tilesets` index (null when the image is missing). */
	private readonly images: Array<HTMLImageElement | null>;

	/** True when at least one tileset image resolved, so real tiles can be blit. */
	private readonly hasTilesetImage: boolean;

	/**
	 * @param map - The map to render.
	 * @param resolveImage - Resolves each tileset's image by its manifest id; a
	 *   tileset whose image is missing falls back to procedural drawing.
	 * @param atlas - An optional atlas whose per-collision tile regions are used in
	 *   the procedural fallback; when it too lacks a region the cell falls back to a
	 *   flat color, so a map always renders.
	 */
	constructor(
		private readonly map: TileMap,
		resolveImage: TilesetImageResolver = () => null,
		private readonly atlas: Atlas | null = null,
	) {
		this.encounterTiles = new Set(map.encounters.flatMap((zone) => zone.zone));
		this.images = map.tilesets.map((tileset) => resolveImage(tileset.image));
		this.hasTilesetImage = this.images.some((image) => image !== null);
		this.prerender();
	}

	/** Draws the static ground+decor layers for the current camera view. */
	drawGround(ctx: CanvasRenderingContext2D, camera: Camera) {
		if (this.ground) ctx.drawImage(this.ground, -Math.round(camera.x), -Math.round(camera.y));
	}

	/** Draws the overhead layer above actors (procedural fallback draws nothing). */
	drawOverhead(ctx: CanvasRenderingContext2D, camera: Camera) {
		if (!this.hasTilesetImage) return;
		this.drawLayer(
			ctx,
			this.map.layers[LAYER_OVER_ACTORS],
			-Math.round(camera.x),
			-Math.round(camera.y),
		);
	}

	/** Builds the offscreen ground+decor canvas once. */
	private prerender() {
		let canvas = globalThis.document?.createElement("canvas");
		if (!canvas) return;
		canvas.width = this.map.width * this.map.tileWidth;
		canvas.height = this.map.height * this.map.tileHeight;
		let ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.imageSmoothingEnabled = false;

		if (this.hasTilesetImage) {
			for (let name of LAYERS_UNDER_ACTORS) this.drawLayer(ctx, this.map.layers[name], 0, 0);
		} else {
			this.drawProcedural(ctx);
		}
		this.ground = canvas;
	}

	/**
	 * Draws one tile layer, blitting each non-empty cell from its tileset image.
	 * A cell of {@link EMPTY_CELL} (`-1`) draws nothing, and a cell whose tileset
	 * lacks a resolved image is skipped, keeping the frame rendering.
	 */
	private drawLayer(
		ctx: CanvasRenderingContext2D,
		layer: number[],
		offsetX: number,
		offsetY: number,
	) {
		for (let index = 0; index < layer.length; index++) {
			let cell = layer[index]!;
			if (cell === EMPTY_CELL) continue;
			let { tilesetIndex, tileIndex } = unpackTileRef(cell);
			let image = this.images[tilesetIndex] ?? null;
			let tileset = this.map.tilesets[tilesetIndex];
			if (!image || !tileset) continue;
			let source = tileSourceRect(tileset, tileIndex);
			let dx = (index % this.map.width) * this.map.tileWidth + offsetX;
			let dy = Math.floor(index / this.map.width) * this.map.tileHeight + offsetY;
			ctx.drawImage(
				image,
				source.x,
				source.y,
				source.w,
				source.h,
				dx,
				dy,
				this.map.tileWidth,
				this.map.tileHeight,
			);
		}
	}

	/**
	 * Draws each cell from its atlas region when present, so a dropped-in tile
	 * pack shows through; otherwise fills a flat placeholder color and strokes
	 * the debug grid line, keeping the map visible without a tileset image.
	 */
	private drawProcedural(ctx: CanvasRenderingContext2D) {
		for (let index = 0; index < this.map.collision.length; index++) {
			let x = (index % this.map.width) * TILE_SIZE;
			let y = Math.floor(index / this.map.width) * TILE_SIZE;
			if (drawSprite(ctx, this.atlas, this.tileRegion(index), x, y)) continue;
			ctx.fillStyle = this.tileColor(index);
			ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
			ctx.strokeStyle = theme.TILE.gridLine;
			ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
		}
	}

	/** The atlas region name for one cell's collision value and encounter membership. */
	private tileRegion(index: number): string {
		if (this.encounterTiles.has(index)) return "tile.tall-grass";
		switch (this.map.collision[index]) {
			case Collision.Solid:
				return "tile.wall";
			case Collision.Water:
				return "tile.water";
			case Collision.LedgeDown:
				return "tile.sand";
			default:
				return "tile.grass";
		}
	}

	/** Picks a placeholder color for one cell. */
	private tileColor(index: number): string {
		if (this.encounterTiles.has(index)) return theme.TILE.grass;
		switch (this.map.collision[index]) {
			case Collision.Solid:
				return theme.TILE.solid;
			case Collision.Water:
				return theme.TILE.water;
			case Collision.LedgeDown:
				return theme.TILE.ledge;
			default:
				return theme.TILE.walkable;
		}
	}
}

/** The internal-resolution viewport size, re-exported for scene layout math. */
export const VIEWPORT = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } as const;
