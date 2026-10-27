/**
 * Tests for AAT lookup tables in every format `morx` uses, read from hand-built bytes,
 * including tables that are truncated or of an unknown format.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { Reader } from "../../reader.js";

import { aatLookup } from "./lookup.js";

/**
 * Big-endian 16-bit words as bytes.
 *
 * @param words - The words.
 */
function words(...values: number[]): Reader {
	let bytes = new Uint8Array(values.length * 2);
	let view = new DataView(bytes.buffer);
	values.forEach((value, index) => view.setUint16(index * 2, value));
	return new Reader(bytes);
}

/**
 * Every glyph's value in a lookup table, `null` where it has none.
 *
 * @param reader - The table's bytes, starting at offset 0.
 * @param glyphs - How many glyphs to look up.
 */
function values(reader: Reader, glyphs = 8): (number | null)[] {
	return Array.from({ length: glyphs }, (_, glyph) => aatLookup(reader, 0, glyph, 6));
}

describe("aatLookup", () => {
	test("reads a simple array (format 0) up to the font's glyph count", () => {
		expect(values(words(0, 10, 11, 12, 13, 14, 15, 16))).toEqual([
			10,
			11,
			12,
			13,
			14,
			15,
			null,
			null,
		]);
	});

	test("reads segment singles (format 2), ignoring the end-of-search segment", () => {
		let table = words(2, 6, 3, 12, 1, 6, 2, 1, 20, 5, 4, 21, 0xffff, 0xffff, 0);
		expect(values(table)).toEqual([null, 20, 20, null, 21, 21, null, null]);
	});

	test("reads segment arrays (format 4) through their value offsets", () => {
		let table = words(4, 6, 2, 12, 1, 0, 3, 2, 24, 6, 6, 28, 30, 31, 40, 41);
		expect(values(table)).toEqual([null, null, 30, 31, null, null, 40, null]);
	});

	test("reads single tables (format 6)", () => {
		let table = words(6, 4, 3, 8, 1, 4, 1, 50, 3, 51, 0xffff, 0);
		expect(values(table)).toEqual([null, 50, null, 51, null, null, null, null]);
	});

	test("reads trimmed arrays (format 8)", () => {
		expect(values(words(8, 2, 3, 7, 8, 9))).toEqual([null, null, 7, 8, 9, null, null, null]);
	});

	test("reads extended trimmed arrays (format 10) of 1, 2 and 4 byte values", () => {
		let bytes = new Uint8Array([0, 10, 0, 1, 0, 1, 0, 2, 7, 9]);
		expect(values(new Reader(bytes))).toEqual([null, 7, 9, null, null, null, null, null]);
		expect(values(words(10, 2, 3, 1, 0x1234))).toEqual([
			null,
			null,
			null,
			0x1234,
			null,
			null,
			null,
			null,
		]);
		expect(values(words(10, 4, 0, 1, 1, 2))).toEqual([
			0x10002,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
		]);
		expect(values(words(10, 3, 0, 1, 1, 2))).toEqual([
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
		]);
	});

	test("answers null for unknown formats and truncated tables", () => {
		expect(values(words(3, 1, 2))).toEqual(Array.from({ length: 8 }, () => null));
		expect(values(words(2, 6, 400))).toEqual(Array.from({ length: 8 }, () => null));
		expect(values(words(6, 4, 2))).toEqual(Array.from({ length: 8 }, () => null));
	});
});
