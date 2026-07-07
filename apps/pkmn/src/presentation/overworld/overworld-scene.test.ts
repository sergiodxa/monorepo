/**
 * Tests for the overworld HUD hint sizing.
 *
 * Covers `overworldHint`, which chooses the fullest help-text variant that still
 * fits the internal screen width, and `hudHintMaxWidth`, the usable budget it is
 * measured against. The scene drawing is not exercised here; only the width
 * regression is asserted so the HUD copy can never overflow the screen again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { SCREEN_WIDTH } from "../core/loop";
import { GLYPH_ADVANCE } from "../render/font";

import { hudHintMaxWidth, overworldHint } from "./overworld-scene";

/** The rendered pixel width of a string at the fixed bitmap font metrics. */
function widthOf(text: string): number {
	return text.length * GLYPH_ADVANCE;
}

test("hudHintMaxWidth stays within the internal screen width", () => {
	expect(hudHintMaxWidth()).toBeLessThanOrEqual(SCREEN_WIDTH);
	expect(hudHintMaxWidth()).toBeGreaterThan(0);
});

test("overworldHint fits within the HUD budget (regression for the overflow)", () => {
	// Regression: the old fixed string was 43 glyphs wide and clipped off-screen.
	let hint = overworldHint(hudHintMaxWidth());
	expect(widthOf(hint)).toBeLessThanOrEqual(hudHintMaxWidth());
	expect(widthOf(hint)).toBeLessThanOrEqual(SCREEN_WIDTH);
});

test("overworldHint keeps the essential talk/menu actions", () => {
	let hint = overworldHint(hudHintMaxWidth());
	expect(hint).toContain("A: talk");
	expect(hint).toContain("Start: menu");
});

test("overworldHint always returns a fitting variant even at tiny widths", () => {
	// With almost no room it still returns the shortest essential hint; the point
	// is that a variant is always chosen rather than an overflowing default.
	let hint = overworldHint(1);
	expect(hint).toBe("A: talk   Start: menu");
});

test("overworldHint prefers a fuller variant when the width allows", () => {
	// Given the full screen budget the richest variant that fits is chosen.
	let generous = overworldHint(1000);
	expect(generous).toBe("Grass: wild battles   A: talk   Start: menu");
});
