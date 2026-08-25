/**
 * Tests for the original bitmap font data and its glyph blitter.
 *
 * Verifies every glyph is well-formed, that `glyphFor` falls back to the box
 * glyph for unknown characters, and that `blitGlyph`/`blitString` emit one
 * `fillRect` per lit pixel — asserted against a fake context, no real canvas needed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import {
	blitGlyph,
	blitString,
	FALLBACK_GLYPH,
	GLYPH_ADVANCE,
	GLYPH_HEIGHT,
	GLYPH_WIDTH,
	glyphFor,
	GLYPHS,
} from "./font";

/** A fake glyph context that records every `fillRect` call as `[x, y, w, h]`. */
function fakeContext() {
	let calls: [number, number, number, number][] = [];
	return {
		calls,
		fillRect(x: number, y: number, w: number, h: number) {
			calls.push([x, y, w, h]);
		},
	};
}

/** Counts the lit ("non-zero") pixels across a glyph's rows. */
function litPixels(rows: readonly string[]): number {
	let count = 0;
	for (let row of rows) for (let pixel of row) if (pixel !== "0") count++;
	return count;
}

test("every glyph has the exact row and column dimensions", () => {
	for (let [char, rows] of Object.entries(GLYPHS)) {
		expect(rows.length, `${char} row count`).toBe(GLYPH_HEIGHT);
		for (let row of rows) expect(row.length, `${char} row width`).toBe(GLYPH_WIDTH);
	}
});

test("the fallback glyph is well-formed", () => {
	expect(FALLBACK_GLYPH.length).toBe(GLYPH_HEIGHT);
	for (let row of FALLBACK_GLYPH) expect(row.length).toBe(GLYPH_WIDTH);
});

test("glyphFor returns the defined glyph for a known character", () => {
	expect(glyphFor("A")).toBe(GLYPHS.A!);
});

test("glyphFor falls back to the box glyph for an unknown character", () => {
	expect(glyphFor("☃")).toBe(FALLBACK_GLYPH);
});

test("the space glyph has no lit pixels so it only advances the cursor", () => {
	expect(litPixels(GLYPHS[" "]!)).toBe(0);
});

test("blitGlyph fills one rect per lit pixel of a known glyph", () => {
	let ctx = fakeContext();
	blitGlyph(ctx, "A", 0, 0);
	expect(ctx.calls.length).toBe(litPixels(GLYPHS.A!));
});

test("blitGlyph places lit pixels at the glyph's row and column offsets", () => {
	let ctx = fakeContext();
	blitGlyph(ctx, "!", 10, 20);
	expect(ctx.calls).toEqual([
		[12, 20, 1, 1],
		[12, 21, 1, 1],
		[12, 22, 1, 1],
		[12, 23, 1, 1],
		[12, 24, 1, 1],
		[12, 26, 1, 1],
	]);
});

test("blitGlyph on an unknown character draws the fallback box", () => {
	let ctx = fakeContext();
	blitGlyph(ctx, "☃", 0, 0);
	expect(ctx.calls.length).toBe(litPixels(FALLBACK_GLYPH));
});

test("blitString advances each glyph by one GLYPH_ADVANCE", () => {
	let ctx = fakeContext();
	blitString(ctx, "!!", 0, 0);
	let firstX = ctx.calls.slice(0, 6).map((c) => c[0]);
	let secondX = ctx.calls.slice(6).map((c) => c[0]);
	expect(firstX.every((x) => x === 2)).toBe(true);
	expect(secondX.every((x) => x === 2 + GLYPH_ADVANCE)).toBe(true);
});

test("blitString draws nothing for spaces", () => {
	let ctx = fakeContext();
	blitString(ctx, "   ", 0, 0);
	expect(ctx.calls.length).toBe(0);
});
