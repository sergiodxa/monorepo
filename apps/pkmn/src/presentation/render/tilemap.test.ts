/**
 * Tests for the tile map renderer's atlas-preferring procedural fallback.
 *
 * The renderer prerenders its ground layer to an offscreen canvas, so these tests
 * install a fake `document` whose canvas hands back a recording 2D context. That
 * lets the real `prerender`/`drawProcedural` path run without a DOM and assert the
 * fallback chain: with no grid tileset and no atlas the renderer fills flat
 * placeholder colors (procedural), and with an atlas it blits the atlas tile
 * region instead. The recording context captures `fillRect` and `drawImage`, not a
 * real blit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, expect, test } from "bun:test";

import { Atlas, type AtlasSource, type Rect } from "./atlas";
import { Collision, type TileMap, TileMapRenderer } from "./tilemap";

/** A recording 2D context capturing the calls the renderer makes while prerendering. */
function recordingContext() {
	let fills: Array<{ x: number; y: number; w: number; h: number }> = [];
	let blits: Array<{ sx: number; sy: number }> = [];
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
		drawImage(_image: unknown, sx: number, sy: number) {
			blits.push({ sx, sy });
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
function sampleMap(): TileMap {
	return {
		id: "test",
		tileset: "none",
		width: 2,
		height: 1,
		layers: { ground: [0, 0], decor: [-1, -1], overhead: [-1, -1] },
		collision: [Collision.Walkable, Collision.Solid],
		encounters: [],
		warps: [],
		npcs: [],
		triggers: [],
		bgm: "",
	};
}

const TILE_REGIONS: Record<string, Rect> = {
	"tile.grass": { x: 0, y: 0, w: 16, h: 16 },
	"tile.wall": { x: 16, y: 0, w: 16, h: 16 },
};

test("with no tileset and no atlas the renderer fills flat procedural tiles", () => {
	new TileMapRenderer(sampleMap(), null, null);
	// One fill per cell (the grid-line stroke is a separate strokeRect).
	expect(context.fills).toHaveLength(2);
	expect(context.fills[0]).toMatchObject({ x: 0, y: 0, w: 16, h: 16 });
	expect(context.blits).toHaveLength(0);
});

test("with an atlas the renderer blits the tile region per collision kind", () => {
	let atlas = new Atlas({ width: 32, height: 16 } as unknown as AtlasSource, TILE_REGIONS);
	new TileMapRenderer(sampleMap(), null, atlas);
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
	new TileMapRenderer(sampleMap(), null, partial);
	expect(context.blits).toHaveLength(1); // walkable cell blitted from the atlas
	expect(context.fills).toHaveLength(1); // solid cell fell back to a flat color fill
});
