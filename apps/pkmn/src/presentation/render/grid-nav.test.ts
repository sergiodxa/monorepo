/**
 * Tests for grid-aware cursor navigation.
 *
 * Covers the 2×2 move-menu case the battle uses (Right/Down from the top-left
 * cell), horizontal wrapping within a row, vertical wrapping between rows,
 * clamping onto a ragged final row (a 3-item grid), and the guards for empty or
 * single-column grids.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { gridNavigate } from "./grid-nav";

test("Right from move0 selects move1 in a 2x2 grid", () => {
	expect(gridNavigate(0, "right", 2, 4)).toBe(1);
});

test("Down from move0 selects move2 in a 2x2 grid", () => {
	expect(gridNavigate(0, "down", 2, 4)).toBe(2);
});

test("Left from move1 returns to move0", () => {
	expect(gridNavigate(1, "left", 2, 4)).toBe(0);
});

test("Up from move2 returns to move0", () => {
	expect(gridNavigate(2, "up", 2, 4)).toBe(0);
});

test("Right wraps within the row back to the first column", () => {
	expect(gridNavigate(1, "right", 2, 4)).toBe(0);
	expect(gridNavigate(3, "right", 2, 4)).toBe(2);
});

test("Left wraps within the row to the last column", () => {
	expect(gridNavigate(0, "left", 2, 4)).toBe(1);
	expect(gridNavigate(2, "left", 2, 4)).toBe(3);
});

test("Down from the bottom row wraps back to the top row", () => {
	expect(gridNavigate(2, "down", 2, 4)).toBe(0);
	expect(gridNavigate(3, "down", 2, 4)).toBe(1);
});

test("Up from the top row wraps to the bottom row", () => {
	expect(gridNavigate(0, "up", 2, 4)).toBe(2);
	expect(gridNavigate(1, "up", 2, 4)).toBe(3);
});

test("a 3-move grid clamps Down onto the last item instead of an empty cell", () => {
	// Layout: [0 1] / [2]. Down from move1 (col 1) has no cell below it, so it
	// clamps to the last populated index rather than selecting an empty slot.
	expect(gridNavigate(1, "down", 2, 3)).toBe(2);
});

test("a 3-move grid wraps horizontally within its ragged final row", () => {
	// The final row holds only move2; Right/Left stay on it.
	expect(gridNavigate(2, "right", 2, 3)).toBe(2);
	expect(gridNavigate(2, "left", 2, 3)).toBe(2);
});

test("a 3-move grid moves Up from the lone bottom cell to the top-left", () => {
	expect(gridNavigate(2, "up", 2, 3)).toBe(0);
});

test("an empty grid returns index 0", () => {
	expect(gridNavigate(0, "down", 2, 0)).toBe(0);
	expect(gridNavigate(5, "right", 2, 0)).toBe(0);
});

test("an out-of-range index is clamped before navigating", () => {
	expect(gridNavigate(99, "left", 2, 4)).toBe(2);
});

test("a single-column grid behaves like a vertical list", () => {
	expect(gridNavigate(0, "down", 1, 3)).toBe(1);
	expect(gridNavigate(2, "down", 1, 3)).toBe(0);
	expect(gridNavigate(0, "up", 1, 3)).toBe(2);
	// Horizontal moves in a one-column grid stay put (row has one cell).
	expect(gridNavigate(1, "right", 1, 3)).toBe(1);
	expect(gridNavigate(1, "left", 1, 3)).toBe(1);
});
