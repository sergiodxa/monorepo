/**
 * Tests for `parseFont` and `Font` against Inter Regular and against hand-built minimal
 * fonts, which reach what Inter does not carry (a `kern` table, scaled composites,
 * all-off-curve contours) and every way a file can be rejected.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Font } from "./font.js";

import { parseFont } from "./index.js";

const INTER = readFileSync(new URL("./fixtures/inter-regular.ttf", import.meta.url));

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

/** The UTF-16 code units of a string; ASCII bytes for a tag. */
function ascii(text: string): number[] {
	return Array.from({ length: text.length }, (_, index) => text.charCodeAt(index));
}

/** UTF-16BE bytes, the encoding of Windows `name` records. */
function utf16(text: string): number[] {
	return u16(...ascii(text));
}

/**
 * The tables of a three-glyph font: `.notdef` (empty), "A" a 100-unit diamond of four
 * off-curve points, and "B" that diamond as a composite scaled by ½ and moved by (10, 20).
 * "A" then "B" kern by -50 through a format 0 `kern` table.
 */
function minimalTables(): Record<string, number[]> {
	let head = [
		...u32(0x00010000, 0, 0, 0x5f0f3cf5),
		...u16(0, 1000),
		...u32(0, 0, 0, 0),
		...u16(0, 0, 100, 100, 0, 8, 2),
		...u16(0, 0),
	];
	let hhea = [...u32(0x00010000), ...u16(800, 0x10000 - 200, 90), ...u16(0, 0, 0, 0, 0, 0, 0)];
	hhea.push(...u16(0, 0, 0, 0, 0), ...u16(3));
	let maxp = [...u32(0x00005000), ...u16(3)];
	let hmtx = u16(500, 0, 600, 0, 700, 0);

	let segments = u16(0x42, 0xffff);
	let cmapSubtable = [
		...u16(4, 32, 0, 4, 4, 1, 0),
		...segments,
		...u16(0),
		...u16(0x41, 0xffff),
		...u16(0x10000 - 64, 1),
		...u16(0, 0),
	];
	let cmap = [...u16(0, 1), ...u16(3, 1), ...u32(12), ...cmapSubtable];

	let simple = [
		...u16(1, 0, 0, 100, 100),
		...u16(3),
		...u16(0),
		0,
		0,
		0,
		0,
		...u16(0, 100, 0, 0x10000 - 100),
		...u16(0, 0, 100, 0),
	];
	let composite = [...u16(0xffff, 0, 0, 100, 100), ...u16(0x000b, 1), ...u16(10, 20), ...u16(8192)];
	let glyf = [...simple, ...composite];
	let loca = u16(0, 0, simple.length / 2, glyf.length / 2);

	let kern = [...u16(0, 1), ...u16(0, 20, 0x0001), ...u16(1, 6, 0, 0), ...u16(1, 2, 0x10000 - 50)];

	let family = utf16("Mini");
	let style = utf16("Bold");
	let name = [
		...u16(0, 2, 30),
		...u16(3, 1, 0x409, 1, family.length, 0),
		...u16(3, 1, 0x409, 2, style.length, family.length),
		...family,
		...style,
	];

	return { head, hhea, maxp, hmtx, cmap, loca, glyf, kern, name };
}

/** An `OS/2` table whose typographic metrics differ from `hhea`'s. */
function os2(fsSelection: number): number[] {
	let table = Array.from<number>({ length: 78 }).fill(0);
	table.splice(62, 2, ...u16(fsSelection));
	table.splice(68, 6, ...u16(900, 0x10000 - 300, 50));
	return table;
}

/**
 * An `OS/2` table of a given version and length with the style and permission fields set.
 *
 * @param fields - The fields under test; anything left out stays zero.
 */
function os2Style(fields: {
	version: number;
	length: number;
	weight?: number;
	fsType?: number;
	familyClass?: number;
	fsSelection?: number;
	xHeight?: number;
	capHeight?: number;
}): number[] {
	let table = Array.from<number>({ length: fields.length }).fill(0);
	let set = (offset: number, value: number) => {
		if (offset + 2 <= table.length) table.splice(offset, 2, ...u16(value & 0xffff));
	};
	set(0, fields.version);
	set(4, fields.weight ?? 0);
	set(8, fields.fsType ?? 0);
	set(30, fields.familyClass ?? 0);
	set(62, fields.fsSelection ?? 0);
	set(86, fields.xHeight ?? 0);
	set(88, fields.capHeight ?? 0);
	return table;
}

/**
 * A 32-byte `post` header (format 3).
 *
 * @param italicAngle - 16.16 fixed bits.
 * @param fixedPitch - `isFixedPitch`.
 */
function post(italicAngle: number, fixedPitch: number): number[] {
	return [
		...u32(0x00030000, italicAngle),
		...u16(0x10000 - 75, 50),
		...u32(fixedPitch, 0, 0, 0, 0),
	];
}

/**
 * Assembles tables into an sfnt file, each table 4-byte aligned.
 *
 * @param tables - Table bytes by tag.
 * @param signature - The sfnt version tag.
 */
function sfnt(tables: Record<string, number[]>, signature = u32(0x00010000)): Uint8Array {
	let tags = Object.keys(tables).sort();
	let offset = 12 + tags.length * 16;
	let directory: number[] = [...signature, ...u16(tags.length, 0, 0, 0)];
	let body: number[] = [];
	for (let tag of tags) {
		let data = tables[tag] ?? [];
		directory.push(...ascii(tag), ...u32(0, offset + body.length, data.length));
		body.push(...data);
		while (body.length % 4 !== 0) body.push(0);
	}
	return new Uint8Array([...directory, ...body]);
}

/** Parses the minimal font with some tables replaced or removed. */
function minimal(changes: Record<string, number[] | null> = {}) {
	let tables = minimalTables();
	for (let [tag, data] of Object.entries(changes)) {
		if (data === null) delete tables[tag];
		else tables[tag] = data;
	}
	return parseFont(sfnt(tables));
}

/** The pieces of an outline, in order, without coordinates. */
function shape(commands: Font.Command[]): string {
	return commands.map((command) => command.type[0]).join("");
}

describe("Inter Regular", () => {
	let font = unwrap(parseFont(INTER));
	let glyph = (character: string) => font.glyphIndex(character.codePointAt(0) ?? 0);

	test("reads metrics and names", () => {
		expect(font.unitsPerEm).toBe(2048);
		expect(font.ascender).toBe(1984);
		expect(font.descender).toBe(-494);
		expect(font.lineGap).toBe(0);
		expect(font.family).toBe("Inter");
		expect(font.subfamily).toBe("Regular");
		expect(font.glyphCount).toBe(2926);
	});

	test("reads the metrics a PDF font descriptor needs", () => {
		expect(font.postscriptName).toBe("Inter-Regular");
		expect(font.bbox).toEqual({ xMin: -1513, yMin: -660, xMax: 5290, yMax: 2269 });
		expect(font.italicAngle).toBe(0);
		expect(font.capHeight).toBe(1490);
		expect(font.xHeight).toBe(1118);
		expect(font.weightClass).toBe(400);
		expect(font.underlinePosition).toBe(-348);
		expect(font.underlineThickness).toBe(140);
		expect([font.isFixedPitch, font.isItalic, font.isBold, font.isSerif]).toEqual([
			false,
			false,
			false,
			false,
		]);
		expect(font.embedding).toEqual({ allowed: "installable", subsetting: true, bitmapOnly: false });
	});

	test("accepts a Uint8Array, an offset view of one, and an ArrayBuffer", () => {
		let padded = new Uint8Array(INTER.byteLength + 8);
		padded.set(INTER, 8);
		let buffer = new Uint8Array(INTER).buffer;
		for (let input of [new Uint8Array(INTER), padded.subarray(8), buffer]) {
			let result = parseFont(input);
			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) expect(result.data.glyphIndex(0x41)).toBe(glyph("A"));
		}
	});

	test("maps characters through cmap, unmapped ones to .notdef", () => {
		expect(glyph("A")).toBeGreaterThan(0);
		expect(glyph("é")).toBeGreaterThan(0);
		expect(glyph("A")).not.toBe(glyph("B"));
		expect(font.glyphIndex(0x1f600)).toBe(0);
		expect(font.glyphIndex(0x10ffff)).toBe(0);
		expect(font.glyphIndex(-1)).toBe(0);
	});

	test("reads advances in font units", () => {
		expect(font.advance(glyph("A"))).toBeGreaterThan(0);
		expect(font.advance(glyph("i"))).toBeLessThan(font.advance(glyph("m")));
		expect(font.advance(font.glyphCount)).toBe(0);
	});

	test("kerns pairs through GPOS when the font has no kern table", () => {
		expect(font.kerning(glyph("A"), glyph("V"))).toBeLessThan(0);
		expect(font.kerning(glyph("T"), glyph("o"))).toBeLessThan(0);
		expect(font.kerning(glyph("H"), glyph("H"))).toBe(0);
	});

	test("outlines 'o' as two closed contours of quadratic curves", () => {
		let outline = font.outline(glyph("o"));
		expect(outline.filter((command) => command.type === "move")).toHaveLength(2);
		expect(outline.filter((command) => command.type === "close")).toHaveLength(2);
		expect(outline.some((command) => command.type === "quad")).toBe(true);
		expect(outline.at(-1)?.type).toBe("close");
	});

	test("resolves composite glyphs into their components' contours", () => {
		let base = font.outline(glyph("e"));
		let accented = font.outline(glyph("é"));
		let contours = (commands: Font.Command[]) =>
			commands.filter((command) => command.type === "move").length;
		expect(contours(accented)).toBe(contours(base) + 1);
	});

	test("draws nothing for a space", () => {
		expect(font.outline(glyph(" "))).toEqual([]);
	});

	test("path scales to pixels and flips y around the baseline", () => {
		let outline = font.outline(glyph("o"));
		let path = font.path(glyph("o"), 1024, 10, 500);
		expect(path).toHaveLength(outline.length);
		let [first] = outline;
		let [moved] = path;
		expect(moved?.type).toBe("move");
		if (first?.type !== "move" || moved?.type !== "move") return;
		expect(moved.x).toBeCloseTo(10 + first.x / 2);
		expect(moved.y).toBeCloseTo(500 - first.y / 2);
		let ys = path.flatMap((command) => (command.type === "close" ? [] : [command.y]));
		expect(Math.min(...ys)).toBeLessThan(500);
	});

	test("layout places glyphs with kerning and tracking", () => {
		let size = 100;
		let scale = size / font.unitsPerEm;
		let plain = font.layout("AV", size, { kerning: false });
		let kerned = font.layout("AV", size);
		let [a, v] = kerned.glyphs;
		expect(a).toEqual({ glyph: glyph("A"), codePoint: 0x41, x: 0, advance: 1413 * scale });
		expect(plain.glyphs[1]?.x).toBeCloseTo(font.advance(glyph("A")) * scale);
		expect(v?.x).toBeCloseTo(
			(font.advance(glyph("A")) + font.kerning(glyph("A"), glyph("V"))) * scale,
		);
		expect(kerned.width).toBeLessThan(plain.width);

		let tracked = font.layout("AVA", size, { tracking: 4, kerning: false });
		let untracked = font.layout("AVA", size, { kerning: false });
		expect(tracked.width).toBeCloseTo(untracked.width + 8);
		expect(tracked.glyphs[2]?.x).toBeCloseTo((untracked.glyphs[2]?.x ?? 0) + 8);
	});

	test("layout iterates code points, drawing astral characters as .notdef", () => {
		let line = font.layout("a😀", 32);
		expect(line.glyphs.map((placed) => placed.codePoint)).toEqual([0x61, 0x1f600]);
		expect(line.glyphs[1]?.glyph).toBe(0);
		expect(font.layout("", 32)).toEqual({ glyphs: [], width: 0 });
	});

	test("measure equals layout().width", () => {
		let text = "Sign and verify JWTs";
		expect(font.measure(text, 76)).toBe(font.layout(text, 76).width);
		expect(font.measure(text, 76, { tracking: -3 })).toBe(
			font.layout(text, 76, { tracking: -3 }).width,
		);
		expect(font.measure(text, 76, { kerning: false })).toBe(
			font.layout(text, 76, { kerning: false }).width,
		);
	});

	test("opens a 300 KB font quickly", () => {
		let start = performance.now();
		for (let index = 0; index < 20; index++) parseFont(INTER);
		expect((performance.now() - start) / 20).toBeLessThan(5);
	});
});

describe("hand-built font", () => {
	test("reads hhea metrics and Windows name records", () => {
		let font = unwrap(minimal());
		expect(font.unitsPerEm).toBe(1000);
		expect([font.ascender, font.descender, font.lineGap]).toEqual([800, -200, 90]);
		expect([font.family, font.subfamily]).toEqual(["Mini", "Bold"]);
	});

	test("prefers OS/2 typographic metrics only when USE_TYPO_METRICS is set", () => {
		let typo = unwrap(minimal({ "OS/2": os2(0x0080) }));
		expect([typo.ascender, typo.descender, typo.lineGap]).toEqual([900, -300, 50]);
		let legacy = unwrap(minimal({ "OS/2": os2(0x0040) }));
		expect([legacy.ascender, legacy.descender, legacy.lineGap]).toEqual([800, -200, 90]);
	});

	test("answers empty names without a name table", () => {
		let font = unwrap(minimal({ name: null }));
		expect([font.family, font.subfamily]).toEqual(["", ""]);
	});

	test("reads format 0 kern pairs", () => {
		let font = unwrap(minimal());
		expect(font.kerning(1, 2)).toBe(-50);
		expect(font.kerning(2, 1)).toBe(0);
		expect(font.layout("AB", 1000).width).toBe(600 - 50 + 700);
	});

	test("makes implied on-curve points explicit", () => {
		let font = unwrap(minimal());
		expect(font.outline(1)).toEqual([
			{ type: "move", x: 0, y: 50 },
			{ type: "quad", cx: 0, cy: 0, x: 50, y: 0 },
			{ type: "quad", cx: 100, cy: 0, x: 100, y: 50 },
			{ type: "quad", cx: 100, cy: 100, x: 50, y: 100 },
			{ type: "quad", cx: 0, cy: 100, x: 0, y: 50 },
			{ type: "close" },
		]);
	});

	test("applies a composite component's scale and offset", () => {
		let font = unwrap(minimal());
		let outline = font.outline(2);
		expect(shape(outline)).toBe("mqqqqc");
		expect(outline[0]).toEqual({ type: "move", x: 10, y: 45 });
		expect(outline[2]).toEqual({ type: "quad", cx: 60, cy: 20, x: 60, y: 45 });
	});

	test("outlines a glyph with corrupt data as empty instead of throwing", () => {
		let tables = minimalTables();
		let glyf = [...(tables["glyf"] ?? [])];
		glyf.splice(10, 2, ...u16(0x7fff));
		let font = unwrap(minimal({ glyf }));
		expect(font.outline(1)).toEqual([]);
		expect(font.outline(99)).toEqual([]);
	});
});

describe("metrics, style and embedding permission", () => {
	test("answers defaults for a font without OS/2 or post", () => {
		let font = unwrap(minimal());
		expect(font.bbox).toEqual({ xMin: 0, yMin: 0, xMax: 100, yMax: 100 });
		expect(font.italicAngle).toBe(0);
		expect([font.capHeight, font.xHeight]).toEqual([null, null]);
		expect(font.weightClass).toBe(400);
		expect([font.underlinePosition, font.underlineThickness]).toEqual([0, 0]);
		expect([font.isFixedPitch, font.isItalic, font.isBold, font.isSerif]).toEqual([
			false,
			false,
			false,
			false,
		]);
		expect(font.embedding).toEqual({ allowed: "installable", subsetting: true, bitmapOnly: false });
		expect(font.postscriptName).toBe("");
	});

	test("reads cap and x heights only from OS/2 version 2 and later", () => {
		let v1 = unwrap(minimal({ "OS/2": os2Style({ version: 1, length: 86, capHeight: 700 }) }));
		expect([v1.capHeight, v1.xHeight]).toEqual([null, null]);
		let v2 = unwrap(
			minimal({ "OS/2": os2Style({ version: 2, length: 96, xHeight: 500, capHeight: 700 }) }),
		);
		expect([v2.capHeight, v2.xHeight]).toEqual([700, 500]);
		let v5 = unwrap(
			minimal({ "OS/2": os2Style({ version: 5, length: 100, xHeight: 510, capHeight: 710 }) }),
		);
		expect([v5.capHeight, v5.xHeight]).toEqual([710, 510]);
	});

	test("reads a version 0 OS/2 shorter than the fields it lacks", () => {
		let font = unwrap(minimal({ "OS/2": os2Style({ version: 0, length: 68, weight: 700 }) }));
		expect(font.weightClass).toBe(700);
		expect(font.capHeight).toBeNull();
	});

	test("reads italic angle, underline and fixed pitch from post", () => {
		let font = unwrap(minimal({ post: post(0xfff38000, 1) }));
		expect(font.italicAngle).toBe(-12.5);
		expect([font.underlinePosition, font.underlineThickness]).toEqual([-75, 50]);
		expect(font.isFixedPitch).toBe(true);
	});

	test("takes style from fsSelection or macStyle", () => {
		let fromOs2 = unwrap(
			minimal({ "OS/2": os2Style({ version: 4, length: 96, fsSelection: 0x0021 }) }),
		);
		expect([fromOs2.isItalic, fromOs2.isBold]).toEqual([true, true]);
		let head = minimalTables().head ?? [];
		head.splice(44, 2, ...u16(0x0003));
		let fromHead = unwrap(minimal({ head }));
		expect([fromHead.isItalic, fromHead.isBold]).toEqual([true, true]);
	});

	test("classes 1-5 and 7 of sFamilyClass are serif", () => {
		let serif = (familyClass: number) =>
			unwrap(minimal({ "OS/2": os2Style({ version: 4, length: 96, familyClass }) })).isSerif;
		expect([1, 2, 3, 4, 5, 7].map((style) => serif(style << 8))).toEqual(Array(6).fill(true));
		expect([0, 6, 8, 9, 10, 12].map((style) => serif((style << 8) | 1))).toEqual(
			Array(6).fill(false),
		);
	});

	test("decodes fsType, the least restrictive usage bit winning", () => {
		let embedding = (fsType: number) =>
			unwrap(minimal({ "OS/2": os2Style({ version: 4, length: 96, fsType }) })).embedding;
		expect(embedding(0x0000).allowed).toBe("installable");
		expect(embedding(0x0001).allowed).toBe("installable");
		expect(embedding(0x0002).allowed).toBe("restricted");
		expect(embedding(0x0004).allowed).toBe("preview-and-print");
		expect(embedding(0x0008).allowed).toBe("editable");
		expect(embedding(0x0006).allowed).toBe("preview-and-print");
		expect(embedding(0x000e).allowed).toBe("editable");
		expect(embedding(0x0302)).toEqual({
			allowed: "restricted",
			subsetting: false,
			bitmapOnly: true,
		});
	});

	test("refuses to subset a font whose fsType forbids it", () => {
		let font = unwrap(minimal({ "OS/2": os2Style({ version: 4, length: 96, fsType: 0x0100 }) }));
		let result = font.subset([1]);
		expect(isFailure(result) && [result.error.code, result.error.table]).toEqual([
			"not-permitted",
			"OS/2",
		]);
	});

	test("decodes Windows symbol-encoded names as UTF-16BE", () => {
		let family = utf16("Symbol Test");
		let postscript = utf16("SymbolTest-Regular");
		let name = [
			...u16(0, 2, 30),
			...u16(3, 0, 0x409, 1, family.length, 0),
			...u16(3, 0, 0x409, 6, postscript.length, family.length),
			...family,
			...postscript,
		];
		let font = unwrap(minimal({ name }));
		expect([font.family, font.postscriptName]).toEqual(["Symbol Test", "SymbolTest-Regular"]);
	});
});

/**
 * A `cmap` table holding the given subtables, each under its platform and encoding IDs.
 *
 * @param subtables - `[platform, encoding, bytes]` in record order.
 */
function cmapOf(...subtables: [number, number, number[]][]): number[] {
	let header = u16(0, subtables.length);
	let body: number[] = [];
	let offset = 4 + subtables.length * 8;
	for (let [platform, encoding, bytes] of subtables) {
		header.push(...u16(platform, encoding), ...u32(offset + body.length));
		body.push(...bytes);
	}
	return [...header, ...body];
}

/**
 * A format 4 subtable mapping a run of BMP code points to consecutive glyphs from 1.
 *
 * @param start - First code point, mapped to glyph 1.
 * @param count - How many code points.
 */
function format4(start: number, count: number): number[] {
	let end = start + count - 1;
	return [
		...u16(4, 32, 0, 4, 4, 1, 0),
		...u16(end, 0xffff),
		...u16(0),
		...u16(start, 0xffff),
		...u16((1 - start) & 0xffff, 1),
		...u16(0, 0),
	];
}

/**
 * A format 12 or 13 subtable of one group.
 *
 * @param format - `12` sequential or `13` constant.
 * @param start - First code point.
 * @param end - Last code point.
 * @param glyph - The group's first (format 12) or only (format 13) glyph.
 */
function groups(format: number, start: number, end: number, glyph: number): number[] {
	return [...u16(format, 0), ...u32(28, 0, 1), ...u32(start, end, glyph)];
}

/** Code points of a laid-out line, glyph by glyph. */
function placed(font: Font, text: string): [number, number][] {
	return font.layout(text, 1000).glyphs.map(({ glyph, codePoint }) => [glyph, codePoint]);
}

describe("character mapping", () => {
	test("reads every mapping format", () => {
		let byFormat = (subtable: number[]) => unwrap(minimal({ cmap: cmapOf([0, 3, subtable]) }));

		let format0 = byFormat([
			...u16(0, 262, 0),
			...Array.from({ length: 256 }, (_, code) => (code === 0x41 ? 2 : 0)),
		]);
		expect([format0.glyphIndex(0x41), format0.glyphIndex(0x42), format0.glyphIndex(0x141)]).toEqual(
			[2, 0, 0],
		);
		expect(format0.characterSet).toEqual([0x41]);

		let keys = Array.from({ length: 256 }, (_, byte) => (byte === 0x81 ? 8 : 0));
		let format2 = byFormat([
			...u16(2, 538, 0),
			...u16(...keys),
			...u16(0x41, 1, 0, 10),
			...u16(0x40, 1, 0, 4),
			...u16(1, 2),
		]);
		expect([0x41, 0x8140, 0x81, 0x8141].map((code) => format2.glyphIndex(code))).toEqual([
			1, 2, 0, 0,
		]);
		expect(format2.characterSet).toEqual([0x41, 0x8140]);

		let format6 = byFormat([...u16(6, 14, 0, 0x41, 2), ...u16(1, 2)]);
		expect([format6.glyphIndex(0x40), format6.glyphIndex(0x41), format6.glyphIndex(0x42)]).toEqual([
			0, 1, 2,
		]);

		let format8 = byFormat([
			...u16(8, 0),
			...u32(8220, 0),
			...Array.from<number>({ length: 8192 }).fill(0),
			...u32(1, 0x10000, 0x10001, 1),
		]);
		expect([format8.glyphIndex(0x10000), format8.glyphIndex(0x10001)]).toEqual([1, 2]);
		expect(format8.characterSet).toEqual([0x10000, 0x10001]);

		let format10 = byFormat([...u16(10, 0), ...u32(24, 0, 0x1f600, 2), ...u16(2, 1)]);
		expect([format10.glyphIndex(0x1f600), format10.glyphIndex(0x1f601)]).toEqual([2, 1]);

		let format13 = byFormat(groups(13, 0x41, 0x43, 2));
		expect(format13.stringsForGlyph(2)).toEqual(["A", "B", "C"]);
		expect(format13.glyphIndex(0x44)).toBe(0);
	});

	test("prefers full-repertoire Unicode subtables and skips truncated ones", () => {
		let both = cmapOf([3, 1, format4(0x41, 1)], [3, 10, groups(12, 0x41, 0x41, 2)]);
		expect(unwrap(minimal({ cmap: both })).glyphIndex(0x41)).toBe(2);
		let truncated = [...u16(12, 0), ...u32(28, 0, 99), ...u32(0x41, 0x41, 2)];
		let fallback = cmapOf([3, 1, format4(0x41, 1)], [3, 10, truncated]);
		expect(unwrap(minimal({ cmap: fallback })).glyphIndex(0x41)).toBe(1);
	});

	test("finds a symbol font's characters in the U+F000 block too", () => {
		let font = unwrap(minimal({ cmap: cmapOf([3, 0, format4(0xf041, 2)]) }));
		expect([font.glyphIndex(0xf041), font.glyphIndex(0x41), font.glyphIndex(0x42)]).toEqual([
			1, 1, 2,
		]);
		expect(font.characterSet).toEqual([0xf041, 0xf042]);
	});

	test("maps Unicode through Mac Roman for a Macintosh-only cmap", () => {
		let bytes = Array.from({ length: 256 }, (_, code) => [0, 0x41, 0xa5].indexOf(code)).map(
			(glyph) => Math.max(glyph, 0),
		);
		let font = unwrap(minimal({ cmap: cmapOf([1, 0, [...u16(0, 262, 0), ...bytes]]) }));
		expect([font.glyphIndex(0x41), font.glyphIndex(0x2022), font.glyphIndex(0xa5)]).toEqual([
			1, 2, 0,
		]);
		expect(font.characterSet).toEqual([0x41, 0x2022]);
		expect(font.stringsForGlyph(2)).toEqual(["•"]);
	});

	test("folds variation selectors into the glyph before them", () => {
		let variations = [
			...u16(14),
			...u32(10 + 11 + 8 + 9, 1),
			0x00,
			0xfe,
			0x00,
			...u32(21, 29),
			...u32(1),
			0x00,
			0x00,
			0x42,
			0,
			...u32(1),
			0x00,
			0x00,
			0x41,
			...u16(2),
		];
		let font = unwrap(minimal({ cmap: cmapOf([0, 3, format4(0x41, 2)], [0, 5, variations]) }));
		expect([
			font.glyphIndex(0x41, 0xfe00),
			font.glyphIndex(0x42, 0xfe00),
			font.glyphIndex(0x41, 0xfe01),
		]).toEqual([2, 2, 1]);
		expect(placed(font, "A\uFE00B\uFE00A")).toEqual([
			[2, 0x41],
			[2, 0x42],
			[1, 0x41],
		]);
		expect(font.measure("A\uFE00", 1000)).toBe(700);
	});
});

describe("names", () => {
	test("reads language-tag records and Macintosh-encoded names", () => {
		let family = utf16("Mini");
		let mac = [...ascii("Mini"), 0xa5];
		let tag = utf16("de-CH");
		let storage = [...family, ...mac, ...tag];
		let name = [
			...u16(1, 2, 6 + 24 + 2 + 4),
			...u16(1, 0, 0, 4, mac.length, family.length),
			...u16(3, 1, 0x8000, 1, family.length, 0),
			...u16(1),
			...u16(tag.length, family.length + mac.length),
			...storage,
		];
		let font = unwrap(minimal({ name }));
		expect(font.names[1]).toEqual({ "de-CH": "Mini" });
		expect([font.fullName, font.name(4, "de"), font.family]).toEqual(["Mini•", "Mini•", "Mini"]);
		expect([font.copyright, font.version]).toEqual(["", ""]);
	});

	test("skips records that point past the table", () => {
		let name = [...u16(0, 1, 18), ...u16(3, 1, 0x409, 1, 40, 0), ...utf16("Mini")];
		let font = unwrap(minimal({ name }));
		expect([font.family, font.names]).toEqual(["", {}]);
	});
});

describe("glyph names", () => {
	/** A `post` table of a version with the given glyph data after its header. */
	function postVersion(version: number, data: number[]): number[] {
		return [...u32(version), ...Array.from<number>({ length: 28 }).fill(0), ...data];
	}

	test("reads every post format", () => {
		let names = (post: number[]) => {
			let font = unwrap(minimal({ post }));
			return [0, 1, 2, 3].map((glyph) => font.glyphName(glyph));
		};
		expect(names(postVersion(0x00010000, []))).toEqual([
			".notdef",
			".null",
			"nonmarkingreturn",
			null,
		]);
		let format2 = postVersion(0x00020000, [...u16(3, 0, 258, 36), 7, ...ascii("diamond")]);
		expect(names(format2)).toEqual([".notdef", "diamond", "A", null]);
		expect(names(postVersion(0x00025000, [...u16(3), 0, 35, 0x10000 - 1]))).toEqual([
			".notdef",
			"A",
			".null",
			null,
		]);
		expect(names(postVersion(0x00030000, []))).toEqual([null, null, null, null]);
		expect(names(postVersion(0x00040000, u16(0xffff, 0x41, 0x42)))).toEqual([null, "A", "B", null]);
	});

	test("answers null for a format 2 string past the table", () => {
		let post = postVersion(0x00020000, [...u16(3, 0, 258, 259), 7, ...ascii("diamond"), 40, 0x41]);
		let font = unwrap(minimal({ post }));
		expect([font.glyphName(1), font.glyphName(2)]).toEqual(["diamond", null]);
	});
});

describe("vertical and device metrics", () => {
	let vhea = [
		...u32(0x00011000),
		...u16(500, 0x10000 - 500, 0),
		...Array.from<number>({ length: 24 }).fill(0),
		...u16(2),
	];

	test("reads vhea and vmtx, later glyphs sharing the last advance", () => {
		let font = unwrap(minimal({ vhea, vmtx: [...u16(1100, 50, 900, 60), ...u16(70)] }));
		expect(font.verticalMetrics).toEqual({ ascender: 500, descender: -500, lineGap: 0 });
		expect([0, 1, 2].map((glyph) => font.verticalAdvance(glyph))).toEqual([1100, 900, 900]);
		expect([0, 1, 2].map((glyph) => font.topSideBearing(glyph))).toEqual([50, 60, 70]);
		expect(font.verticalOrigin(1)).toBe(100 + 60);
	});

	test("falls back to the line height without usable vertical metrics", () => {
		for (let font of [unwrap(minimal()), unwrap(minimal({ vhea, vmtx: u16(1100) }))]) {
			expect(font.verticalAdvance(1)).toBe(1000);
			expect(font.topSideBearing(1)).toBe(800 - 100);
			expect(font.verticalOrigin(1)).toBe(800);
		}
		expect(unwrap(minimal()).verticalMetrics).toBeNull();
	});

	test("reads vertical origins from VORG", () => {
		let font = unwrap(minimal({ VORG: [...u16(1, 0, 880, 1), ...u16(2, 900)] }));
		expect([font.verticalOrigin(1), font.verticalOrigin(2)]).toEqual([880, 900]);
	});

	test("reads hdmx records padded to their record size", () => {
		let hdmx = [...u16(0, 2), ...u32(8), 11, 7, 3, 4, 5, 0, 0, 0, 12, 9, 5, 6, 7, 0, 0, 0];
		let font = unwrap(minimal({ hdmx }));
		expect([
			font.deviceAdvance(1, 11),
			font.deviceAdvance(2, 12),
			font.deviceAdvance(0, 12),
		]).toEqual([4, 7, 5]);
		expect([font.deviceAdvance(1, 13), font.deviceAdvance(5, 11)]).toEqual([null, null]);
		let short = [...u16(0, 1), ...u32(4), 11, 7, 3, 4];
		expect(unwrap(minimal({ hdmx: short })).deviceAdvance(1, 11)).toBeNull();
	});
});

describe("rejected files", () => {
	/** The code and table of a rejection, for compact assertions. */
	function rejection(bytes: Uint8Array | ReturnType<typeof parseFont>) {
		let result = bytes instanceof Uint8Array ? parseFont(bytes) : bytes;
		if (!isFailure(result)) return null;
		return { code: result.error.code, table: result.error.table };
	}

	test("reads outlines by table, whatever the sfnt version says", () => {
		expect(rejection(sfnt(minimalTables(), ascii("OTTO")))).toBeNull();
	});

	test("declines a collection as unsupported", () => {
		expect(rejection(sfnt(minimalTables(), ascii("ttcf")))?.code).toBe("unsupported");
	});

	test("reports the first missing required table", () => {
		expect(rejection(minimal({ glyf: null }))).toEqual({ code: "missing-table", table: "glyf" });
		expect(rejection(minimal({ cmap: null }))).toEqual({ code: "missing-table", table: "cmap" });
	});

	test("declines a font whose only cmap subtable has an encoding it cannot map", () => {
		let cmap = [
			...u16(0, 1),
			...u16(1, 1),
			...u32(12),
			...u16(0, 262, 0),
			...Array.from({ length: 256 }, () => 0),
		];
		expect(rejection(minimal({ cmap }))).toEqual({ code: "unsupported", table: "cmap" });
	});

	test("rejects truncated or unrecognised headers as malformed", () => {
		expect(rejection(new Uint8Array(4))?.code).toBe("malformed");
		expect(rejection(sfnt(minimalTables(), ascii("wOFF")))?.code).toBe("malformed");
		let truncated = sfnt(minimalTables()).slice(0, 40);
		expect(rejection(truncated)?.code).toBe("malformed");
	});

	test("rejects a table that runs past the end of the file", () => {
		let bytes = sfnt(minimalTables());
		let view = new DataView(bytes.buffer);
		view.setUint32(12 + 12, bytes.length);
		expect(rejection(bytes)?.code).toBe("malformed");
	});

	test("rejects inconsistent table headers as malformed with the table at fault", () => {
		let head = minimalTables()["head"] ?? [];
		let badMagic = [...head];
		badMagic.splice(12, 4, ...u32(0));
		expect(rejection(minimal({ head: badMagic }))).toEqual({ code: "malformed", table: "head" });

		let badUnits = [...head];
		badUnits.splice(18, 2, ...u16(0));
		expect(rejection(minimal({ head: badUnits }))).toEqual({ code: "malformed", table: "head" });

		let badLoca = [...head];
		badLoca.splice(50, 2, ...u16(2));
		expect(rejection(minimal({ head: badLoca }))).toEqual({ code: "malformed", table: "head" });

		let hhea = [...(minimalTables()["hhea"] ?? [])];
		hhea.splice(34, 2, ...u16(0));
		expect(rejection(minimal({ hhea }))).toEqual({ code: "malformed", table: "hhea" });

		expect(rejection(minimal({ maxp: [...u32(0x00005000), ...u16(0)] }))).toEqual({
			code: "malformed",
			table: "maxp",
		});
		expect(rejection(minimal({ hmtx: u16(500, 0) }))).toEqual({
			code: "malformed",
			table: "hmtx",
		});
		expect(rejection(minimal({ loca: u16(0, 0) }))).toEqual({ code: "malformed", table: "loca" });
	});
});
