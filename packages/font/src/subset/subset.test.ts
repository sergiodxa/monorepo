/**
 * Tests for `subset` from `@sdxc/font/subset` against TrueType, CFF, CID-keyed CFF and CFF2
 * fixtures and variable font instances. Every subset is parsed back and compared glyph by
 * glyph with the font it came from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { CffTable } from "../cff/index.js";
import type { Font } from "../font.js";

import { readDict } from "../cff/dict.js";
import { cffString, DICT_OP } from "../cff/index.js";
import { fontData } from "../font.js";
import { parseFont } from "../index.js";
import { Reader } from "../reader.js";
import { instance } from "../variations/index.js";

import { encodeDict, keptEntries } from "./cff-encoding.js";
import { encodeCharstring } from "./charstring-encoder.js";

import { subset } from "./index.js";

/**
 * Reads a fixture font's bytes.
 *
 * @param path - Path under `src/fixtures/`.
 */
function fixture(path: string): Uint8Array {
	return readFileSync(new URL(`../fixtures/${path}`, import.meta.url));
}

/**
 * Opens a fixture font.
 *
 * @param path - Path under `src/fixtures/`.
 */
function open(path: string): Font {
	return unwrap(parseFont(fixture(path)));
}

/**
 * The glyphs a string maps to, one per code point.
 *
 * @param font - The font.
 * @param text - The characters.
 */
function glyphsFor(font: Font, text: string): number[] {
	return Array.from(text, (char) => font.glyphIndex(char.codePointAt(0) ?? 0));
}

/**
 * Subsets a font and parses the result back.
 *
 * @param font - The source font.
 * @param glyphs - Glyph ids to keep.
 */
function roundTrip(font: Font, glyphs: number[]): { written: Font.Subset; parsed: Font } {
	let written = unwrap(subset(font, glyphs));
	return { written, parsed: unwrap(parseFont(written.bytes)) };
}

/**
 * The parsed `CFF ` table of a font.
 *
 * @param font - A font with CFF outlines.
 */
function cffTable(font: Font): CffTable {
	let cff = fontData(font).cff;
	if (cff === null) throw new Error("The font has no CFF outlines.");
	return cff.table;
}

/**
 * The tags of a font's tables, sorted.
 *
 * @param font - The font.
 */
function tags(font: Font): string[] {
	return [...fontData(font).tables.keys()].sort();
}

const SOURCE_SANS = "SourceSansPro/SourceSansPro-Regular.otf";
const NOTO_CJK = "NotoSansCJK/NotoSansCJKjp-Regular-subset.otf";
const ADOBE_VF = "fonttest/AdobeVFPrototype-Subset.otf";

describe("truetype subsetting", () => {
	let font = open("OpenSans/OpenSans-Regular.ttf");

	test("produces a subset", () => {
		let { written, parsed } = roundTrip(font, glyphsFor(font, "hello"));
		expect(parsed.glyphCount).toBe(5);
		expect(parsed.outline(1)).toEqual(font.outline(font.glyphIndex(104)));
		expect(written.glyphId(font.glyphIndex(104))).toBe(1);
	});

	test("writes the same file Font.subset writes", () => {
		let inter = open("inter-regular.ttf");
		let glyphs = glyphsFor(inter, "Subset");
		expect(unwrap(subset(inter, glyphs)).bytes).toEqual(unwrap(inter.subset(glyphs)).bytes);
	});

	test("handles composite glyphs", () => {
		let { parsed } = roundTrip(font, glyphsFor(font, "é"));
		expect(parsed.glyphCount).toBe(4);
		expect(parsed.outline(1)).toEqual(font.outline(font.glyphIndex(0xe9)));
	});

	test("refuses a font whose license forbids subsetting", () => {
		let bytes = Uint8Array.from(fixture("inter-regular.ttf"));
		let os2 = fontData(unwrap(parseFont(bytes))).tables.get("OS/2")?.offset ?? 0;
		new DataView(bytes.buffer).setUint16(os2 + 8, 0x0100);
		let result = subset(unwrap(parseFont(bytes)), [1]);
		expect(isFailure(result) && result.error.code).toBe("not-permitted");
	});
});

describe("CFF subsetting", () => {
	let font = open(SOURCE_SANS);

	test("produces a subset", () => {
		let glyphs = glyphsFor(font, "hello");
		let { written, parsed } = roundTrip(font, glyphs);
		expect(new Reader(written.bytes).tag(0)).toBe("OTTO");
		expect(parsed.glyphCount).toBe(5);
		expect(written.glyphs).toEqual([0, ...new Set(glyphs)]);
		written.glyphs.forEach((original, index) => {
			expect(parsed.outline(index)).toEqual(font.outline(original));
			expect(parsed.advance(index)).toBe(font.advance(original));
			expect(parsed.glyphName(index)).toBe(font.glyphName(original));
		});
		expect(parsed.glyphIndex(104)).toBe(0);
	});

	test("writes maxp 0.5, post 3 and only the tables a subset needs", () => {
		let { parsed } = roundTrip(font, glyphsFor(font, "a"));
		expect(tags(parsed)).toEqual([
			"CFF ",
			"OS/2",
			"cmap",
			"head",
			"hhea",
			"hmtx",
			"maxp",
			"name",
			"post",
		]);
		expect(new Reader(unwrap(subset(font, [1])).bytes).u32(0)).toBe(0x4f54544f);
		expect(parsed.table("maxp")?.slice(0, 4)).toEqual(Uint8Array.of(0, 0, 0x50, 0));
		expect(parsed.table("post")?.slice(0, 4)).toEqual(Uint8Array.of(0, 3, 0, 0));
		expect(parsed.family).toBe(font.family);
	});

	test("empties the subroutines no kept glyph calls and keeps their numbering", () => {
		let { written, parsed } = roundTrip(font, glyphsFor(font, "hello"));
		let source = cffTable(font);
		let table = cffTable(parsed);
		expect(table.globalSubrs.count).toBe(source.globalSubrs.count);
		expect(table.fontDicts[0]?.private.subrs?.count).toBe(
			source.fontDicts[0]?.private.subrs?.count,
		);
		expect(written.bytes.length).toBeLessThan(12_000);
	});

	test("keeps only the strings the subset references", () => {
		let { parsed } = roundTrip(font, glyphsFor(font, "hello"));
		let table = cffTable(parsed);
		let reader = fontData(parsed).reader;
		let written = Array.from({ length: table.strings?.count ?? 0 }, (_, index) =>
			cffString(reader, table, 391 + index),
		);
		expect(written.length).toBeLessThan(cffTable(font).strings?.count ?? 0);
		expect(written).toContain(cffString(reader, table, table.topDict.get(2)?.[0] ?? 0));
		expect(cffString(reader, table, table.topDict.get(2)?.[0] ?? 0)).toBe(
			cffString(fontData(font).reader, cffTable(font), cffTable(font).topDict.get(2)?.[0] ?? 0),
		);
	});

	test("omits Top DICT entries equal to their defaults", () => {
		let { parsed } = roundTrip(font, [1]);
		let top = cffTable(parsed).topDict;
		let sourceTop = cffTable(font).topDict;
		for (let [op, operands] of top) {
			if (op === DICT_OP.charset || op === DICT_OP.charStrings || op === DICT_OP.private) continue;
			expect(sourceTop.get(op)?.length).toBe(operands.length);
		}
		expect(top.has(1207)).toBe(sourceTop.has(1207));
		expect(top.has(DICT_OP.encoding)).toBe(false);
	});

	test("handles CID fonts", () => {
		let cjk = open(NOTO_CJK);
		let { written, parsed } = roundTrip(cjk, [3, 2, 1]);
		let table = cffTable(parsed);
		expect(written.glyphs).toEqual([0, 3, 2, 1]);
		written.glyphs.forEach((original, index) => {
			expect(parsed.outline(index)).toEqual(cjk.outline(original));
			expect(parsed.advance(index)).toBe(cjk.advance(original));
		});
		expect(table.cid).toBe(true);
		expect(table.fontDicts.length).toBe(3);
		expect(Array.from(table.fdSelect?.fds ?? [])).toEqual([0, 1, 1, 2]);
		expect(Array.from(table.charset?.ids ?? [])).toEqual([0, 1, 2, 3]);
		let reader = fontData(parsed).reader;
		let ros = table.topDict.get(DICT_OP.ros) ?? [];
		expect(ros.slice(0, 2).map((sid) => cffString(reader, table, sid))).toEqual([
			"Adobe",
			"Identity",
		]);
		expect(table.topDict.get(DICT_OP.cidCount)).toEqual([4]);
	});

	test("keeps the Font DICTs of asian punctuation glyphs", () => {
		let cjk = open(NOTO_CJK);
		let glyphs = glyphsFor(cjk, "侮、");
		let { parsed } = roundTrip(cjk, glyphs);
		expect(parsed.outline(1)).toEqual(cjk.outline(glyphs[0] ?? 0));
		expect(parsed.outline(2)).toEqual(cjk.outline(glyphs[1] ?? 0));
	});

	test("subsets PlayfairDisplay", () => {
		let playfair = open("PlayfairDisplay/PlayfairDisplay-Regular.otf");
		let { written, parsed } = roundTrip(playfair, glyphsFor(playfair, "Quiz Ä&"));
		written.glyphs.forEach((original, index) => {
			expect(parsed.outline(index)).toEqual(playfair.outline(original));
		});
	});

	test("skips repeats, ids the font lacks and non-integers", () => {
		let written = unwrap(subset(font, [5, 5, -1, 1.5, 999_999, 0, 7]));
		expect(written.glyphs).toEqual([0, 5, 7]);
		expect(written.glyphId(7)).toBe(2);
		expect(written.glyphId(8)).toBe(0);
	});
});

describe("CFF DICT defaults", () => {
	/**
	 * Encodes a Top DICT's entries as a subset writes them.
	 *
	 * @param entries - Operator to operands.
	 */
	function written(entries: [number, number[]][]): Uint8Array {
		return encodeDict(keptEntries(new Map(entries), new Set()));
	}

	/**
	 * Parses DICT bytes back.
	 *
	 * @param bytes - DICT bytes.
	 */
	function parsed(bytes: Uint8Array): Map<number, number[]> {
		return unwrap(readDict(new Reader(bytes), 0, bytes.length, "CFF "));
	}

	test("omits scalar and array defaults", () => {
		let defaults: [number, number[]][] = [
			[1207, [0.001, -0, 0, 0.001, 0, -0]],
			[5, [0, 0, -0, 0]],
			[1201, [0]],
			[1202, [-0]],
			[1203, [-100]],
			[1204, [50]],
		];
		expect(written(defaults)).toEqual(written([]));
	});

	test("preserves non-default array elements and scalar values", () => {
		let values: [number, number[]][] = [
			[1207, [0.001, 0, 0, 0.001, 10, 20]],
			[5, [0, 0, 100, 200]],
			[1201, [1]],
			[1202, [-12]],
			[1203, [-90]],
			[13, [42]],
			[1209, [0.0375]],
			[1218, [1.5e-7]],
		];
		expect(parsed(written(values))).toEqual(new Map(values));
	});

	test("preserves arrays whose lengths differ from the defaults", () => {
		for (let bbox of [[], [0, 0, 0], [0, 0, 0, 0, 0]]) {
			expect(parsed(written([[5, bbox]])).get(5)).toEqual(bbox);
		}
	});
});

describe("CFF2 subsetting", () => {
	let font = open(ADOBE_VF);

	test("writes the default instance as a CFF table", () => {
		let { written, parsed } = roundTrip(font, glyphsFor(font, "$A"));
		expect(cffTable(parsed).version).toBe(1);
		expect(tags(parsed)).not.toContain("CFF2");
		expect(tags(parsed)).not.toContain("fvar");
		written.glyphs.forEach((original, index) => {
			expect(parsed.outline(index)).toEqual(font.outline(original));
			expect(parsed.advance(index)).toBe(font.advance(original));
		});
	});

	test("raises quadratic segments to cubics", () => {
		let bytes = encodeCharstring(
			[
				{ type: "move", x: 0, y: 0 },
				{ type: "quad", cx: 30, cy: 30, x: 60, y: 0 },
				{ type: "close" },
			],
			0,
		);
		expect(Array.from(bytes)).toEqual([139, 139, 21, 159, 159, 159, 139, 159, 119, 8, 14]);
	});

	test("states the width relative to nominalWidthX", () => {
		let bytes = encodeCharstring([], 600, 500, 100);
		expect(Array.from(bytes)).toEqual([248, 136, 14]);
	});
});

describe("subsetting with set variations", () => {
	let mada = unwrap(instance(open("Mada/Mada-VF.ttf"), { wght: 900 }));

	/**
	 * Subsets the Mada instance's glyphs for a string.
	 *
	 * @param text - The characters.
	 */
	function encodeSubset(text: string): { glyphs: number[]; parsed: Font } {
		let glyphs = glyphsFor(mada, text);
		return { glyphs, parsed: roundTrip(mada, glyphs).parsed };
	}

	test("re-encodes glyphs whose last points repeat a flag", () => {
		let { glyphs, parsed } = encodeSubset("BDx");
		glyphs.forEach((glyph, index) => {
			expect(parsed.outline(index + 1)).toEqual(mada.outline(glyph));
			expect(parsed.advance(index + 1)).toBe(mada.advance(glyph));
		});
	});

	test("flattens composite glyphs", () => {
		let { glyphs, parsed } = encodeSubset("é");
		expect(parsed.glyphCount).toBe(2);
		expect(parsed.outline(1)).toEqual(mada.outline(glyphs[0] ?? 0));
	});

	test("writes left side bearings of the varied outlines", () => {
		let { glyphs, parsed } = encodeSubset("aé");
		let hmtx = new Reader(parsed.table("hmtx") ?? new Uint8Array());
		glyphs.forEach((glyph, index) => {
			expect(hmtx.i16((index + 1) * 4 + 2)).toBe(mada.glyphCBox(glyph).xMin);
			expect(parsed.glyphCBox(index + 1).xMin).toBe(mada.glyphCBox(glyph).xMin);
		});
	});

	test("drops the variation tables and keeps the instance's line metrics", () => {
		let { parsed } = encodeSubset("a");
		expect(tags(parsed)).not.toContain("fvar");
		expect(tags(parsed)).not.toContain("gvar");
		expect(parsed.ascender).toBe(mada.ascender);
		expect(parsed.descender).toBe(mada.descender);
	});

	test("re-encodes glyphs of a font with set variations", () => {
		let gvar = unwrap(instance(open("fonttest/TestGVAROne.ttf"), { wght: 300 }));
		let glyphs = glyphsFor(gvar, "彌");
		let { parsed } = roundTrip(gvar, glyphs);
		expect(parsed.outline(1)).toEqual(gvar.outline(glyphs[0] ?? 0));
	});

	test("draws a CFF2 instance to within fixed-point precision", () => {
		let base = open(ADOBE_VF);
		let bold = unwrap(instance(base, { wght: 900 }));
		let glyphs = glyphsFor(bold, "$");
		let { parsed } = roundTrip(bold, glyphs);
		let expected = bold.outline(glyphs[0] ?? 0);
		expect(expected).not.toEqual(base.outline(glyphs[0] ?? 0));
		let actual = parsed.outline(1);
		expect(actual.map(({ type }) => type)).toEqual(expected.map(({ type }) => type));
		actual.forEach((command, index) => {
			let want = expected[index];
			if (command.type !== "move" || want?.type !== "move") return;
			expect(command.x).toBeCloseTo(want.x, 4);
			expect(command.y).toBeCloseTo(want.y, 4);
		});
		expect(parsed.advance(1)).toBe(bold.advance(glyphs[0] ?? 0));
	});
});
