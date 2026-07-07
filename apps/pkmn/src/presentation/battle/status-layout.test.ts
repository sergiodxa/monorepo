/**
 * Tests for the battle status-box and action-menu layout math.
 *
 * Covers the HP fraction fitting inside the status box for one-, two-, and
 * three-digit values, the stacked row layout keeping the HP number above the bar
 * and inside the frame, and the column-width helper sizing a column to the widest
 * label so the "Creatures"/"Run" labels never collide.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { GLYPH_HEIGHT } from "../render/font";

import { columnWidthFor, fitsWidth, hpText, statusBoxLayout, textWidth } from "./status-layout";

/** The inner width the status box gives the HP fraction (bar width, 92px). */
const HP_INNER_WIDTH = 92;

/** The bar's pixel height, mirrored from `HpBar.HEIGHT`. */
const BAR_HEIGHT = 5;

test("a one- and two-digit HP fraction fits inside the status box", () => {
	expect(fitsWidth(hpText(12, 12), HP_INNER_WIDTH)).toBe(true);
	expect(fitsWidth(hpText(8, 100), HP_INNER_WIDTH)).toBe(true);
});

test("a three-digit HP fraction still fits inside the status box", () => {
	expect(fitsWidth(hpText(999, 999), HP_INNER_WIDTH)).toBe(true);
});

test("the HP number row sits above the bar and inside the box height", () => {
	let layout = statusBoxLayout(true, BAR_HEIGHT);
	// Name is the top row, the HP number is below it, the bar below that.
	expect(layout.nameY).toBeLessThan(layout.hpTextY);
	expect(layout.hpTextY).toBeLessThan(layout.barY);
	// The HP text glyphs end before the bar starts (no overlap).
	expect(layout.hpTextY + GLYPH_HEIGHT).toBeLessThanOrEqual(layout.barY);
	// The bar (and thus the whole content) ends inside the box.
	expect(layout.barY + BAR_HEIGHT).toBeLessThanOrEqual(layout.height);
});

test("hiding the numbers drops the HP-text row, yielding a shorter box", () => {
	let withNumbers = statusBoxLayout(true, BAR_HEIGHT);
	let without = statusBoxLayout(false, BAR_HEIGHT);
	expect(without.height).toBeLessThan(withNumbers.height);
	expect(without.barY + BAR_HEIGHT).toBeLessThanOrEqual(without.height);
});

test("a column is wide enough for the longest label plus padding", () => {
	let labels = ["Fight", "Bag", "Creatures", "Run"] as const;
	let width = columnWidthFor(labels, 10);
	// The widest label ("Creatures") fits with room to spare for the padding.
	expect(width).toBe(textWidth("Creatures") + 10);
	expect(fitsWidth("Creatures", width)).toBe(true);
});

test("the Creatures label fits its column so it cannot overrun into Run", () => {
	let labels = ["Fight", "Bag", "Creatures", "Run"] as const;
	let stride = columnWidthFor(labels, 14);
	// "Creatures" in column 0 ends before column 1's label begins one stride over.
	expect(textWidth("Creatures")).toBeLessThan(stride);
});
