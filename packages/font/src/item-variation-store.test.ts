/**
 * Tests for the ItemVariationStore and DeltaSetIndexMap readers against hand-built tables,
 * which reach byte and word columns, 32-bit rows, both map formats and the region scalar's
 * edge cases without depending on a font that happens to carry them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	axisScalar,
	blendScalars,
	itemDelta,
	mapDeltaSetIndex,
	readDeltaSetIndexMap,
	readItemVariationStore,
	rowDeltas,
} from "./item-variation-store.js";
import { Reader } from "./reader.js";

/** Big-endian 16-bit fields, signed values wrapped. */
function u16(...values: number[]): number[] {
	return values.flatMap((value) => [(value >> 8) & 0xff, value & 0xff]);
}

/** Big-endian 32-bit fields, signed values wrapped. */
function u32(...values: number[]): number[] {
	return values.flatMap((value) => [
		(value >>> 24) & 0xff,
		(value >>> 16) & 0xff,
		(value >>> 8) & 0xff,
		value & 0xff,
	]);
}

/** A 2.14 fixed-point value. */
function f2dot14(value: number): number {
	return Math.round(value * 16384);
}

/**
 * A one-axis store with regions `0…1` and `-1…0` and one ItemVariationData of two rows,
 * each a wide column for the first region and a narrow one for the second.
 */
function store(longWords: boolean): number[] {
	let regions = [
		...u16(1, 2),
		...u16(0, f2dot14(1), f2dot14(1)),
		...u16(f2dot14(-1), f2dot14(-1), 0),
	];
	let rows = longWords
		? [...u32(100000), ...u16(-50), ...u32(-300), ...u16(20)]
		: [...u16(100), -50 & 0xff, ...u16(-300), 20];
	let data = [...u16(2, longWords ? 0x8001 : 1, 2, 0, 1), ...rows];
	return [...u16(1), ...u32(12), ...u16(1), ...u32(12 + regions.length), ...regions, ...data];
}

describe("readItemVariationStore", () => {
	test("evaluates byte and word columns at a location", () => {
		let parsed = readItemVariationStore(new Reader(new Uint8Array(store(false))), 0);
		if (parsed === null) throw new Error("The store did not parse.");
		expect(rowDeltas(parsed, 0, 0)).toEqual([100, -50]);
		expect(itemDelta(parsed, 0, 0, [0.5])).toBe(50);
		expect(itemDelta(parsed, 0, 0, [-0.5])).toBe(-25);
		expect(itemDelta(parsed, 0, 1, [1])).toBe(-300);
		expect(blendScalars(parsed, 0, [-0.25])).toEqual([0, 0.25]);
	});

	test("reads 32-bit wide columns", () => {
		let parsed = readItemVariationStore(new Reader(new Uint8Array(store(true))), 0);
		if (parsed === null) throw new Error("The store did not parse.");
		expect(rowDeltas(parsed, 0, 0)).toEqual([100000, -50]);
		expect(itemDelta(parsed, 0, 1, [-1])).toBe(20);
	});

	test("answers 0 for addresses the store does not hold", () => {
		let parsed = readItemVariationStore(new Reader(new Uint8Array(store(false))), 0);
		if (parsed === null) throw new Error("The store did not parse.");
		expect(itemDelta(parsed, 3, 0, [1])).toBe(0);
		expect(itemDelta(parsed, 0, 9, [1])).toBe(0);
		expect(blendScalars(parsed, 4, [1])).toEqual([]);
	});

	test("rejects an unknown format and stays in bounds when truncated", () => {
		expect(readItemVariationStore(new Reader(new Uint8Array([0, 2, 0, 0, 0, 0, 0, 0])), 0)).toBe(
			null,
		);
		let truncated = readItemVariationStore(
			new Reader(new Uint8Array(store(false).slice(0, 30))),
			0,
		);
		expect(truncated === null ? null : itemDelta(truncated, 0, 1, [1])).toBe(0);
	});
});

describe("axisScalar", () => {
	test("peaks at 1 and falls to 0 at the region's ends", () => {
		expect(axisScalar(0, 1, 1, 1)).toBe(1);
		expect(axisScalar(0, 1, 1, 0.25)).toBe(0.25);
		expect(axisScalar(0, 0.5, 1, 0.75)).toBe(0.5);
		expect(axisScalar(0, 1, 1, -0.5)).toBe(0);
	});

	test("leaves out axes with no peak or an invalid range", () => {
		expect(axisScalar(0, 0, 0, 0.7)).toBe(1);
		expect(axisScalar(0.5, 0.2, 1, 0.7)).toBe(1);
		expect(axisScalar(-0.5, 0.5, 1, -0.4)).toBe(1);
	});
});

describe("DeltaSetIndexMap", () => {
	test("reads format 0 and repeats the last entry past the end", () => {
		let bytes = [0, 0x11, ...u16(2), ...u16((1 << 2) | 3, 2)];
		let map = readDeltaSetIndexMap(new Reader(new Uint8Array(bytes)), 0);
		if (map === null) throw new Error("The map did not parse.");
		expect(mapDeltaSetIndex(map, 0)).toEqual({ outer: 1, inner: 3 });
		expect(mapDeltaSetIndex(map, 1)).toEqual({ outer: 0, inner: 2 });
		expect(mapDeltaSetIndex(map, 7)).toEqual({ outer: 0, inner: 2 });
	});

	test("reads format 1 with one-byte entries", () => {
		let bytes = [1, 0x03, ...u32(2), (2 << 4) | 5, 9];
		let map = readDeltaSetIndexMap(new Reader(new Uint8Array(bytes)), 0);
		if (map === null) throw new Error("The map did not parse.");
		expect(mapDeltaSetIndex(map, 0)).toEqual({ outer: 2, inner: 5 });
		expect(mapDeltaSetIndex(map, 1)).toEqual({ outer: 0, inner: 9 });
	});

	test("rejects an unknown format", () => {
		expect(readDeltaSetIndexMap(new Reader(new Uint8Array([2, 0, 0, 0])), 0)).toBe(null);
	});
});
