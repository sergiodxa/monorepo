/**
 * Verifies the pure {@link PixelGrid} model that backs the sprite editor: pixels
 * default to transparent, set/get/clear round-trip RGBA values, channels are
 * clamped, out-of-bounds access is ignored/transparent, resize preserves the
 * overlapping region while filling new pixels with transparency, and serialize
 * returns an independent row-major RGBA copy. No canvas is involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { MAX_DIMENSION, PixelGrid } from "./pixel-grid";

describe("PixelGrid construction", () => {
	test("exposes its dimensions", () => {
		let grid = new PixelGrid(16, 32);
		expect(grid.width).toBe(16);
		expect(grid.height).toBe(32);
	});

	test("every pixel defaults to fully transparent", () => {
		let grid = new PixelGrid(4, 4);
		for (let y = 0; y < grid.height; y++) {
			for (let x = 0; x < grid.width; x++) {
				expect(grid.get(x, y)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
			}
		}
	});

	let badDimensions: Array<[label: string, width: number, height: number]> = [
		["zero width", 0, 8],
		["negative height", 8, -1],
		["non-integer", 8.5, 8],
		["over the cap", MAX_DIMENSION + 1, 8],
	];

	for (let [label, width, height] of badDimensions) {
		test(`rejects ${label}`, () => {
			expect(() => new PixelGrid(width, height)).toThrow(RangeError);
		});
	}
});

describe("PixelGrid set/get", () => {
	test("round-trips a painted color with forced opaque alpha", () => {
		let grid = new PixelGrid(8, 8);
		grid.set(2, 3, { r: 10, g: 20, b: 30 });
		expect(grid.get(2, 3)).toEqual({ r: 10, g: 20, b: 30, a: 255 });
	});

	test("clamps and rounds out-of-range channels", () => {
		let grid = new PixelGrid(2, 2);
		grid.set(0, 0, { r: -5, g: 300, b: 12.6 });
		expect(grid.get(0, 0)).toEqual({ r: 0, g: 255, b: 13, a: 255 });
	});

	test("ignores writes outside the bounds", () => {
		let grid = new PixelGrid(4, 4);
		grid.set(-1, 0, { r: 1, g: 2, b: 3 });
		grid.set(4, 0, { r: 1, g: 2, b: 3 });
		grid.set(0, 4, { r: 1, g: 2, b: 3 });
		// Nothing painted, buffer stays all-transparent.
		expect(grid.serialize().every((byte) => byte === 0)).toBe(true);
	});

	test("reads out-of-bounds coordinates as transparent", () => {
		let grid = new PixelGrid(4, 4);
		expect(grid.get(-1, -1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
		expect(grid.get(10, 10)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
	});

	test("inBounds reflects the grid extent", () => {
		let grid = new PixelGrid(4, 4);
		expect(grid.inBounds(0, 0)).toBe(true);
		expect(grid.inBounds(3, 3)).toBe(true);
		expect(grid.inBounds(4, 0)).toBe(false);
		expect(grid.inBounds(1.5, 0)).toBe(false);
	});
});

describe("PixelGrid clearing", () => {
	test("clearPixel resets a single pixel to transparent", () => {
		let grid = new PixelGrid(4, 4);
		grid.set(1, 1, { r: 255, g: 255, b: 255 });
		grid.clearPixel(1, 1);
		expect(grid.get(1, 1)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
	});

	test("clear resets the whole buffer to transparent", () => {
		let grid = new PixelGrid(4, 4);
		grid.set(0, 0, { r: 1, g: 2, b: 3 });
		grid.set(3, 3, { r: 4, g: 5, b: 6 });
		grid.clear();
		expect(grid.serialize().every((byte) => byte === 0)).toBe(true);
	});
});

describe("PixelGrid resize", () => {
	test("preserves the overlapping top-left region when growing", () => {
		let grid = new PixelGrid(2, 2);
		grid.set(0, 0, { r: 100, g: 0, b: 0 });
		grid.set(1, 1, { r: 0, g: 0, b: 200 });
		grid.resize(4, 4);

		expect(grid.width).toBe(4);
		expect(grid.height).toBe(4);
		expect(grid.get(0, 0)).toEqual({ r: 100, g: 0, b: 0, a: 255 });
		expect(grid.get(1, 1)).toEqual({ r: 0, g: 0, b: 200, a: 255 });
		// Newly exposed pixels are transparent.
		expect(grid.get(3, 3)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
	});

	test("drops pixels outside the new bounds when shrinking", () => {
		let grid = new PixelGrid(4, 4);
		grid.set(0, 0, { r: 100, g: 0, b: 0 });
		grid.set(3, 3, { r: 0, g: 0, b: 200 });
		grid.resize(2, 2);

		expect(grid.width).toBe(2);
		expect(grid.height).toBe(2);
		expect(grid.get(0, 0)).toEqual({ r: 100, g: 0, b: 0, a: 255 });
		// The (3,3) pixel is gone; reading it is out of bounds → transparent.
		expect(grid.get(3, 3)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
	});

	test("is a no-op when the dimensions are unchanged", () => {
		let grid = new PixelGrid(3, 3);
		grid.set(1, 1, { r: 7, g: 8, b: 9 });
		grid.resize(3, 3);
		expect(grid.get(1, 1)).toEqual({ r: 7, g: 8, b: 9, a: 255 });
	});

	test("rejects an invalid new size", () => {
		let grid = new PixelGrid(4, 4);
		expect(() => grid.resize(0, 4)).toThrow(RangeError);
		expect(() => grid.resize(4, MAX_DIMENSION + 1)).toThrow(RangeError);
	});
});

describe("PixelGrid serialize", () => {
	test("returns a row-major RGBA buffer of the right length", () => {
		let grid = new PixelGrid(3, 2);
		let bytes = grid.serialize();
		expect(bytes.length).toBe(3 * 2 * 4);
	});

	test("orders bytes row-major with correct channel offsets", () => {
		let grid = new PixelGrid(2, 2);
		grid.set(1, 0, { r: 11, g: 22, b: 33 });
		let bytes = grid.serialize();
		// Pixel (1,0) is the second pixel → byte offset 4.
		expect(Array.from(bytes.subarray(4, 8))).toEqual([11, 22, 33, 255]);
	});

	test("returns an independent copy that cannot mutate the grid", () => {
		let grid = new PixelGrid(2, 2);
		let bytes = grid.serialize();
		bytes[0] = 255;
		expect(grid.get(0, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
	});
});
