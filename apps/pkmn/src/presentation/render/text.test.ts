/**
 * Tests for the text layout helpers and the typewriter.
 *
 * Covers `Typewriter` reveal over time, `skip`, `done`, and `visibleText`, plus
 * `measureText`/`wrapText` word wrapping to a pixel width and `drawText`
 * alignment. Measurement now comes from the fixed bitmap-font metrics
 * (`GLYPH_ADVANCE` per character) rather than the canvas, so a `ctx` is only needed
 * for its interface; drawing is asserted against a fake context that records
 * `fillRect` calls, without a real canvas.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import { GLYPH_ADVANCE } from "./font";
import { drawText, measureText, Typewriter, wrapText } from "./text";

/**
 * A fake context recording `fillRect` and `fillStyle`. Measurement no longer reads
 * `ctx.measureText`, so the metrics are fixed at `GLYPH_ADVANCE` (6px) per glyph.
 */
function fakeContext() {
	let calls: [number, number, number, number][] = [];
	return {
		calls,
		fillStyle: "",
		fillRect(x: number, y: number, w: number, h: number) {
			calls.push([x, y, w, h]);
		},
	} as unknown as CanvasRenderingContext2D & {
		calls: [number, number, number, number][];
	};
}

/** A bare stub standing in for a context where only the type matters. */
let CTX = fakeContext();

test("Typewriter reveals characters over time at its rate", () => {
	let writer = new Typewriter("hello", 40); // 40 chars/sec -> 25ms/char
	expect(writer.visibleText).toBe("");
	writer.update(50); // 2 chars
	expect(writer.visibleText).toBe("he");
	writer.update(50); // 4 chars
	expect(writer.visibleText).toBe("hell");
});

test("Typewriter reports done only once the whole string is revealed", () => {
	let writer = new Typewriter("hi", 40);
	expect(writer.done).toBe(false);
	writer.update(25); // 1 char
	expect(writer.done).toBe(false);
	writer.update(25); // 2 chars
	expect(writer.visibleText).toBe("hi");
	expect(writer.done).toBe(true);
});

test("Typewriter skip reveals the full string immediately", () => {
	let writer = new Typewriter("hello world", 40);
	writer.skip();
	expect(writer.visibleText).toBe("hello world");
	expect(writer.done).toBe(true);
});

test("Typewriter never over-reveals past the string length", () => {
	let writer = new Typewriter("hi", 40);
	writer.update(10_000);
	expect(writer.visibleText).toBe("hi");
	expect(writer.done).toBe(true);
});

test("Typewriter on an empty string is done from the start", () => {
	let writer = new Typewriter("", 40);
	expect(writer.done).toBe(true);
	expect(writer.visibleText).toBe("");
});

test("measureText returns a fixed GLYPH_ADVANCE per character", () => {
	expect(measureText(CTX, "abcd")).toBe(4 * GLYPH_ADVANCE); // 24 at 6px/glyph.
	expect(measureText(CTX, "")).toBe(0);
});

test("wrapText breaks lines on spaces at the pixel-width limit", () => {
	// At 6px/glyph: "aaa bbb" is 42px (fits a 48px limit), but "aaa bbb ccc" (66px) does not.
	let lines = wrapText(CTX, "aaa bbb ccc", 48);
	expect(lines).toEqual(["aaa bbb", "ccc"]);
});

test("wrapText keeps a paragraph on one line when it fits", () => {
	let lines = wrapText(CTX, "ab cd", 120);
	expect(lines).toEqual(["ab cd"]);
});

test("wrapText preserves explicit newlines as separate lines", () => {
	let lines = wrapText(CTX, "one\ntwo", 120);
	expect(lines).toEqual(["one", "two"]);
});

test("wrapText places an over-long single word on its own line", () => {
	// The word alone exceeds the limit but cannot be broken further.
	let lines = wrapText(CTX, "short verylongword", 30);
	expect(lines).toEqual(["short", "verylongword"]);
});

test("drawText left-aligns from x and applies the color", () => {
	let ctx = fakeContext();
	drawText(ctx, "!", 10, 0, { color: "#abcdef" });
	expect(ctx.fillStyle).toBe("#abcdef");
	// "!" lights column 2, so the leftmost rect is at x = 10 + 2.
	expect(ctx.calls.every(([x]) => x >= 10)).toBe(true);
	expect(Math.min(...ctx.calls.map(([x]) => x))).toBe(12);
});

test("drawText right-aligns by shifting the whole run left of x", () => {
	let ctx = fakeContext();
	drawText(ctx, "!", 100, 0, { align: "right" });
	// A one-glyph run is GLYPH_ADVANCE wide, so it starts at x - GLYPH_ADVANCE.
	expect(Math.min(...ctx.calls.map(([x]) => x))).toBe(100 - GLYPH_ADVANCE + 2);
});

test("drawText center-aligns around x", () => {
	let ctx = fakeContext();
	drawText(ctx, "!", 100, 0, { align: "center" });
	// One glyph centered: left edge at x - GLYPH_ADVANCE / 2, lit column at +2.
	expect(Math.min(...ctx.calls.map(([x]) => x))).toBe(Math.round(100 - GLYPH_ADVANCE / 2) + 2);
});
