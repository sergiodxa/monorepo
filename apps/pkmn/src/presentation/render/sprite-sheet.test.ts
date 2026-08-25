/**
 * Tests for sprite sheets and frame-sequence animations.
 *
 * Exercises the frame-index-to-source math via a recording fake context that
 * only captures the source rectangle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { gridRegions, SpriteAnimation, SpriteSheet } from "./sprite-sheet";

/** A recording fake context that captures the source rect and transform state. */
function fakeContext() {
	let calls: Array<{ sx: number; sy: number }> = [];
	let transforms: string[] = [];
	let ctx = {
		calls,
		transforms,
		drawImage(_image: unknown, sx: number, sy: number) {
			calls.push({ sx, sy });
		},
		save() {
			transforms.push("save");
		},
		restore() {
			transforms.push("restore");
		},
		translate() {
			transforms.push("translate");
		},
		scale() {
			transforms.push("scale");
		},
	};
	return ctx;
}

/** A minimal image stub carrying only the width the sheet needs for its column count. */
function fakeImage(width: number): HTMLImageElement {
	return { width } as unknown as HTMLImageElement;
}

test("SpriteAnimation advances to the next frame once a frame's duration elapses", () => {
	let anim = new SpriteAnimation([10, 20, 30], 100);
	expect(anim.frame).toBe(10);
	anim.update(100);
	expect(anim.frame).toBe(20);
	anim.update(100);
	expect(anim.frame).toBe(30);
});

test("SpriteAnimation accumulates partial dt across updates before stepping", () => {
	let anim = new SpriteAnimation([10, 20], 100);
	anim.update(60);
	expect(anim.frame).toBe(10);
	anim.update(60);
	expect(anim.frame).toBe(20);
});

test("SpriteAnimation loops back to the first frame past the end", () => {
	let anim = new SpriteAnimation([1, 2], 100, true);
	anim.update(100);
	anim.update(100);
	expect(anim.frame).toBe(1);
	expect(anim.done).toBe(false);
});

test("SpriteAnimation one-shot holds the last frame and reports done", () => {
	let anim = new SpriteAnimation([1, 2], 100, false);
	expect(anim.done).toBe(false);
	anim.update(100);
	expect(anim.frame).toBe(2);
	expect(anim.done).toBe(true);
	anim.update(1000);
	expect(anim.frame).toBe(2);
	expect(anim.done).toBe(true);
});

test("SpriteAnimation reset returns to the first frame and clears elapsed time", () => {
	let anim = new SpriteAnimation([1, 2, 3], 100);
	anim.update(250);
	expect(anim.frame).not.toBe(1);
	anim.reset();
	expect(anim.frame).toBe(1);
	anim.update(60);
	expect(anim.frame).toBe(1);
});

test("SpriteAnimation with a single frame never advances", () => {
	let anim = new SpriteAnimation([7], 100);
	anim.update(1000);
	expect(anim.frame).toBe(7);
});

test("SpriteSheet with no frames yields 0 as a safe default", () => {
	let anim = new SpriteAnimation([], 100);
	expect(anim.frame).toBe(0);
});

test("SpriteSheet maps a frame index to the right source cell (columns from width)", () => {
	let sheet = new SpriteSheet(fakeImage(64), 16, 16);
	let ctx = fakeContext();
	sheet.draw(ctx as unknown as CanvasRenderingContext2D, 5, 0, 0);
	expect(ctx.calls[0]).toEqual({ sx: 16, sy: 16 });
});

test("SpriteSheet clamps a zero-width image to at least one column", () => {
	let sheet = new SpriteSheet(fakeImage(0), 16, 16);
	let ctx = fakeContext();
	sheet.draw(ctx as unknown as CanvasRenderingContext2D, 3, 0, 0);
	expect(ctx.calls[0]).toEqual({ sx: 0, sy: 48 });
});

test("SpriteSheet flipX wraps the blit in a mirrored transform", () => {
	let sheet = new SpriteSheet(fakeImage(64), 16, 16);
	let ctx = fakeContext();
	sheet.draw(ctx as unknown as CanvasRenderingContext2D, 0, 0, 0, true);
	expect(ctx.transforms).toEqual(["save", "translate", "scale", "restore"]);
});

test("gridRegions lays a grid out left-to-right then top-to-bottom", () => {
	let regions = gridRegions(3, 2, 16, 16);
	expect(Object.keys(regions)).toHaveLength(6);
	expect(regions["frame.0"]).toEqual({ x: 0, y: 0, w: 16, h: 16 });
	expect(regions["frame.2"]).toEqual({ x: 32, y: 0, w: 16, h: 16 });
	expect(regions["frame.3"]).toEqual({ x: 0, y: 16, w: 16, h: 16 });
	expect(regions["frame.5"]).toEqual({ x: 32, y: 16, w: 16, h: 16 });
});

test("gridRegions honors a custom region-name prefix", () => {
	let regions = gridRegions(2, 1, 8, 8, "hero.down.");
	expect(regions["hero.down.0"]).toEqual({ x: 0, y: 0, w: 8, h: 8 });
	expect(regions["hero.down.1"]).toEqual({ x: 8, y: 0, w: 8, h: 8 });
});

test("gridRegions clamps degenerate dimensions to at least one cell", () => {
	let regions = gridRegions(0, 0, 16, 16);
	expect(Object.keys(regions)).toEqual(["frame.0"]);
});
