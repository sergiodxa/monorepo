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

describe("rejected files", () => {
	/** The code and table of a rejection, for compact assertions. */
	function rejection(bytes: Uint8Array | ReturnType<typeof parseFont>) {
		let result = bytes instanceof Uint8Array ? parseFont(bytes) : bytes;
		if (!isFailure(result)) return null;
		return { code: result.error.code, table: result.error.table };
	}

	test("declines CFF fonts and collections as unsupported", () => {
		expect(rejection(sfnt(minimalTables(), ascii("OTTO")))).toEqual({
			code: "unsupported",
			table: undefined,
		});
		expect(rejection(sfnt(minimalTables(), ascii("ttcf")))?.code).toBe("unsupported");
	});

	test("reports the first missing required table", () => {
		expect(rejection(minimal({ glyf: null }))).toEqual({ code: "missing-table", table: "glyf" });
		expect(rejection(minimal({ cmap: null }))).toEqual({ code: "missing-table", table: "cmap" });
	});

	test("declines a font with no Unicode cmap subtable", () => {
		let cmap = [
			...u16(0, 1),
			...u16(1, 0),
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
