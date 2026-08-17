/**
 * Tests for the tile renderer: its pure helpers and its two draw paths.
 *
 * `tileSourceRect` and the layer-order constants are pure, so they are asserted
 * directly. The renderer prerenders its ground layers to an offscreen canvas, so
 * the draw tests install a fake `document` whose canvas hands back a recording 2D
 * context; that lets the real `prerender` path run without a DOM. With a resolved
 * tileset image the renderer blits each non-empty cell from the tile's source rect
 * (an empty `-1` cell blits nothing); with no tileset image it falls back to the
 * atlas-preferring procedural fill keyed off the collision grid.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, expect, test } from "vitest";

import { Atlas, type AtlasSource, type Rect } from "./atlas";
import { packTileRef, type Tileset } from "./map-schema";
import {
	Collision,
	LAYER_OVER_ACTORS,
	LAYERS_UNDER_ACTORS,
	type TileMap,
	TileMapRenderer,
	tileSourceRect,
} from "./tilemap";

const TILESET: Tileset = { id: "t", image: "sheet", columns: 8, tileWidth: 16, tileHeight: 16 };

test("tileSourceRect maps a tile index to its column/row in the sheet", () => {
	// Tile 0 sits at the top-left.
	expect(tileSourceRect(TILESET, 0)).toEqual({ x: 0, y: 0, w: 16, h: 16 });
	// Tile 3 is the fourth column of the first row.
	expect(tileSourceRect(TILESET, 3)).toEqual({ x: 48, y: 0, w: 16, h: 16 });
	// Tile 8 wraps to the first column of the second row (8 columns wide).
	expect(tileSourceRect(TILESET, 8)).toEqual({ x: 0, y: 16, w: 16, h: 16 });
	// Tile 10 is the third column of the second row.
	expect(tileSourceRect(TILESET, 10)).toEqual({ x: 32, y: 16, w: 16, h: 16 });
});

test("packTileRef round-trips through the tileset/tile indices", () => {
	let packed = packTileRef(2, 37);
	expect(packed).toBe(2 * 4096 + 37);
});

test("the layer-order split draws ground+decor under actors and overhead over them", () => {
	expect(LAYERS_UNDER_ACTORS).toEqual(["ground", "decor"]);
	expect(LAYER_OVER_ACTORS).toBe("overhead");
});

/** A recording 2D context capturing the calls the renderer makes while prerendering. */
function recordingContext() {
	let fills: Array<{ x: number; y: number; w: number; h: number }> = [];
	let blits: Array<{ sx: number; sy: number; dx: number; dy: number }> = [];
	return {
		fills,
		blits,
		imageSmoothingEnabled: false,
		fillStyle: "",
		strokeStyle: "",
		fillRect(x: number, y: number, w: number, h: number) {
			fills.push({ x, y, w, h });
		},
		strokeRect() {},
		drawImage(
			_image: unknown,
			sx: number,
			sy: number,
			_sw: number,
			_sh: number,
			dx: number,
			dy: number,
		) {
			blits.push({ sx, sy, dx, dy });
		},
		save() {},
		restore() {},
		translate() {},
		scale() {},
	};
}

let context = recordingContext();

/** Installs a fake document whose canvas returns the shared recording context. */
beforeEach(() => {
	context = recordingContext();
	(globalThis as { document?: unknown }).document = {
		createElement() {
			return {
				width: 0,
				height: 0,
				getContext() {
					return context;
				},
			};
		},
	};
});

afterEach(() => {
	delete (globalThis as { document?: unknown }).document;
});

/** A tiny 2x1 map: one plain walkable cell and one solid cell. */
function sampleMap(overrides: Partial<TileMap> = {}): TileMap {
	return {
		id: "test",
		width: 2,
		height: 1,
		tileWidth: 16,
		tileHeight: 16,
		tilesets: [TILESET],
		layers: { ground: [0, 0], decor: [-1, -1], overhead: [-1, -1] },
		collision: [Collision.Walkable, Collision.Solid],
		encounters: [],
		warps: [],
		events: [],
		bgm: "",
		...overrides,
	};
}

/** A fake image handle standing in for a decoded tileset sheet. */
const FAKE_IMAGE = { width: 128, height: 128 } as unknown as HTMLImageElement;

test("a tileset-backed cell blits the tile's source rect at its grid position", () => {
	// Ground cell 0 = tile 10 of tileset 0; cell 1 is empty (-1) and blits nothing.
	let map = sampleMap({
		layers: { ground: [packTileRef(0, 10), -1], decor: [-1, -1], overhead: [-1, -1] },
	});
	new TileMapRenderer(map, () => FAKE_IMAGE, null);
	expect(context.blits).toHaveLength(1);
	// Tile 10 in an 8-column sheet is at source (32, 16); it draws at grid cell 0 (0,0).
	expect(context.blits[0]).toEqual({ sx: 32, sy: 16, dx: 0, dy: 0 });
	// No procedural fills happen once a tileset image is present.
	expect(context.fills).toHaveLength(0);
});

test("an empty (-1) cell in every layer blits nothing", () => {
	let map = sampleMap({ layers: { ground: [-1, -1], decor: [-1, -1], overhead: [-1, -1] } });
	new TileMapRenderer(map, () => FAKE_IMAGE, null);
	expect(context.blits).toHaveLength(0);
	expect(context.fills).toHaveLength(0);
});

test("with no tileset image and no atlas the renderer fills flat procedural tiles", () => {
	new TileMapRenderer(sampleMap(), () => null, null);
	// One fill per cell (the grid-line stroke is a separate strokeRect).
	expect(context.fills).toHaveLength(2);
	expect(context.fills[0]).toMatchObject({ x: 0, y: 0, w: 16, h: 16 });
	expect(context.blits).toHaveLength(0);
});

const TILE_REGIONS: Record<string, Rect> = {
	"tile.grass": { x: 0, y: 0, w: 16, h: 16 },
	"tile.wall": { x: 16, y: 0, w: 16, h: 16 },
};

test("with an atlas (and no tileset image) the renderer blits the tile region per collision kind", () => {
	let atlas = new Atlas({ width: 32, height: 16 } as unknown as AtlasSource, TILE_REGIONS);
	new TileMapRenderer(sampleMap(), () => null, atlas);
	// Both cells resolve to an atlas region, so no flat fills happen.
	expect(context.fills).toHaveLength(0);
	expect(context.blits).toHaveLength(2);
	// Cell 0 is walkable -> "tile.grass" (source 0,0); cell 1 is solid -> "tile.wall" (16,0).
	expect(context.blits[0]).toMatchObject({ sx: 0, sy: 0 });
	expect(context.blits[1]).toMatchObject({ sx: 16, sy: 0 });
});

test("an atlas missing a needed region falls back to a flat fill for that cell", () => {
	// Only the walkable region is present; the solid cell has no region.
	let partial = new Atlas({ width: 16, height: 16 } as unknown as AtlasSource, {
		"tile.grass": { x: 0, y: 0, w: 16, h: 16 },
	});
	new TileMapRenderer(sampleMap(), () => null, partial);
	expect(context.blits).toHaveLength(1); // walkable cell blitted from the atlas
	expect(context.fills).toHaveLength(1); // solid cell fell back to a flat color fill
});
