/**
 * Tests for sprite sheets and frame-sequence animations.
 *
 * Covers `SpriteAnimation` frame stepping by dt, looping vs one-shot `done`, and
 * `reset`. For `SpriteSheet` it exercises the frame-index-to-source math by
 * driving `draw` against a recording fake context that only captures the source
 * rectangle — the real canvas blit is not tested.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { SpriteAnimation, SpriteSheet } from "./sprite-sheet";

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
	anim.update(100); // -> frame 2
	anim.update(100); // wraps -> frame 1
	expect(anim.frame).toBe(1);
	expect(anim.done).toBe(false);
});

test("SpriteAnimation one-shot holds the last frame and reports done", () => {
	let anim = new SpriteAnimation([1, 2], 100, false);
	expect(anim.done).toBe(false);
	anim.update(100);
	expect(anim.frame).toBe(2);
	expect(anim.done).toBe(true);
	anim.update(1000); // stays on the last frame
	expect(anim.frame).toBe(2);
	expect(anim.done).toBe(true);
});

test("SpriteAnimation reset returns to the first frame and clears elapsed time", () => {
	let anim = new SpriteAnimation([1, 2, 3], 100);
	anim.update(250);
	expect(anim.frame).not.toBe(1);
	anim.reset();
	expect(anim.frame).toBe(1);
	// A fresh partial update should not immediately step after reset.
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
	// 64px wide / 16px frames = 4 columns.
	let sheet = new SpriteSheet(fakeImage(64), 16, 16);
	let ctx = fakeContext();
	// Frame 5 -> column 1, row 1.
	sheet.draw(ctx as unknown as CanvasRenderingContext2D, 5, 0, 0);
	expect(ctx.calls[0]).toEqual({ sx: 16, sy: 16 });
});

test("SpriteSheet clamps a zero-width image to at least one column", () => {
	let sheet = new SpriteSheet(fakeImage(0), 16, 16);
	let ctx = fakeContext();
	// With 1 column, frame 3 -> column 0, row 3.
	sheet.draw(ctx as unknown as CanvasRenderingContext2D, 3, 0, 0);
	expect(ctx.calls[0]).toEqual({ sx: 0, sy: 48 });
});

test("SpriteSheet flipX wraps the blit in a mirrored transform", () => {
	let sheet = new SpriteSheet(fakeImage(64), 16, 16);
	let ctx = fakeContext();
	sheet.draw(ctx as unknown as CanvasRenderingContext2D, 0, 0, 0, true);
	expect(ctx.transforms).toEqual(["save", "translate", "scale", "restore"]);
});
