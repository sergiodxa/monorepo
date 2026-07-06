/**
 * Tests for the cardinal-direction helpers.
 *
 * Covers the three pure lookups every facing feeds into: the grid delta a step
 * in a direction adds, the opposite facing, and the sprite-sheet row a facing
 * maps to. Each helper is asserted for all four directions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { type Direction, directionDelta, directionRow, oppositeDirection } from "./direction";

let ALL_DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

test("directionDelta returns the unit tile step for each direction", () => {
	expect(directionDelta("up")).toEqual({ dx: 0, dy: -1 });
	expect(directionDelta("down")).toEqual({ dx: 0, dy: 1 });
	expect(directionDelta("left")).toEqual({ dx: -1, dy: 0 });
	expect(directionDelta("right")).toEqual({ dx: 1, dy: 0 });
});

test("oppositeDirection maps each facing to its inverse", () => {
	expect(oppositeDirection("up")).toBe("down");
	expect(oppositeDirection("down")).toBe("up");
	expect(oppositeDirection("left")).toBe("right");
	expect(oppositeDirection("right")).toBe("left");
});

test("oppositeDirection is its own inverse for every direction", () => {
	for (let direction of ALL_DIRECTIONS) {
		expect(oppositeDirection(oppositeDirection(direction))).toBe(direction);
	}
});

test("directionRow maps each facing to the character sheet row", () => {
	expect(directionRow("down")).toBe(0);
	expect(directionRow("left")).toBe(1);
	expect(directionRow("right")).toBe(2);
	expect(directionRow("up")).toBe(3);
});

test("directionRow yields a distinct row per direction", () => {
	let rows = ALL_DIRECTIONS.map(directionRow);
	expect(new Set(rows).size).toBe(4);
});
