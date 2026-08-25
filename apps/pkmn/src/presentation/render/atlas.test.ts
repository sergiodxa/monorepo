/**
 * Tests for the named-region sprite atlas.
 *
 * Covers region lookup, animated-frame selection over time, and `drawSprite`'s
 * blitting math via a recording fake context, including the safe no-ops for a
 * missing region or a null atlas.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import {
	animationRect,
	Atlas,
	type AtlasAnimation,
	type AtlasSource,
	drawAnimatedSprite,
	drawSprite,
	frameIndex,
	regionRect,
	type Rect,
} from "./atlas";

/** A recording fake context capturing each blit's source rect, dest, and transforms. */
function fakeContext() {
	let calls: Array<{
		sx: number;
		sy: number;
		sw: number;
		sh: number;
		dx: number;
		dy: number;
		dw: number;
		dh: number;
	}> = [];
	let transforms: string[] = [];
	let ctx = {
		calls,
		transforms,
		drawImage(
			_image: unknown,
			sx: number,
			sy: number,
			sw: number,
			sh: number,
			dx: number,
			dy: number,
			dw: number,
			dh: number,
		) {
			calls.push({ sx, sy, sw, sh, dx, dy, dw, dh });
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

/** A minimal source stub; the atlas only forwards it to drawImage. */
const SOURCE = { width: 64, height: 64 } as unknown as AtlasSource;

const REGIONS: Record<string, Rect> = {
	"tile.grass": { x: 0, y: 0, w: 16, h: 16 },
	"hero.down.0": { x: 16, y: 0, w: 16, h: 16 },
};

test("regionRect returns the rect for a known region and null otherwise", () => {
	expect(regionRect(REGIONS, "tile.grass")).toEqual({ x: 0, y: 0, w: 16, h: 16 });
	expect(regionRect(REGIONS, "missing")).toBeNull();
});

test("frameIndex steps a looping animation and wraps past the end", () => {
	let anim: AtlasAnimation = {
		frames: [
			{ x: 0, y: 0, w: 8, h: 8 },
			{ x: 8, y: 0, w: 8, h: 8 },
		],
		frameMs: 100,
	};
	expect(frameIndex(anim, 0)).toBe(0);
	expect(frameIndex(anim, 99)).toBe(0);
	expect(frameIndex(anim, 100)).toBe(1);
	expect(frameIndex(anim, 200)).toBe(0);
	expect(frameIndex(anim, 350)).toBe(1);
});

test("frameIndex clamps and holds the last frame for a one-shot animation", () => {
	let anim: AtlasAnimation = {
		frames: [
			{ x: 0, y: 0, w: 8, h: 8 },
			{ x: 8, y: 0, w: 8, h: 8 },
			{ x: 16, y: 0, w: 8, h: 8 },
		],
		frameMs: 100,
		loop: false,
	};
	expect(frameIndex(anim, 100)).toBe(1);
	expect(frameIndex(anim, 200)).toBe(2);
	expect(frameIndex(anim, 5000)).toBe(2);
});

test("frameIndex treats a single-frame animation as static", () => {
	let anim: AtlasAnimation = { frames: [{ x: 0, y: 0, w: 8, h: 8 }], frameMs: 100 };
	expect(frameIndex(anim, 999)).toBe(0);
});

test("animationRect resolves the current frame's rect, or null when empty", () => {
	let anim: AtlasAnimation = {
		frames: [
			{ x: 0, y: 0, w: 8, h: 8 },
			{ x: 8, y: 0, w: 8, h: 8 },
		],
		frameMs: 100,
	};
	expect(animationRect(anim, 100)).toEqual({ x: 8, y: 0, w: 8, h: 8 });
	expect(animationRect({ frames: [], frameMs: 100 }, 0)).toBeNull();
});

test("drawSprite blits the region's source rect at the destination", () => {
	let atlas = new Atlas(SOURCE, REGIONS);
	let ctx = fakeContext();
	let drawn = drawSprite(ctx, atlas, "hero.down.0", 40, 24);
	expect(drawn).toBe(true);
	expect(ctx.calls[0]).toEqual({ sx: 16, sy: 0, sw: 16, sh: 16, dx: 40, dy: 24, dw: 16, dh: 16 });
});

test("drawSprite applies an integer scale to the destination size", () => {
	let atlas = new Atlas(SOURCE, REGIONS);
	let ctx = fakeContext();
	drawSprite(ctx, atlas, "tile.grass", 0, 0, { scale: 3 });
	expect(ctx.calls[0]).toMatchObject({ sw: 16, sh: 16, dw: 48, dh: 48 });
});

test("drawSprite wraps a flipped blit in a mirrored transform", () => {
	let atlas = new Atlas(SOURCE, REGIONS);
	let ctx = fakeContext();
	drawSprite(ctx, atlas, "tile.grass", 10, 10, { flipX: true });
	expect(ctx.transforms).toEqual(["save", "translate", "scale", "restore"]);
	expect(ctx.calls[0]).toMatchObject({ dx: 0, dy: 0 });
});

test("drawSprite is a safe no-op for a missing region", () => {
	let atlas = new Atlas(SOURCE, REGIONS);
	let ctx = fakeContext();
	let drawn = drawSprite(ctx, atlas, "does.not.exist", 0, 0);
	expect(drawn).toBe(false);
	expect(ctx.calls).toHaveLength(0);
});

test("drawSprite is a safe no-op for a null atlas", () => {
	let ctx = fakeContext();
	let drawn = drawSprite(ctx, null, "tile.grass", 0, 0);
	expect(drawn).toBe(false);
	expect(ctx.calls).toHaveLength(0);
});

test("drawAnimatedSprite blits the frame that is showing at the elapsed time", () => {
	let atlas = new Atlas(SOURCE, REGIONS, {
		"hero.down.walk": {
			frames: [
				{ x: 16, y: 0, w: 16, h: 16 },
				{ x: 32, y: 0, w: 16, h: 16 },
			],
			frameMs: 100,
		},
	});
	let ctx = fakeContext();
	drawAnimatedSprite(ctx, atlas, "hero.down.walk", 100, 0, 0);
	expect(ctx.calls[0]).toMatchObject({ sx: 32, sy: 0 });
});

test("drawAnimatedSprite no-ops for an unknown animation", () => {
	let atlas = new Atlas(SOURCE, REGIONS);
	let ctx = fakeContext();
	expect(drawAnimatedSprite(ctx, atlas, "missing.walk", 0, 0, 0)).toBe(false);
	expect(ctx.calls).toHaveLength(0);
});

test("Atlas reports region and animation membership", () => {
	let atlas = new Atlas(SOURCE, REGIONS, {
		"hero.down.walk": { frames: [{ x: 0, y: 0, w: 1, h: 1 }], frameMs: 10 },
	});
	expect(atlas.hasRegion("tile.grass")).toBe(true);
	expect(atlas.hasRegion("nope")).toBe(false);
	expect(atlas.hasAnimation("hero.down.walk")).toBe(true);
	expect(atlas.hasAnimation("nope")).toBe(false);
});
