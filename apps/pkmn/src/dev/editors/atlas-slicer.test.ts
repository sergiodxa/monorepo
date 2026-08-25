/**
 * Verifies the pure atlas slicer: {@link gridDimensions} counts only the tiles
 * that fit wholly under a given margin and spacing, {@link sliceGrid} emits
 * row-major rects under both naming schemes, and the manual-region helpers
 * return fresh lists with unique names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import {
	addRegion,
	gridDimensions,
	type NamedRegion,
	regionsToMap,
	removeRegion,
	renameRegion,
	sliceGrid,
} from "./atlas-slicer";

describe("gridDimensions", () => {
	test("counts whole tiles across a clean grid", () => {
		expect(gridDimensions(64, 32, { tileWidth: 16, tileHeight: 16 })).toEqual({
			columns: 4,
			rows: 2,
		});
	});

	test("excludes a ragged partial tile at the right/bottom edge", () => {
		expect(gridDimensions(70, 40, { tileWidth: 16, tileHeight: 16 })).toEqual({
			columns: 4,
			rows: 2,
		});
	});

	test("honours an outer margin", () => {
		expect(gridDimensions(36, 36, { tileWidth: 16, tileHeight: 16, margin: 2 })).toEqual({
			columns: 2,
			rows: 2,
		});
	});

	test("honours inter-tile spacing", () => {
		expect(gridDimensions(50, 16, { tileWidth: 16, tileHeight: 16, spacing: 2 })).toEqual({
			columns: 2,
			rows: 1,
		});
	});

	test("combines margin and spacing", () => {
		expect(
			gridDimensions(52, 18, { tileWidth: 16, tileHeight: 16, margin: 1, spacing: 2 }),
		).toEqual({ columns: 2, rows: 1 });
	});

	test("yields zero when a tile does not fit at all", () => {
		expect(gridDimensions(10, 10, { tileWidth: 16, tileHeight: 16 })).toEqual({
			columns: 0,
			rows: 0,
		});
	});

	test("yields zero for invalid params rather than throwing", () => {
		expect(gridDimensions(64, 64, { tileWidth: 0, tileHeight: 16 })).toEqual({
			columns: 0,
			rows: 0,
		});
		expect(gridDimensions(64, 64, { tileWidth: 16, tileHeight: 16, margin: -1 })).toEqual({
			columns: 0,
			rows: 0,
		});
		expect(gridDimensions(64.5, 64, { tileWidth: 16, tileHeight: 16 })).toEqual({
			columns: 0,
			rows: 0,
		});
	});
});

describe("sliceGrid", () => {
	test("emits row-major index-named rects", () => {
		let regions = sliceGrid(32, 32, { tileWidth: 16, tileHeight: 16 });
		expect(Object.keys(regions)).toEqual(["tile.0", "tile.1", "tile.2", "tile.3"]);
		expect(regions["tile.0"]).toEqual({ x: 0, y: 0, w: 16, h: 16 });
		expect(regions["tile.1"]).toEqual({ x: 16, y: 0, w: 16, h: 16 });
		expect(regions["tile.2"]).toEqual({ x: 0, y: 16, w: 16, h: 16 });
		expect(regions["tile.3"]).toEqual({ x: 16, y: 16, w: 16, h: 16 });
	});

	test("emits r{row}c{col} names under the grid naming scheme", () => {
		let regions = sliceGrid(32, 32, { tileWidth: 16, tileHeight: 16, naming: "grid" });
		expect(Object.keys(regions)).toEqual(["r0c0", "r0c1", "r1c0", "r1c1"]);
		expect(regions["r1c0"]).toEqual({ x: 0, y: 16, w: 16, h: 16 });
	});

	test("offsets every rect by the margin and steps by tile + spacing", () => {
		let regions = sliceGrid(38, 20, {
			tileWidth: 16,
			tileHeight: 16,
			margin: 1,
			spacing: 2,
		});
		expect(Object.keys(regions)).toEqual(["tile.0", "tile.1"]);
		expect(regions["tile.0"]).toEqual({ x: 1, y: 1, w: 16, h: 16 });
		expect(regions["tile.1"]).toEqual({ x: 19, y: 1, w: 16, h: 16 });
	});

	test("emits nothing when no whole tile fits", () => {
		expect(sliceGrid(8, 8, { tileWidth: 16, tileHeight: 16 })).toEqual({});
	});

	test("never emits a rect that spills past the image edge", () => {
		let regions = sliceGrid(70, 40, { tileWidth: 16, tileHeight: 16 });
		for (let rect of Object.values(regions)) {
			expect(rect.x + rect.w).toBeLessThanOrEqual(70);
			expect(rect.y + rect.h).toBeLessThanOrEqual(40);
		}
		expect(Object.keys(regions)).toHaveLength(8);
	});
});

describe("regionsToMap", () => {
	test("flattens an ordered region list into a name → rect map", () => {
		let regions: NamedRegion[] = [
			{ name: "hero.down", rect: { x: 0, y: 0, w: 16, h: 32 } },
			{ name: "hero.up", rect: { x: 16, y: 0, w: 16, h: 32 } },
		];
		expect(regionsToMap(regions)).toEqual({
			"hero.down": { x: 0, y: 0, w: 16, h: 32 },
			"hero.up": { x: 16, y: 0, w: 16, h: 32 },
		});
	});

	test("copies each rect so mutating the source list does not leak through", () => {
		let regions: NamedRegion[] = [{ name: "a", rect: { x: 1, y: 2, w: 3, h: 4 } }];
		let map = regionsToMap(regions);
		regions[0]!.rect.x = 99;
		expect(map.a).toEqual({ x: 1, y: 2, w: 3, h: 4 });
	});
});

describe("addRegion", () => {
	test("appends a region and does not mutate the input", () => {
		let regions: NamedRegion[] = [{ name: "a", rect: { x: 0, y: 0, w: 8, h: 8 } }];
		let next = addRegion(regions, { name: "b", rect: { x: 8, y: 0, w: 8, h: 8 } });
		expect(next.map((entry) => entry.name)).toEqual(["a", "b"]);
		expect(regions).toHaveLength(1);
	});

	test("rejects a duplicate name", () => {
		let regions: NamedRegion[] = [{ name: "a", rect: { x: 0, y: 0, w: 8, h: 8 } }];
		expect(() => addRegion(regions, { name: "a", rect: { x: 8, y: 0, w: 8, h: 8 } })).toThrow();
	});
});

describe("removeRegion", () => {
	test("removes the named region and does not mutate the input", () => {
		let regions: NamedRegion[] = [
			{ name: "a", rect: { x: 0, y: 0, w: 8, h: 8 } },
			{ name: "b", rect: { x: 8, y: 0, w: 8, h: 8 } },
		];
		let next = removeRegion(regions, "a");
		expect(next.map((entry) => entry.name)).toEqual(["b"]);
		expect(regions).toHaveLength(2);
	});

	test("is a no-op copy when the name is absent", () => {
		let regions: NamedRegion[] = [{ name: "a", rect: { x: 0, y: 0, w: 8, h: 8 } }];
		let next = removeRegion(regions, "missing");
		expect(next).toEqual(regions);
		expect(next).not.toBe(regions);
	});
});

describe("renameRegion", () => {
	test("renames in place, preserving order and rect, without mutating the input", () => {
		let regions: NamedRegion[] = [
			{ name: "a", rect: { x: 0, y: 0, w: 8, h: 8 } },
			{ name: "b", rect: { x: 8, y: 0, w: 8, h: 8 } },
		];
		let next = renameRegion(regions, "a", "z");
		expect(next.map((entry) => entry.name)).toEqual(["z", "b"]);
		expect(next[0]!.rect).toEqual({ x: 0, y: 0, w: 8, h: 8 });
		expect(regions[0]!.name).toBe("a");
	});

	test("accepts renaming an entry to its own name (no-op)", () => {
		let regions: NamedRegion[] = [{ name: "a", rect: { x: 0, y: 0, w: 8, h: 8 } }];
		expect(renameRegion(regions, "a", "a").map((entry) => entry.name)).toEqual(["a"]);
	});

	test("rejects an unknown source name", () => {
		let regions: NamedRegion[] = [{ name: "a", rect: { x: 0, y: 0, w: 8, h: 8 } }];
		expect(() => renameRegion(regions, "missing", "z")).toThrow();
	});

	test("rejects renaming onto a different existing name", () => {
		let regions: NamedRegion[] = [
			{ name: "a", rect: { x: 0, y: 0, w: 8, h: 8 } },
			{ name: "b", rect: { x: 8, y: 0, w: 8, h: 8 } },
		];
		expect(() => renameRegion(regions, "a", "b")).toThrow();
	});
});
