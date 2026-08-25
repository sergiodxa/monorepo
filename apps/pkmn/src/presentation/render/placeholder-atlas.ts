/**
 * Original, code-generated demo atlas: every sprite is a hand-authored grid
 * of color-keyed rows, so the demo ships fully authored, original art. The
 * builder returns `null` without a `document` (e.g. under test), so callers
 * fall back to procedural drawing. A licensed pack can later replace it via
 * an `atlas` manifest entry, and the renderer keeps blitting by region name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { TILE_SIZE } from "../core/loop";

import { Atlas, type AtlasSource, type Rect } from "./atlas";
import * as theme from "./theme";

/** Edge length in pixels of each generated character/creature cell. */
export const CELL = TILE_SIZE;

/** The width of the generated window-frame region (a 3x3 nine-slice). */
export const FRAME_SIZE = 12;

/**
 * Palette for the generated art, keyed by the character used in each pixel-grid
 * row (`"."` is transparent). Colors are pulled from `theme` so the demo art
 * retunes with the presentation, with no raw hex literal here.
 */
const PALETTE: Readonly<Record<string, string | null>> = {
	".": null,
	g: theme.TILE.walkable,
	G: theme.TILE.grass,
	w: theme.TILE.water,
	W: theme.BATTLE_BACKDROP.sky,
	s: theme.TILE.solid,
	S: theme.TILE.ledge,
	b: theme.PLAYER.body,
	k: theme.PLAYER.skin,
	o: theme.PLAYER.facingNub,
	c: theme.NPC_COLOR.shop,
	p: theme.WINDOW_COLOR.panel,
	f: theme.WINDOW_COLOR.border,
};

/**
 * One hand-authored sprite: a grid of palette-keyed rows drawn at `(x, y)`.
 * Row length is the sprite width.
 */
interface Sprite {
	name: string;
	x: number;
	y: number;
	rows: readonly string[];
}

/** Overlays `patch` rows onto a copy of `base`, cell by cell (skip `"."`). */
function overlay(base: readonly string[], patch: readonly string[]): string[] {
	let rows = base.map((row) => row.split(""));
	for (let y = 0; y < patch.length && y < rows.length; y++) {
		let line = patch[y]!;
		for (let x = 0; x < line.length && x < rows[y]!.length; x++) {
			if (line[x] !== ".") rows[y]![x] = line[x]!;
		}
	}
	return rows.map((row) => row.join(""));
}

/** Fills a whole 16x16 cell with one palette key, as a solid tile base. */
function solid(key: string): string[] {
	return Array.from({ length: CELL }, () => key.repeat(CELL));
}

const GRASS = overlay(solid("g"), [
	"................",
	"...G......G.....",
	"................",
	".......G........",
	"................",
	"..G.........G...",
	"................",
	"................",
	".....G.....G....",
	"................",
	"...........G....",
	".G..............",
	"................",
	"........G.......",
	"...G............",
	"................",
]);

const TALL_GRASS = overlay(solid("G"), [
	"................",
	"g..g..g..g..g..g",
	"................",
	"................",
	"g..g..g..g..g..g",
	"................",
	"................",
	"g..g..g..g..g..g",
	"................",
	"................",
	"g..g..g..g..g..g",
	"................",
	"................",
	"g..g..g..g..g..g",
	"................",
	"................",
]);

const WATER = overlay(solid("w"), [
	"................",
	"..WW....WW......",
	"................",
	"........WW...WW.",
	"................",
	"WW...WW.........",
	"................",
	"....WW....WW....",
	"................",
	"WW......WW......",
	"................",
	"...WW.......WW..",
	"................",
	"WW....WW........",
	"................",
	".....WW....WW...",
]);

const WALL = overlay(solid("s"), [
	"ssssssssssssssss",
	"s..............s",
	"s..............s",
	"s......ss......s",
	"s......ss......s",
	"s..............s",
	"s..............s",
	"ssssssssssssssss",
	"s..............s",
	"s..............s",
	"s......ss......s",
	"s......ss......s",
	"s..............s",
	"s..............s",
	"s..............s",
	"ssssssssssssssss",
]);

const SAND = overlay(solid("S"), [
	"................",
	".....s..........",
	"................",
	"...........s....",
	"................",
	"..s.............",
	"................",
	"...........s....",
	"................",
	".......s........",
	"................",
	"...s............",
	"................",
	"............s...",
	"................",
	".....s..........",
]);

/**
 * The blocky character, one grid per facing plus a stepped variant: a torso
 * (`b`), a head (`k`), and a facing pixel (`o`), with legs shifted a pixel in
 * the stepped variant for a walk cycle.
 */
function character(facing: "down" | "up" | "left" | "right", stepped: boolean): string[] {
	let head = ["....kkkkkk......", "....kkkkkk......", "....koookk......"];
	if (facing === "up") head = ["....kkkkkk......", "....kkkkkk......", "....kkkkkk......"];
	if (facing === "left") head = ["....kkkkkk......", "....kkkkkk......", "...ookkkkk......"];
	if (facing === "right") head = ["....kkkkkk......", "....kkkkkk......", "....kkkkkoo....."];
	let legLeft = stepped ? "...bb....bbb...." : "...bbb...bb.....";
	return [
		"................",
		...head,
		"...bbbbbbbb.....",
		"..bbbbbbbbbb....",
		"..bbbbbbbbbb....",
		"..bbbbbbbbbb....",
		"..bbbbbbbbbb....",
		"...bbbbbbbb.....",
		"...bbbbbbbb.....",
		legLeft,
		"...bb....bbb....",
		"................",
		"................",
	];
}

/** A rounded creature silhouette in a 32x32 slot: a body with two eye pixels. */
const CREATURE: readonly string[] = [
	"..........cccccccccccc..........",
	"........cccccccccccccccc........",
	".......cccccccccccccccccc.......",
	"......cccccccccccccccccccc......",
	".....cccccccccccccccccccccc.....",
	"....cccccccccccccccccccccccc....",
	"....cccccccccccccccccccccccc....",
	"...cccccccccccccccccccccccccc...",
	"...cccccccccccccccccccccccccc...",
	"..cccccccccccccccccccccccccccc..",
	"..cccccccccccccccccccccccccccc..",
	"..cccccooooccccccccooooccccccc..",
	"..cccccooooccccccccooooccccccc..",
	"..cccccccccccccccccccccccccccc..",
	"..cccccccccccccccccccccccccccc..",
	"..cccccccccccccccccccccccccccc..",
	"..cccccccccccccccccccccccccccc..",
	"..cccccccccccccccccccccccccccc..",
	"...cccccccccccccccccccccccccc...",
	"...cccccccccccccccccccccccccc...",
	"....cccccccccccccccccccccccc....",
	"....cccccccccccccccccccccccc....",
	".....cccccccccccccccccccccc.....",
	"......cccccccccccccccccccc......",
	".......cccccccccccccccccc.......",
	"........cccccccccccccccc........",
	"..........cccccccccccc..........",
	"...........cccccccccc...........",
	"............cccccccc............",
	".............cccccc.............",
	"..............cccc..............",
	"...............cc...............",
];

/** A 12x12 window frame: a bordered panel a nine-slice can stretch. */
const WINDOW_FRAME: readonly string[] = [
	"ffffffffffff",
	"fppppppppppf",
	"fppppppppppf",
	"fppppppppppf",
	"fppppppppppf",
	"fppppppppppf",
	"fppppppppppf",
	"fppppppppppf",
	"fppppppppppf",
	"fppppppppppf",
	"fppppppppppf",
	"ffffffffffff",
];

/**
 * The static layout of the generated sheet: every sprite, its slot, and the
 * region name it is exposed under. This is pure data so the region map and the
 * canvas size are both derivable without drawing anything.
 */
export const PLACEHOLDER_LAYOUT: readonly Sprite[] = buildLayout();

/** Assembles the sprite table, packing tiles/character on a grid of cells. */
function buildLayout(): Sprite[] {
	let sprites: Sprite[] = [];
	let tiles: Array<[string, readonly string[]]> = [
		["tile.grass", GRASS],
		["tile.tall-grass", TALL_GRASS],
		["tile.water", WATER],
		["tile.wall", WALL],
		["tile.sand", SAND],
	];
	tiles.forEach(([name, rows], column) => {
		sprites.push({ name, x: column * CELL, y: 0, rows });
	});

	let facings: Array<"down" | "up" | "left" | "right"> = ["down", "up", "left", "right"];
	facings.forEach((facing, column) => {
		sprites.push({
			name: `hero.${facing}.0`,
			x: column * CELL,
			y: CELL,
			rows: character(facing, false),
		});
		sprites.push({
			name: `hero.${facing}.1`,
			x: column * CELL,
			y: CELL * 2,
			rows: character(facing, true),
		});
	});

	sprites.push({ name: "creature.body", x: 0, y: CELL * 3, rows: CREATURE });
	sprites.push({ name: "ui.window", x: CELL * 2 + 4, y: CELL * 3, rows: WINDOW_FRAME });

	return sprites;
}

/** The pixel width and height of the packed sheet, derived from the layout. */
export const PLACEHOLDER_SIZE: { width: number; height: number } = (() => {
	let width = 0;
	let height = 0;
	for (let sprite of PLACEHOLDER_LAYOUT) {
		let w = sprite.rows[0]?.length ?? 0;
		let h = sprite.rows.length;
		width = Math.max(width, sprite.x + w);
		height = Math.max(height, sprite.y + h);
	}
	return { width, height };
})();

/**
 * The static region map exposed by the generated atlas.
 *
 * Pure: derived from `PLACEHOLDER_LAYOUT` alone, so tests can assert the region
 * names and rects without touching a canvas.
 */
export function placeholderRegions(): Record<string, Rect> {
	let regions: Record<string, Rect> = {};
	for (let sprite of PLACEHOLDER_LAYOUT) {
		regions[sprite.name] = {
			x: sprite.x,
			y: sprite.y,
			w: sprite.rows[0]?.length ?? 0,
			h: sprite.rows.length,
		};
	}
	return regions;
}

/**
 * The animated regions exposed by the generated atlas.
 *
 * Each character facing gets a two-frame walk cycle referencing its `.0`/`.1`
 * regions. Pure and canvas-free so frame selection is testable.
 */
export function placeholderAnimations(): Record<
	string,
	{ frames: Rect[]; frameMs: number; loop: boolean }
> {
	let regions = placeholderRegions();
	let animations: Record<string, { frames: Rect[]; frameMs: number; loop: boolean }> = {};
	for (let facing of ["down", "up", "left", "right"] as const) {
		let a = regions[`hero.${facing}.0`];
		let b = regions[`hero.${facing}.1`];
		if (a && b) animations[`hero.${facing}.walk`] = { frames: [a, b], frameMs: 180, loop: true };
	}
	return animations;
}

/**
 * Paints the generated art to an offscreen canvas and returns its `Atlas`,
 * or `null` without a `document` (under test or pre-DOM), so callers fall
 * back to procedural drawing exactly as for a missing loaded atlas.
 */
export function buildPlaceholderAtlas(): Atlas | null {
	let canvas = globalThis.document?.createElement("canvas");
	if (!canvas) return null;
	canvas.width = PLACEHOLDER_SIZE.width;
	canvas.height = PLACEHOLDER_SIZE.height;
	let ctx = canvas.getContext("2d");
	if (!ctx) return null;
	ctx.imageSmoothingEnabled = false;

	for (let sprite of PLACEHOLDER_LAYOUT) paint(ctx, sprite);

	return new Atlas(canvas as unknown as AtlasSource, placeholderRegions(), placeholderAnimations());
}

/** Paints one sprite's lit pixels as 1x1 fills in its palette colors. */
function paint(ctx: CanvasRenderingContext2D, sprite: Sprite) {
	for (let y = 0; y < sprite.rows.length; y++) {
		let row = sprite.rows[y]!;
		for (let x = 0; x < row.length; x++) {
			let color = PALETTE[row[x]!];
			if (!color) continue;
			ctx.fillStyle = color;
			ctx.fillRect(sprite.x + x, sprite.y + y, 1, 1);
		}
	}
}
