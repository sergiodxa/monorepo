/**
 * Tests for `gvar` delta decoding against a hand-built glyph variation record, which pins
 * down IUP: how untouched points take their deltas from the touched points around them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { Reader } from "../reader.js";

import type { GvarTable } from "./gvar.js";

import { glyphDeltas } from "./gvar.js";

/** A square contour, then the four phantom points. */
const POSITIONS = [
	{ x: 0, y: 0 },
	{ x: 100, y: 0 },
	{ x: 100, y: 100 },
	{ x: 0, y: 100 },
	{ x: 0, y: 0 },
	{ x: 500, y: 0 },
	{ x: 0, y: 0 },
	{ x: 0, y: 0 },
];

/** The square's end, then each phantom point as a contour of its own. */
const CONTOUR_ENDS = [3, 4, 5, 6, 7];

/**
 * A one-axis `gvar` holding one glyph whose single tuple peaks at `1` and moves the points
 * listed in `points` by `xs` and `ys`.
 */
function gvarOf(points: number[], xs: number[], ys: number[]): GvarTable {
	let increments = points.map((point, index) => point - (points[index - 1] ?? 0));
	let serialized = [
		points.length,
		points.length - 1,
		...increments,
		xs.length - 1,
		...xs.map((value) => value & 0xff),
		ys.length - 1,
		...ys.map((value) => value & 0xff),
	];
	let glyph = [0, 1, 0, 10, 0, serialized.length, 0xa0, 0x00, 0x40, 0x00, ...serialized];
	if (glyph.length % 2) glyph.push(0);
	let bytes = new Uint8Array([0, 0, 0, glyph.length / 2, ...glyph]);
	return {
		reader: new Reader(bytes),
		axisCount: 1,
		sharedTuplesOffset: 0,
		sharedTupleCount: 0,
		glyphCount: 1,
		longOffsets: false,
		offsetsOffset: 0,
		dataOffset: 4,
		end: bytes.length,
	};
}

describe("glyphDeltas", () => {
	test("infers untouched points from the touched ones around them", () => {
		let gvar = gvarOf([0, 2], [10, 30], [0, 20]);
		let deltas = glyphDeltas(gvar, 0, POSITIONS, CONTOUR_ENDS, [1]);
		expect(Array.from(deltas?.x ?? [])).toEqual([10, 30, 30, 10, 0, 0, 0, 0]);
		expect(Array.from(deltas?.y ?? [])).toEqual([0, 0, 20, 20, 0, 0, 0, 0]);
	});

	test("interpolates between references and scales by the tuple's scalar", () => {
		let gvar = gvarOf([0, 2], [0, 40], [0, 0]);
		let positions = POSITIONS.map((point, index) => (index === 1 ? { x: 50, y: 0 } : point));
		let deltas = glyphDeltas(gvar, 0, positions, CONTOUR_ENDS, [0.5]);
		expect(Array.from(deltas?.x ?? []).slice(0, 4)).toEqual([0, 10, 20, 0]);
	});

	test("moves a whole contour with its only touched point", () => {
		let gvar = gvarOf([1], [7], [-3]);
		let deltas = glyphDeltas(gvar, 0, POSITIONS, CONTOUR_ENDS, [1]);
		expect(Array.from(deltas?.x ?? [])).toEqual([7, 7, 7, 7, 0, 0, 0, 0]);
		expect(Array.from(deltas?.y ?? [])).toEqual([-3, -3, -3, -3, 0, 0, 0, 0]);
	});

	test("answers nothing at the default location and for glyphs past the table", () => {
		let gvar = gvarOf([0], [5], [5]);
		expect(Array.from(glyphDeltas(gvar, 0, POSITIONS, CONTOUR_ENDS, [0])?.x ?? [])).toEqual(
			Array.from({ length: 8 }, () => 0),
		);
		expect(glyphDeltas(gvar, 1, POSITIONS, CONTOUR_ENDS, [1])).toBe(null);
	});
});
