/**
 * Tests for `@sdxc/font/color` against the SS Emoji fixtures, one carrying `COLR`/`CPAL`
 * and one carrying `sbix`, and against those fonts rebuilt with hand-made tables that reach
 * what the fixtures do not: palette versions, `dupe` images, several strikes, bad offsets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Font } from "../font.js";

import { fontData } from "../font.js";
import { parseFont } from "../index.js";

import { bitmap, colorLayers, paletteEntryLabels, palettes, strikes } from "./index.js";

const MICROSOFT = readFileSync(
	new URL("../fixtures/ss-emoji/ss-emoji-microsoft.ttf", import.meta.url),
);
const APPLE = readFileSync(new URL("../fixtures/ss-emoji/ss-emoji-apple.ttf", import.meta.url));

/** U+1F61C FACE WITH STUCK-OUT TONGUE AND WINKING EYE, the glyph both fixtures color. */
const WINK = 0x1f61c;

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

/** A four-character tag's bytes. */
function tag(value: string): number[] {
	return Array.from(value, (char) => char.charCodeAt(0));
}

/**
 * Rebuilds an sfnt with tables replaced, added or dropped (`null`), so a
 * hand-made color table rides on a real font's `cmap`, `maxp` and outlines.
 */
function withTables(source: Uint8Array, overrides: Record<string, number[] | null>): Font {
	let view = new DataView(source.buffer, source.byteOffset, source.byteLength);
	let tables = new Map<string, Uint8Array>();
	for (let index = 0; index < view.getUint16(4); index++) {
		let record = 12 + index * 16;
		let name = String.fromCharCode(...source.subarray(record, record + 4));
		let start = view.getUint32(record + 8);
		tables.set(name, source.subarray(start, start + view.getUint32(record + 12)));
	}
	for (let [name, bytes] of Object.entries(overrides)) {
		if (bytes === null) tables.delete(name);
		else tables.set(name, Uint8Array.from(bytes));
	}
	let names = [...tables.keys()].sort();
	let header = [...u32(0x00010000), ...u16(names.length, 0, 0, 0)];
	let offset = 12 + names.length * 16;
	let directory: number[] = [];
	let data: number[] = [];
	for (let name of names) {
		let bytes = tables.get(name) ?? new Uint8Array();
		directory.push(...tag(name), ...u32(0, offset + data.length, bytes.byteLength));
		data.push(...bytes);
		while (data.length % 4 !== 0) data.push(0);
	}
	return unwrap(parseFont(Uint8Array.from([...header, ...directory, ...data])));
}

describe("colorLayers", () => {
	let font = unwrap(parseFont(MICROSOFT));

	test("returns the layers of a COLR glyph with palette 0 colors", () => {
		expect(colorLayers(font, font.glyphIndex(WINK))).toEqual([
			{ glyph: 247, color: { red: 252, green: 194, blue: 0, alpha: 255 } },
			{ glyph: 248, color: { red: 159, green: 79, blue: 0, alpha: 255 } },
			{ glyph: 249, color: { red: 229, green: 65, blue: 65, alpha: 255 } },
		]);
	});

	test("answers null for a glyph without color layers", () => {
		expect(colorLayers(font, 1)).toBeNull();
		expect(colorLayers(font, 65535)).toBeNull();
	});

	test("answers null for a font without COLR", () => {
		expect(colorLayers(unwrap(parseFont(APPLE)), 84)).toBeNull();
	});

	test("paints the foreground marker and picks the requested palette", () => {
		let colr = [...u16(0, 1), ...u32(14, 20), ...u16(2), ...u16(5, 0, 2), ...u16(7, 0xffff, 8, 1)];
		let cpal = [
			...u16(0, 2, 2, 4),
			...u32(16),
			...u16(0, 2),
			1,
			2,
			3,
			255,
			4,
			5,
			6,
			255,
			7,
			8,
			9,
			128,
			10,
			11,
			12,
			64,
		];
		let custom = withTables(MICROSOFT, { COLR: colr, CPAL: cpal });
		expect(colorLayers(custom, 5)).toEqual([
			{ glyph: 7, color: "foreground" },
			{ glyph: 8, color: { red: 6, green: 5, blue: 4, alpha: 255 } },
		]);
		expect(colorLayers(custom, 5, { palette: 1 })?.[1]).toEqual({
			glyph: 8,
			color: { red: 12, green: 11, blue: 10, alpha: 64 },
		});
		expect(colorLayers(custom, 5, { palette: 9 })).toEqual(colorLayers(custom, 5));
	});

	test("treats a palette entry past the palette as the foreground", () => {
		let colr = [...u16(0, 1), ...u32(14, 20), ...u16(1), ...u16(5, 0, 1), ...u16(7, 40)];
		let cpal = [...u16(0, 1, 1, 1), ...u32(14), ...u16(0), 1, 2, 3, 255];
		let custom = withTables(MICROSOFT, { COLR: colr, CPAL: cpal });
		expect(colorLayers(custom, 5)).toEqual([{ glyph: 7, color: "foreground" }]);
	});

	test("answers null for layer records past the table or a missing CPAL", () => {
		let truncated = [...u16(0, 1), ...u32(14, 20), ...u16(4), ...u16(5, 0, 4), ...u16(7, 0)];
		expect(colorLayers(withTables(MICROSOFT, { COLR: truncated }), 5)).toBeNull();
		let pastCount = [...u16(0, 1), ...u32(14, 20), ...u16(1), ...u16(5, 0, 2), ...u16(7, 0, 8, 0)];
		expect(colorLayers(withTables(MICROSOFT, { COLR: pastCount }), 5)).toBeNull();
		expect(colorLayers(withTables(MICROSOFT, { CPAL: null }), font.glyphIndex(WINK))).toBeNull();
		expect(colorLayers(withTables(MICROSOFT, { COLR: [0, 0] }), 5)).toBeNull();
	});
});

describe("palettes", () => {
	test("reads the fixture's version 0 palette", () => {
		let font = unwrap(parseFont(MICROSOFT));
		let all = palettes(font);
		expect(all).toHaveLength(1);
		let palette = all[0];
		expect(palette?.colors[1]).toEqual({ red: 252, green: 194, blue: 0, alpha: 255 });
		expect(palette).toMatchObject({
			lightBackground: false,
			darkBackground: false,
			labelNameId: null,
		});
		expect(paletteEntryLabels(font)).toEqual([]);
	});

	test("reads version 1 palette types and labels", () => {
		let cpal = [
			...u16(1, 2, 2, 4),
			...u32(28),
			...u16(0, 2),
			...u32(44, 52, 56),
			1,
			2,
			3,
			255,
			4,
			5,
			6,
			255,
			7,
			8,
			9,
			255,
			10,
			11,
			12,
			255,
			...u32(1, 2),
			...u16(300, 0xffff),
			...u16(0xffff, 301),
		];
		let font = withTables(MICROSOFT, { CPAL: cpal });
		expect(palettes(font)).toEqual([
			{
				colors: [
					{ red: 3, green: 2, blue: 1, alpha: 255 },
					{ red: 6, green: 5, blue: 4, alpha: 255 },
				],
				lightBackground: true,
				darkBackground: false,
				labelNameId: 300,
			},
			{
				colors: [
					{ red: 9, green: 8, blue: 7, alpha: 255 },
					{ red: 12, green: 11, blue: 10, alpha: 255 },
				],
				lightBackground: false,
				darkBackground: true,
				labelNameId: null,
			},
		]);
		expect(paletteEntryLabels(font)).toEqual([null, 301]);
	});

	test("fills entries past the color records with opaque black", () => {
		let cpal = [...u16(0, 2, 1, 1), ...u32(14), ...u16(0), 1, 2, 3, 4];
		expect(palettes(withTables(MICROSOFT, { CPAL: cpal }))[0]?.colors).toEqual([
			{ red: 3, green: 2, blue: 1, alpha: 4 },
			{ red: 0, green: 0, blue: 0, alpha: 255 },
		]);
	});

	test("answers [] for a missing or malformed CPAL", () => {
		expect(palettes(unwrap(parseFont(APPLE)))).toEqual([]);
		let pastEnd = [...u16(0, 2, 1, 50), ...u32(14), ...u16(0)];
		expect(palettes(withTables(MICROSOFT, { CPAL: pastEnd }))).toEqual([]);
		let badArrays = [...u16(1, 1, 1, 1), ...u32(26), ...u16(0), ...u32(999, 999, 999)];
		expect(palettes(withTables(MICROSOFT, { CPAL: [...badArrays, 1, 2, 3, 4] }))).toEqual([
			{
				colors: [{ red: 3, green: 2, blue: 1, alpha: 4 }],
				lightBackground: false,
				darkBackground: false,
				labelNameId: null,
			},
		]);
	});
});

describe("bitmap", () => {
	let font = unwrap(parseFont(APPLE));

	test("returns a glyph's PNG image", () => {
		let image = bitmap(font, font.glyphIndex(WINK), 32);
		expect(image).toMatchObject({ type: "png", ppem: 300, originX: 0, originY: 0 });
		expect(Array.from(image?.bytes.subarray(0, 8) ?? [])).toEqual([
			137, 80, 78, 71, 13, 10, 26, 10,
		]);
		expect(image?.bytes.byteLength).toBe(9783);
	});

	test("lists the strikes", () => {
		expect(strikes(font)).toEqual([{ ppem: 300, ppi: 72 }]);
		expect(strikes(unwrap(parseFont(MICROSOFT)))).toEqual([]);
	});

	test("answers null for a font without sbix or a glyph it lacks", () => {
		expect(bitmap(unwrap(parseFont(MICROSOFT)), 84, 32)).toBeNull();
		expect(bitmap(font, 1_000_000, 32)).toBeNull();
		expect(bitmap(font, -1, 32)).toBeNull();
	});

	/**
	 * An `sbix` table whose strikes each give glyph 1 a `png ` image tagged with the strike
	 * size, glyph 2 a `dupe` of glyph 1 and glyph 3 a `dupe` of itself.
	 */
	function sbixTable(numGlyphs: number, sizes: number[]): number[] {
		let header = [...u16(1, 1), ...u32(sizes.length)];
		let strikeData: number[][] = sizes.map((ppem) => {
			let images = [
				[],
				[...u16(1, 2), ...tag("png "), ppem & 0xff],
				[...u16(0, 0), ...tag("dupe"), ...u16(1)],
				[...u16(0, 0), ...tag("dupe"), ...u16(3)],
			];
			let offsets: number[] = [];
			let data: number[] = [];
			let base = 4 + (numGlyphs + 1) * 4;
			for (let glyph = 0; glyph <= numGlyphs; glyph++) {
				offsets.push(base + data.length);
				data.push(...(images[glyph] ?? []));
			}
			return [...u16(ppem, 72), ...u32(...offsets), ...data];
		});
		let offset = header.length + sizes.length * 4;
		let offsets: number[] = [];
		for (let strike of strikeData) {
			offsets.push(offset);
			offset += strike.length;
		}
		return [...header, ...u32(...offsets), ...strikeData.flat()];
	}

	let custom = withTables(APPLE, { sbix: sbixTable(fontData(font).numGlyphs, [64, 20, 160]) });

	test("picks the smallest strike at least the requested size, else the largest", () => {
		expect(bitmap(custom, 1, 10)?.ppem).toBe(20);
		expect(bitmap(custom, 1, 20)?.ppem).toBe(20);
		expect(bitmap(custom, 1, 21)?.ppem).toBe(64);
		expect(bitmap(custom, 1, 100)?.ppem).toBe(160);
		expect(bitmap(custom, 1, 500)?.ppem).toBe(160);
		expect(bitmap(custom, 1, 64)).toEqual({
			type: "png",
			ppem: 64,
			originX: 1,
			originY: 2,
			bytes: Uint8Array.from([64]),
		});
	});

	test("follows a dupe to the glyph it copies and stops on a cycle", () => {
		expect(bitmap(custom, 2, 64)).toEqual(bitmap(custom, 1, 64));
		expect(bitmap(custom, 3, 64)).toBeNull();
	});

	test("answers null for a glyph with no image in the strike", () => {
		expect(bitmap(custom, 0, 64)).toBeNull();
		expect(bitmap(custom, 4, 64)).toBeNull();
	});

	test("skips strikes past the table and answers null for a truncated header", () => {
		let broken = [...u16(1, 1), ...u32(1), ...u32(4000)];
		expect(strikes(withTables(APPLE, { sbix: broken }))).toEqual([]);
		expect(bitmap(withTables(APPLE, { sbix: broken }), 1, 32)).toBeNull();
		let lying = [...u16(1, 1), ...u32(0xffffffff)];
		expect(strikes(withTables(APPLE, { sbix: lying }))).toEqual([]);
	});
});
