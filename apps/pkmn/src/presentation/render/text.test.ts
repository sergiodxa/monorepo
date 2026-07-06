/**
 * Tests for the text layout helpers and the typewriter.
 *
 * Covers `Typewriter` reveal over time, `skip`, `done`, and `visibleText`, plus
 * `wrapText` and `measureText` word wrapping to a pixel width. Text measurement
 * is driven by a stub context whose `measureText` returns a fixed per-character
 * width, so wrapping is asserted without a real canvas; `drawText`/`fillText`
 * drawing is not tested.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { measureText, Typewriter, wrapText } from "./text";

/** Stub context measuring text at 6px per character, enough to drive wrapping. */
let CTX = {
	measureText: (text: string) => ({ width: text.length * 6 }),
	font: "",
} as unknown as CanvasRenderingContext2D;

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

test("measureText returns the stubbed pixel width for the string", () => {
	expect(measureText(CTX, "abcd")).toBe(24);
});

test("wrapText breaks lines on spaces at the pixel-width limit", () => {
	// At 6px/char: "aaa bbb" is 42px (fits a 48px limit), but adding " ccc" (66px) does not.
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
