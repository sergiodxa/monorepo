/**
 * Tests for the generated demo atlas: region names lie within the derived
 * sheet bounds, and character walk animations reference their frames.
 * `buildPlaceholderAtlas` returns null under the test runner (no DOM) so
 * renderers fall back to procedural drawing, and that is asserted too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import {
	buildPlaceholderAtlas,
	CELL,
	placeholderAnimations,
	placeholderRegions,
	PLACEHOLDER_SIZE,
} from "./placeholder-atlas";

test("placeholderRegions exposes the expected tile, character, creature, and UI names", () => {
	let regions = placeholderRegions();
	for (let name of [
		"tile.grass",
		"tile.tall-grass",
		"tile.water",
		"tile.wall",
		"tile.sand",
		"hero.down.0",
		"hero.up.0",
		"hero.left.0",
		"hero.right.0",
		"hero.down.1",
		"creature.body",
		"ui.window",
	]) {
		expect(regions[name], name).toBeDefined();
	}
});

test("each tile region is one TILE_SIZE cell", () => {
	let regions = placeholderRegions();
	for (let name of ["tile.grass", "tile.tall-grass", "tile.water", "tile.wall", "tile.sand"]) {
		expect(regions[name]).toMatchObject({ w: CELL, h: CELL });
	}
});

test("the creature region is a 32x32 slot", () => {
	let regions = placeholderRegions();
	expect(regions["creature.body"]).toMatchObject({ w: 32, h: 32 });
});

test("every region lies within the derived sheet bounds", () => {
	let regions = placeholderRegions();
	for (let [name, rect] of Object.entries(regions)) {
		expect(rect.x + rect.w, `${name} right edge`).toBeLessThanOrEqual(PLACEHOLDER_SIZE.width);
		expect(rect.y + rect.h, `${name} bottom edge`).toBeLessThanOrEqual(PLACEHOLDER_SIZE.height);
		expect(rect.x, `${name} x`).toBeGreaterThanOrEqual(0);
		expect(rect.y, `${name} y`).toBeGreaterThanOrEqual(0);
	}
});

test("each character facing has a two-frame walk animation over its frames", () => {
	let regions = placeholderRegions();
	let animations = placeholderAnimations();
	for (let facing of ["down", "up", "left", "right"] as const) {
		let anim = animations[`hero.${facing}.walk`];
		expect(anim, facing).toBeDefined();
		expect(anim!.frames).toEqual([regions[`hero.${facing}.0`]!, regions[`hero.${facing}.1`]!]);
		expect(anim!.frameMs).toBeGreaterThan(0);
	}
});

test("buildPlaceholderAtlas degrades to null without a document (test runner)", () => {
	expect(globalThis.document).toBeUndefined();
	expect(buildPlaceholderAtlas()).toBeNull();
});
