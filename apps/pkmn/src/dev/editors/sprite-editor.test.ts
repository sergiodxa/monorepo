/**
 * Verifies the pure, canvas-free helpers the {@link SpriteEditor} builds its
 * higher-level tools on: the bounded {@link GridHistory} undo/redo stack (cursor
 * movement, forking on push, capacity trimming), {@link pushRecentColor} palette
 * behaviour (front promotion, de-dup, cap, channel clamping), and
 * {@link imageDataToGrid} decoding a plain RGBA buffer into a grid. The canvas
 * side of the editor (pointer handling, rendering, PNG encode/decode) needs a DOM
 * and is exercised by the running dev tool, not here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { MAX_DIMENSION, type GridSnapshot } from "./pixel-grid";
import { GridHistory, imageDataToGrid, pushRecentColor } from "./sprite-editor";

/** Builds a distinct 1×1 snapshot whose single pixel encodes `tag` for identity. */
function snapshotWithTag(tag: number): GridSnapshot {
	return { width: 1, height: 1, data: new Uint8ClampedArray([tag, 0, 0, 255]) };
}

/** Reads the `tag` byte back out of a snapshot for equality assertions. */
function tagOf(snapshot: GridSnapshot | null): number | null {
	return snapshot === null ? null : snapshot.data[0]!;
}

describe("GridHistory", () => {
	test("starts empty with no undo or redo", () => {
		let history = new GridHistory();
		expect(history.length).toBe(0);
		expect(history.canUndo).toBe(false);
		expect(history.canRedo).toBe(false);
		expect(history.undo()).toBeNull();
		expect(history.redo()).toBeNull();
	});

	test("a single push cannot be undone (it is the only state)", () => {
		let history = new GridHistory();
		history.push(snapshotWithTag(1));
		expect(history.canUndo).toBe(false);
		expect(history.canRedo).toBe(false);
	});

	test("undo/redo walk the cursor across pushed states", () => {
		let history = new GridHistory();
		history.push(snapshotWithTag(1));
		history.push(snapshotWithTag(2));
		history.push(snapshotWithTag(3));

		expect(history.canUndo).toBe(true);
		expect(tagOf(history.undo())).toBe(2);
		expect(tagOf(history.undo())).toBe(1);
		expect(history.canUndo).toBe(false);

		expect(history.canRedo).toBe(true);
		expect(tagOf(history.redo())).toBe(2);
		expect(tagOf(history.redo())).toBe(3);
		expect(history.canRedo).toBe(false);
	});

	test("pushing after an undo discards the redo tail", () => {
		let history = new GridHistory();
		history.push(snapshotWithTag(1));
		history.push(snapshotWithTag(2));
		history.push(snapshotWithTag(3));
		history.undo(); // back to 2
		history.push(snapshotWithTag(9)); // forks the timeline

		expect(history.canRedo).toBe(false);
		expect(tagOf(history.undo())).toBe(2);
		expect(tagOf(history.undo())).toBe(1);
	});

	test("drops the oldest state once the limit is exceeded", () => {
		let history = new GridHistory(3);
		history.push(snapshotWithTag(1));
		history.push(snapshotWithTag(2));
		history.push(snapshotWithTag(3));
		history.push(snapshotWithTag(4)); // 1 is dropped

		expect(history.length).toBe(3);
		expect(tagOf(history.undo())).toBe(3);
		expect(tagOf(history.undo())).toBe(2);
		// Cannot reach the dropped state 1.
		expect(history.canUndo).toBe(false);
	});

	test("rejects a non-positive limit", () => {
		expect(() => new GridHistory(0)).toThrow(RangeError);
		expect(() => new GridHistory(-1)).toThrow(RangeError);
		expect(() => new GridHistory(1.5)).toThrow(RangeError);
	});
});

describe("pushRecentColor", () => {
	test("prepends a new color, most-recent first", () => {
		let next = pushRecentColor([{ r: 1, g: 1, b: 1 }], { r: 2, g: 2, b: 2 });
		expect(next).toEqual([
			{ r: 2, g: 2, b: 2 },
			{ r: 1, g: 1, b: 1 },
		]);
	});

	test("promotes an existing color to the front without duplicating", () => {
		let recent = [
			{ r: 1, g: 1, b: 1 },
			{ r: 2, g: 2, b: 2 },
			{ r: 3, g: 3, b: 3 },
		];
		let next = pushRecentColor(recent, { r: 3, g: 3, b: 3 });
		expect(next).toEqual([
			{ r: 3, g: 3, b: 3 },
			{ r: 1, g: 1, b: 1 },
			{ r: 2, g: 2, b: 2 },
		]);
	});

	test("caps the list at the limit, dropping the oldest", () => {
		let recent = [
			{ r: 1, g: 1, b: 1 },
			{ r: 2, g: 2, b: 2 },
		];
		let next = pushRecentColor(recent, { r: 3, g: 3, b: 3 }, 2);
		expect(next).toEqual([
			{ r: 3, g: 3, b: 3 },
			{ r: 1, g: 1, b: 1 },
		]);
	});

	test("clamps and rounds channels before storing", () => {
		let next = pushRecentColor([], { r: -5, g: 300, b: 12.6 });
		expect(next).toEqual([{ r: 0, g: 255, b: 13 }]);
	});

	test("does not mutate the input list", () => {
		let recent = [{ r: 1, g: 1, b: 1 }];
		pushRecentColor(recent, { r: 2, g: 2, b: 2 });
		expect(recent).toEqual([{ r: 1, g: 1, b: 1 }]);
	});
});

describe("imageDataToGrid", () => {
	test("adopts the decoded image's dimensions and pixels", () => {
		let data = new Uint8ClampedArray(2 * 1 * 4);
		data.set([10, 20, 30, 255], 0);
		data.set([40, 50, 60, 128], 4);
		let grid = imageDataToGrid({ width: 2, height: 1, data });
		expect(grid.width).toBe(2);
		expect(grid.height).toBe(1);
		expect(grid.get(0, 0)).toEqual({ r: 10, g: 20, b: 30, a: 255 });
		expect(grid.get(1, 0)).toEqual({ r: 40, g: 50, b: 60, a: 128 });
	});

	test("rejects an image larger than the cap", () => {
		let over = MAX_DIMENSION + 1;
		let data = new Uint8ClampedArray(over * 1 * 4);
		expect(() => imageDataToGrid({ width: over, height: 1, data })).toThrow(RangeError);
	});

	test("rejects a buffer that does not match the dimensions", () => {
		expect(() => imageDataToGrid({ width: 2, height: 2, data: new Uint8ClampedArray(8) })).toThrow(
			RangeError,
		);
	});
});
