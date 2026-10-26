/**
 * Tests for `Font.subset` against Inter Regular and a hand-built font, which reaches what Inter
 * does not carry (nested and cyclic composites, a 2×2 transform, component instructions, a
 * short `hmtx`, `maxp` 0.5). Every subset is parsed back and compared glyph by glyph.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Font } from "./font.js";

import { parseFont } from "./index.js";

const INTER = readFileSync(new URL("./fixtures/inter-regular.ttf", import.meta.url));

/** A table directory entry of a written font. */
interface Entry {
	checksum: number;
	offset: number;
	length: number;
}

/** Big-endian unsigned 16-bit fields. */
function u16(...values: number[]): number[] {
	return values.flatMap((value) => [(value >> 8) & 0xff, value & 0xff]);
}

/** Big-endian unsigned 32-bit fields. */
function u32(...values: number[]): number[] {
	return values.flatMap((value) => [
		(value >>> 24) & 0xff,
		(value >>> 16) & 0xff,
		(value >>> 8) & 0xff,
		value & 0xff,
	]);
}

/** ASCII bytes of a tag. */
function ascii(text: string): number[] {
	return Array.from({ length: text.length }, (_, index) => text.charCodeAt(index));
}

/** A glyph padded to an even length, so the short `loca` form can address the next one. */
function even(bytes: number[]): number[] {
	return bytes.length % 2 === 0 ? bytes : [...bytes, 0];
}

/**
 * The tables of a six-glyph font with `numberOfHMetrics` 2, `maxp` 0.5 and no `post`:
 * `.notdef` (empty); 1 a 100×50 rectangle; 2 that rectangle under an off-diagonal 2×2
 * transform; 3 nesting 2 plus 1 with instructions; 4 referencing itself; 5 referencing glyph 99.
 */
function handTables(): Record<string, number[]> {
	let head = [
		...u32(0x00010000, 0, 0, 0x5f0f3cf5),
		...u16(0, 1000),
		...u32(0, 0, 0, 0),
		...u16(0, 0, 200, 200, 0, 8, 2),
		...u16(0, 0),
	];
	let hhea = [...u32(0x00010000), ...u16(800, 0x10000 - 200, 90), ...u16(0, 0, 0, 0, 0, 0, 0)];
	hhea.push(...u16(0, 0, 0, 0, 0), ...u16(2));
	let maxp = [...u32(0x00005000), ...u16(6)];
	let hmtx = u16(500, 0, 600, 10, 20, 30, 40, 50);

	let cmapSubtable = [
		...u16(4, 32, 0, 4, 4, 1, 0),
		...u16(0x41, 0xffff),
		...u16(0),
		...u16(0x41, 0xffff),
		...u16(0x10000 - 64, 1),
		...u16(0, 0),
	];
	let cmap = [...u16(0, 1), ...u16(3, 1), ...u32(12), ...cmapSubtable];

	let rectangle = [
		...u16(1, 0, 0, 100, 50),
		...u16(3),
		...u16(0),
		1,
		1,
		1,
		1,
		...u16(0, 100, 0, 0x10000 - 100),
		...u16(0, 0, 50, 0),
	];
	let transformed = [
		...u16(0xffff, 0, 0, 200, 200),
		...u16(0x0083, 1),
		...u16(30, 20),
		...u16(16384, 8192, 0x10000 - 4096, 16384),
	];
	let nested = [
		...u16(0xffff, 0, 0, 200, 200),
		...u16(0x0022, 2),
		5,
		5,
		...u16(0x0102, 1),
		0,
		0x100 - 10,
		...u16(2),
		0xb0,
		0x01,
	];
	let cyclic = [...u16(0xffff, 0, 0, 0, 0), ...u16(0x0002, 4), 0, 0];
	let dangling = [...u16(0xffff, 0, 0, 0, 0), ...u16(0x0002, 99), 0, 0];
	let glyphs = [rectangle, transformed, nested, cyclic, dangling].map(even);
	let glyf = glyphs.flat();
	let loca = [0, 0];
	for (let glyph of glyphs) loca.push((loca[loca.length - 1] ?? 0) + glyph.length);

	return {
		head,
		hhea,
		maxp,
		hmtx,
		cmap,
		loca: u16(...loca.map((offset) => offset / 2)),
		glyf,
		kern: [...u16(0, 0)],
		"cvt ": u16(10, 20),
		fpgm: [0xb0, 0x00],
		prep: [0xb0, 0x01],
	};
}

/**
 * Assembles tables into an sfnt file, each table 4-byte aligned; checksums stay zero since
 * `parseFont` does not verify them.
 */
function sfnt(tables: Record<string, number[]>): Uint8Array {
	let tags = Object.keys(tables).sort();
	let offset = 12 + tags.length * 16;
	let directory: number[] = [...u32(0x00010000), ...u16(tags.length, 0, 0, 0)];
	let body: number[] = [];
	for (let tag of tags) {
		let data = tables[tag] ?? [];
		directory.push(...ascii(tag), ...u32(0, offset + body.length, data.length));
		body.push(...data);
		while (body.length % 4 !== 0) body.push(0);
	}
	return new Uint8Array([...directory, ...body]);
}

/** A big-endian view over a written font. */
function view(bytes: Uint8Array): DataView {
	return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** The table directory of a written font, in file order. */
function directory(bytes: Uint8Array): Map<string, Entry> {
	let data = view(bytes);
	let entries = new Map<string, Entry>();
	for (let index = 0; index < data.getUint16(4); index++) {
		let record = 12 + index * 16;
		let tag = String.fromCharCode(...bytes.subarray(record, record + 4));
		entries.set(tag, {
			checksum: data.getUint32(record + 4),
			offset: data.getUint32(record + 8),
			length: data.getUint32(record + 12),
		});
	}
	return entries;
}

/** The u32 sum of a 4-aligned range, modulo 2^32. */
function sum(bytes: Uint8Array, start: number, length: number): number {
	let data = view(bytes);
	let total = 0;
	for (let offset = start; offset < start + length; offset += 4) {
		total = (total + data.getUint32(offset)) >>> 0;
	}
	return total;
}

/** `head.indexToLocFormat` of a written font. */
function locaFormat(bytes: Uint8Array): number {
	let head = directory(bytes).get("head");
	return view(bytes).getInt16((head?.offset ?? 0) + 50);
}

/** Asserts every subset glyph draws and advances exactly like its original. */
function expectSameGlyphs(original: Font, subset: Font.Subset) {
	let font = unwrap(parseFont(subset.bytes));
	expect(font.glyphCount).toBe(subset.glyphs.length);
	subset.glyphs.forEach((glyph, index) => {
		expect(font.outline(index)).toEqual(original.outline(glyph));
		expect(font.advance(index)).toBe(original.advance(glyph));
	});
}

/** Asserts the sfnt structure: sorted tags, aligned offsets, table and file checksums. */
function expectValidFile(bytes: Uint8Array) {
	let entries = directory(bytes);
	let tags = [...entries.keys()];
	expect(tags).toEqual([...tags].sort());
	let count = tags.length;
	let selector = Math.floor(Math.log2(count));
	let data = view(bytes);
	expect(data.getUint32(0)).toBe(0x00010000);
	expect([data.getUint16(6), data.getUint16(8), data.getUint16(10)]).toEqual([
		2 ** selector * 16,
		selector,
		count * 16 - 2 ** selector * 16,
	]);
	expect(bytes.length % 4).toBe(0);

	let head = entries.get("head");
	let adjustment = data.getUint32((head?.offset ?? 0) + 8);
	for (let [tag, entry] of entries) {
		expect(entry.offset % 4, tag).toBe(0);
		let padded = (entry.length + 3) & ~3;
		let expected = sum(bytes, entry.offset, padded);
		if (tag === "head") expected = (expected - adjustment) >>> 0;
		expect(entry.checksum, tag).toBe(expected);
		expect([...bytes.subarray(entry.offset + entry.length, entry.offset + padded)]).toEqual(
			Array.from<number>({ length: padded - entry.length }).fill(0),
		);
	}
	expect(sum(bytes, 0, bytes.length)).toBe(0xb1b0afba);
}

describe("Inter Regular", () => {
	let font = unwrap(parseFont(INTER));
	let glyph = (character: string) => font.glyphIndex(character.codePointAt(0) ?? 0);
	let glyphsOf = (text: string) => Array.from(text, glyph);

	test("subsets a word with .notdef first and the glyphs in requested order", () => {
		let subset = unwrap(font.subset(glyphsOf("helo")));
		expect(subset.glyphs).toEqual([0, ...glyphsOf("helo")]);
		expect(subset.glyphId(glyph("h"))).toBe(1);
		expect(subset.glyphId(glyph("o"))).toBe(4);
		expect(subset.glyphId(0)).toBe(0);
		expectSameGlyphs(font, subset);
		expectValidFile(subset.bytes);
	});

	test("skips repeats, .notdef, out-of-range and non-integer ids", () => {
		let subset = unwrap(
			font.subset([glyph("b"), 0, glyph("a"), glyph("b"), -1, 1.5, Number.NaN, font.glyphCount]),
		);
		expect(subset.glyphs).toEqual([0, glyph("b"), glyph("a")]);
		expect(subset.glyphId(glyph("z"))).toBe(0);
		expect(subset.glyphId(font.glyphCount)).toBe(0);
	});

	test("an empty request still writes a font holding .notdef", () => {
		let subset = unwrap(font.subset([]));
		expect(subset.glyphs).toEqual([0]);
		expectSameGlyphs(font, subset);
		expectValidFile(subset.bytes);
	});

	test("appends the components of a composite after the requested glyphs", () => {
		let subset = unwrap(font.subset([glyph("é"), glyph("x")]));
		let components = subset.glyphs.slice(3);
		expect(subset.glyphs.slice(0, 3)).toEqual([0, glyph("é"), glyph("x")]);
		expect(components.length).toBeGreaterThan(0);
		expect(components).toContain(glyph("e"));
		expectSameGlyphs(font, subset);
	});

	test("a component also requested keeps its requested position", () => {
		let subset = unwrap(font.subset([glyph("é"), glyph("e")]));
		expect(subset.glyphs.slice(0, 3)).toEqual([0, glyph("é"), glyph("e")]);
		expect(subset.glyphs.filter((id) => id === glyph("e"))).toHaveLength(1);
		expectSameGlyphs(font, subset);
	});

	test("rewrites component ids so the composite draws the same outline", () => {
		let subset = unwrap(font.subset([glyph("é")]));
		let parsed = unwrap(parseFont(subset.bytes));
		expect(parsed.outline(1)).toEqual(font.outline(glyph("é")));
		expect(parsed.outline(1).length).toBeGreaterThan(0);
	});

	test("writes short loca for a small subset of a long-loca font", () => {
		expect(locaFormat(INTER)).toBe(1);
		let subset = unwrap(font.subset(glyphsOf("abcd")));
		expect(locaFormat(subset.bytes)).toBe(0);
		expectSameGlyphs(font, subset);
	});

	test("writes long loca when glyf outgrows the short form", () => {
		let all = Array.from({ length: font.glyphCount }, (_, index) => index);
		let subset = unwrap(font.subset(all));
		expect(subset.glyphs).toEqual(all);
		expect(locaFormat(subset.bytes)).toBe(1);
		expectSameGlyphs(font, subset);
		expectValidFile(subset.bytes);
	});

	test("keeps the outline tables and hinting, and drops layout tables", () => {
		let subset = unwrap(font.subset(glyphsOf("Hi")));
		let tags = [...directory(subset.bytes).keys()];
		expect(tags).toEqual([
			"OS/2",
			"cmap",
			"glyf",
			"head",
			"hhea",
			"hmtx",
			"loca",
			"maxp",
			"name",
			"post",
			"prep",
		]);
		for (let dropped of ["GDEF", "GPOS", "GSUB", "STAT", "gasp"])
			expect(tags).not.toContain(dropped);
	});

	test("writes post as format 3 and keeps the font's metadata", () => {
		let subset = unwrap(font.subset(glyphsOf("Hi")));
		let post = directory(subset.bytes).get("post");
		expect(post?.length).toBe(32);
		expect(view(subset.bytes).getUint32(post?.offset ?? 0)).toBe(0x00030000);
		let parsed = unwrap(parseFont(subset.bytes));
		expect(parsed.family).toBe(font.family);
		expect(parsed.postscriptName).toBe(font.postscriptName);
		expect(parsed.unitsPerEm).toBe(font.unitsPerEm);
		expect(parsed.ascender).toBe(font.ascender);
		expect(parsed.descender).toBe(font.descender);
		expect(parsed.italicAngle).toBe(font.italicAngle);
		expect(parsed.underlinePosition).toBe(font.underlinePosition);
		expect(parsed.underlineThickness).toBe(font.underlineThickness);
		expect(parsed.capHeight).toBe(font.capHeight);
		expect(parsed.embedding).toEqual(font.embedding);
	});

	test("writes a cmap that maps no characters", () => {
		let parsed = unwrap(parseFont(unwrap(font.subset(glyphsOf("Hi"))).bytes));
		expect(parsed.glyphIndex("H".codePointAt(0) ?? 0)).toBe(0);
		expect(parsed.glyphIndex(0xffff)).toBe(0);
	});

	test("writes one full metric per glyph", () => {
		let subset = unwrap(font.subset(glyphsOf("Hi")));
		let entries = directory(subset.bytes);
		let data = view(subset.bytes);
		let count = subset.glyphs.length;
		expect(data.getUint16((entries.get("hhea")?.offset ?? 0) + 34)).toBe(count);
		expect(data.getUint16((entries.get("maxp")?.offset ?? 0) + 4)).toBe(count);
		expect(entries.get("hmtx")?.length).toBe(count * 4);
	});
});

describe("hand-built font", () => {
	let font = unwrap(parseFont(sfnt(handTables())));

	test("keeps an off-diagonal 2×2 transform", () => {
		let subset = unwrap(font.subset([2]));
		expect(subset.glyphs).toEqual([0, 2, 1]);
		let parsed = unwrap(parseFont(subset.bytes));
		expect(parsed.outline(1)).toEqual([
			{ type: "move", x: 30, y: 20 },
			{ type: "line", x: 130, y: 70 },
			{ type: "line", x: 117.5, y: 120 },
			{ type: "line", x: 17.5, y: 70 },
			{ type: "close" },
		]);
		expectSameGlyphs(font, subset);
	});

	test("follows nested composites and copies component instructions", () => {
		let subset = unwrap(font.subset([3]));
		expect(subset.glyphs).toEqual([0, 3, 2, 1]);
		expectSameGlyphs(font, subset);
		let entries = directory(subset.bytes);
		let data = view(subset.bytes);
		let glyf = entries.get("glyf")?.offset ?? 0;
		let start = data.getUint16((entries.get("loca")?.offset ?? 0) + 2) * 2;
		let nested = subset.bytes.subarray(glyf + start, glyf + start + 26);
		expect([...nested.subarray(12, 14)]).toEqual(u16(2));
		expect([...nested.subarray(18, 20)]).toEqual(u16(3));
		expect([...nested.subarray(22, 26)]).toEqual([...u16(2), 0xb0, 0x01]);
	});

	test("a self-referencing composite terminates", () => {
		let subset = unwrap(font.subset([4]));
		expect(subset.glyphs).toEqual([0, 4]);
		expectSameGlyphs(font, subset);
	});

	test("a component outside the font is pointed at .notdef", () => {
		let subset = unwrap(font.subset([5]));
		expect(subset.glyphs).toEqual([0, 5]);
		let entries = directory(subset.bytes);
		let data = view(subset.bytes);
		let start = data.getUint16((entries.get("loca")?.offset ?? 0) + 2) * 2;
		expect(data.getUint16((entries.get("glyf")?.offset ?? 0) + start + 12)).toBe(0);
	});

	test("expands a short hmtx into full metrics with each glyph's own bearing", () => {
		let subset = unwrap(font.subset([3, 1]));
		let entries = directory(subset.bytes);
		let data = view(subset.bytes);
		let hmtx = entries.get("hmtx")?.offset ?? 0;
		let metrics = subset.glyphs.map((_, index) => [
			data.getUint16(hmtx + index * 4),
			data.getInt16(hmtx + index * 4 + 2),
		]);
		expect(subset.glyphs).toEqual([0, 3, 1, 2]);
		expect(metrics).toEqual([
			[500, 0],
			[600, 30],
			[600, 10],
			[600, 20],
		]);
		expect(data.getUint16((entries.get("hhea")?.offset ?? 0) + 34)).toBe(4);
		expectSameGlyphs(font, subset);
	});

	test("updates numGlyphs in a version 0.5 maxp", () => {
		let subset = unwrap(font.subset([1]));
		let maxp = directory(subset.bytes).get("maxp");
		let data = view(subset.bytes);
		expect(maxp?.length).toBe(6);
		expect(data.getUint32(maxp?.offset ?? 0)).toBe(0x00005000);
		expect(data.getUint16((maxp?.offset ?? 0) + 4)).toBe(2);
	});

	test("copies the hinting tables, drops kern, and writes post from zeros", () => {
		let subset = unwrap(font.subset([1]));
		let entries = directory(subset.bytes);
		expect([...entries.keys()]).toEqual([
			"cmap",
			"cvt ",
			"fpgm",
			"glyf",
			"head",
			"hhea",
			"hmtx",
			"loca",
			"maxp",
			"post",
			"prep",
		]);
		let post = entries.get("post");
		expect([...subset.bytes.subarray(post?.offset ?? 0, (post?.offset ?? 0) + 32)]).toEqual([
			...u32(0x00030000),
			...Array.from<number>({ length: 28 }).fill(0),
		]);
		let prep = entries.get("prep");
		expect([...subset.bytes.subarray(prep?.offset ?? 0, (prep?.offset ?? 0) + 2)]).toEqual([
			0xb0, 0x01,
		]);
		expectValidFile(subset.bytes);
	});

	test("refuses a font whose license forbids subsetting", () => {
		let os2 = Array.from<number>({ length: 78 }).fill(0);
		os2.splice(8, 2, ...u16(0x0100));
		let restricted = unwrap(parseFont(sfnt({ ...handTables(), "OS/2": os2 })));
		let result = restricted.subset([1]);
		expect(isFailure(result)).toBe(true);
	});
});
