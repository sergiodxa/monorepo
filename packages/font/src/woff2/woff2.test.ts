/**
 * Tests for WOFF2 decoding: SourceSansPro, TestGVAROne, TestGVARFour, Mada and
 * AdobeVFPrototype against the sfnt or WOFF each was made from, WOFF2 files re-encoded here to
 * reach the `hmtx` transform and collections, and every way a WOFF2 file can be inconsistent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Font } from "../font.js";

import { parseFont, parseFontCollection } from "../index.js";
import { Reader } from "../reader.js";

import { reconstructGlyf } from "./glyf.js";

import { decodeWoff2, parseWoff2 } from "./index.js";

/** One table of a WOFF2 directory, with its bytes as stored in the compressed stream. */
interface Entry {
	tag: string;
	version: number;
	transformed: boolean;
	length: number;
	data: Uint8Array;
}

/** A WOFF2 file taken apart: flavor, tables and, for a collection, its fonts. */
interface Woff2File {
	flavor: number;
	entries: Entry[];
	collection?: { version: number; fonts: { flavor: number; tables: number[] }[] };
}

const KNOWN_TAGS = [
	"cmap",
	"head",
	"hhea",
	"hmtx",
	"maxp",
	"name",
	"OS/2",
	"post",
	"cvt ",
	"fpgm",
	"glyf",
	"loca",
	"prep",
	"CFF ",
	"VORG",
	"EBDT",
	"EBLC",
	"gasp",
	"hdmx",
	"kern",
	"LTSH",
	"PCLT",
	"VDMX",
	"vhea",
	"vmtx",
	"BASE",
	"GDEF",
	"GPOS",
	"GSUB",
	"EBSC",
	"JSTF",
	"MATH",
	"CBDT",
	"CBLC",
	"COLR",
	"CPAL",
	"SVG ",
	"sbix",
	"acnt",
	"avar",
	"bdat",
	"bloc",
	"bsln",
	"cvar",
	"fdsc",
	"feat",
	"fmtx",
	"fvar",
	"gvar",
	"hsty",
	"just",
	"lcar",
	"mort",
	"morx",
	"opbd",
	"prop",
	"trak",
	"Zapf",
	"Silf",
	"Glat",
	"Gloc",
	"Feat",
	"Sill",
];

/** A fixture's bytes. */
function fixture(path: string): Uint8Array {
	return new Uint8Array(readFileSync(new URL(`../fixtures/${path}`, import.meta.url)));
}

/** Big-endian unsigned 16-bit fields. */
function u16(...values: number[]): number[] {
	return values.flatMap((value) => [(value >> 8) & 0xff, value & 0xff]);
}

/** Big-endian unsigned 32-bit fields. */
function u32(...values: number[]): number[] {
	return values.flatMap((value) => [...u16(value >>> 16), ...u16(value & 0xffff)]);
}

/** A `UIntBase128`. */
function base128(value: number): number[] {
	let bytes = [value & 0x7f];
	for (let rest = Math.floor(value / 128); rest > 0; rest = Math.floor(rest / 128)) {
		bytes.unshift((rest & 0x7f) | 0x80);
	}
	return bytes;
}

/** A `255UInt16`. */
function u255(value: number): number[] {
	return value < 253 ? [value] : [253, ...u16(value)];
}

/** Takes a single-font WOFF2 apart, decompressing with Node's Brotli. */
function readWoff2(bytes: Uint8Array): Woff2File {
	let reader = new Reader(bytes);
	let count = reader.u16(12);
	let position = 48;
	let entries: Entry[] = [];
	let next = () => reader.u8(position++);
	let readBase128 = () => {
		let value = 0;
		for (;;) {
			let byte = next();
			value = value * 128 + (byte & 0x7f);
			if ((byte & 0x80) === 0) return value;
		}
	};
	for (let index = 0; index < count; index++) {
		let flags = next();
		let tag = KNOWN_TAGS[flags & 0x3f] ?? "";
		if ((flags & 0x3f) === 63) {
			tag = reader.tag(position);
			position += 4;
		}
		let version = flags >> 6;
		let transformed = tag === "glyf" || tag === "loca" ? version === 0 : version !== 0;
		let length = readBase128();
		if (transformed) length = readBase128();
		entries.push({ tag, version, transformed, length, data: new Uint8Array(0) });
	}
	let stream = brotliDecompressSync(bytes.subarray(position, position + reader.u32(20)));
	let offset = 0;
	for (let entry of entries) {
		entry.data = new Uint8Array(stream.subarray(offset, offset + entry.length));
		offset += entry.length;
	}
	return { flavor: reader.u32(4), entries };
}

/** Builds a WOFF2 file, compressing with Node's Brotli. */
function writeWoff2(file: Woff2File): Uint8Array {
	let directory: number[] = [];
	for (let entry of file.entries) {
		let known = KNOWN_TAGS.indexOf(entry.tag);
		let flags = (known < 0 ? 63 : known) | (entry.version << 6);
		directory.push(flags);
		if (known < 0) directory.push(...Array.from(entry.tag, (char) => char.charCodeAt(0)));
		directory.push(...base128(entry.transformed ? 1 : entry.data.length));
		if (entry.transformed) directory.push(...base128(entry.data.length));
	}
	if (file.collection !== undefined) {
		directory.push(...u32(file.collection.version << 16), ...u255(file.collection.fonts.length));
		for (let font of file.collection.fonts) {
			directory.push(...u255(font.tables.length), ...u32(font.flavor));
			for (let table of font.tables) directory.push(...u255(table));
		}
	}
	let stream = Buffer.concat(file.entries.map((entry) => entry.data));
	let compressed = brotliCompressSync(stream, {
		params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
	});
	let length = 48 + directory.length + compressed.length;
	let header = [
		0x77,
		0x4f,
		0x46,
		0x32,
		...u32(file.flavor, length),
		...u16(file.entries.length, 0),
	];
	header.push(...u32(0, compressed.length), ...u16(1, 0), ...u32(0, 0, 0, 0, 0));
	return Uint8Array.from([...header, ...directory, ...compressed]);
}

/** The tags and bytes of every table of an sfnt at `offset`. */
function sfntTables(bytes: Uint8Array, offset = 0): Map<string, Uint8Array> {
	let reader = new Reader(bytes);
	let tables = new Map<string, Uint8Array>();
	for (let index = 0; index < reader.u16(offset + 4); index++) {
		let record = offset + 12 + index * 16;
		tables.set(reader.tag(record), reader.bytes(reader.u32(record + 8), reader.u32(record + 12)));
	}
	return tables;
}

/**
 * Whether two tables hold the same bytes, ignoring what a WOFF2 encoder rewrites: `head`'s
 * checksum adjustment, flags (bit 11 marks a transformed font) and modified date, and a
 * `DSIG` signature, which no longer matches the font.
 */
function sameTable(tag: string, left: Uint8Array | null, right: Uint8Array | null): boolean {
	if (tag === "DSIG") return true;
	let a = Uint8Array.from(left ?? []);
	let b = Uint8Array.from(right ?? []);
	if (tag === "head") {
		for (let bytes of [a, b]) bytes.fill(0, 8, 12).fill(0, 16, 18).fill(0, 28, 36);
	}
	return Buffer.from(a).equals(Buffer.from(b));
}

/** Expects every glyph of `font` to draw, advance and box like the same glyph of `reference`. */
function expectSameGlyphs(font: Font, reference: Font): void {
	expect(font.glyphCount).toBe(reference.glyphCount);
	for (let glyph = 0; glyph < reference.glyphCount; glyph++) {
		expect(font.svgPath(glyph), `glyph ${glyph}`).toBe(reference.svgPath(glyph));
		expect(font.advance(glyph)).toBe(reference.advance(glyph));
		expect(font.glyphCBox(glyph)).toEqual(reference.glyphCBox(glyph));
	}
}

/**
 * Expects `font` to carry every table of `reference` with the same bytes, except the tables
 * a WOFF2 rebuilds rather than stores (`glyf` and `loca` when transformed).
 */
function expectSameTables(font: Font, reference: Font, rebuilt: string[] = []): void {
	for (let tag of sfntTables(fontBytes(reference)).keys()) {
		if (rebuilt.includes(tag)) continue;
		expect(sameTable(tag, font.table(tag), reference.table(tag)), tag).toBe(true);
	}
}

/** The bytes a font was opened from, through one of its tables' views. */
function fontBytes(font: Font): Uint8Array {
	let head = font.table("head") ?? new Uint8Array(0);
	return new Uint8Array(head.buffer, 0, head.buffer.byteLength);
}

describe("WOFF2 fonts", () => {
	test("opens TrueType-flavored WOFF2, rebuilding its transformed glyf", () => {
		let font = unwrap(parseWoff2(fixture("SourceSansPro/SourceSansPro-Regular.ttf.woff2")));
		expect(font.postscriptName).toBe("SourceSansPro-Regular");
		let glyph = font.glyphIndex("D".codePointAt(0) ?? 0);
		expect(font.glyphName(glyph)).toBe("D");
		expect(font.svgPath(font.glyphIndex("T".codePointAt(0) ?? 0))).toBe(
			"M226 0L226 586L28 586L28 656L508 656L508 586L310 586L310 0Z",
		);
		expect(font.svgPath(glyph)).toBe(
			"M90 0L90 656L254 656Q406 656 485 571.5Q564 487 564 331Q564 174 485.5 87Q407 0 258 0ZM173 68L248 68Q363 68 420.5 137.5Q478 207 478 331Q478 455 420.5 521.5Q363 588 248 588L173 588Z",
		);
		let box = { xMin: 90, yMin: 0, xMax: 564, yMax: 656 };
		expect(font.glyphCBox(glyph)).toEqual(box);
		expect(font.glyphBBox(glyph)).toEqual(box);
	});

	test("draws every glyph like the same font in WOFF", () => {
		let font = unwrap(parseWoff2(fixture("SourceSansPro/SourceSansPro-Regular.ttf.woff2")));
		let woff = unwrap(parseFont(fixture("SourceSansPro/SourceSansPro-Regular.ttf.woff")));
		expectSameGlyphs(font, woff);
		expectSameTables(font, woff, ["glyf", "loca"]);
	});

	test("opens CFF-flavored WOFF2 with the tables of the same font in WOFF", () => {
		let font = unwrap(parseWoff2(fixture("SourceSansPro/SourceSansPro-Regular.otf.woff2")));
		let woff = unwrap(parseFont(fixture("SourceSansPro/SourceSansPro-Regular.otf.woff")));
		expectSameTables(font, woff);
		let glyph = font.glyphIndex("D".codePointAt(0) ?? 0);
		expect(font.glyphName(glyph)).toBe("D");
		expect(font.svgPath(font.glyphIndex("T".codePointAt(0) ?? 0))).toBe(
			"M226 0L310 0L310 586L508 586L508 656L28 656L28 586L226 586Z",
		);
		expect(font.svgPath(glyph)).toBe(
			"M90 0L258 0C456 0 564 122 564 331C564 539 456 656 254 656L90 656ZM173 68L173 588L248 588C401 588 478 496 478 331C478 165 401 68 248 68Z",
		);
		expect(font.glyphCBox(glyph)).toEqual({ xMin: 90, yMin: 0, xMax: 564, yMax: 656 });
	});

	test("decodes variable fonts, transformed or not, to the font they came from", () => {
		let one = unwrap(parseFont(fixture("fonttest/TestGVAROne.ttf")));
		for (let path of ["fonttest/TestGVAROne.woff2", "fonttest/TestGVAROne.untransformed.woff2"]) {
			let font = unwrap(parseWoff2(fixture(path)));
			expect(font.postscriptName).toBe(one.postscriptName);
			expect(font.characterSet).toEqual(one.characterSet);
			expectSameGlyphs(font, one);
			expectSameTables(font, one, path.includes("untransformed") ? [] : ["glyf", "loca"]);
		}
		let four = unwrap(parseFont(fixture("fonttest/TestGVARFour.ttf")));
		let fourWoff2 = unwrap(parseWoff2(fixture("fonttest/TestGVARFour.woff2")));
		expectSameGlyphs(fourWoff2, four);
		expectSameTables(fourWoff2, four, ["glyf", "loca"]);
		let cff2 = unwrap(decodeWoff2(fixture("fonttest/AdobeVFPrototype-Subset.woff2")));
		let otf = sfntTables(fixture("fonttest/AdobeVFPrototype-Subset.otf"));
		for (let [tag, bytes] of sfntTables(cff2)) {
			if (tag !== "head") expect(sameTable(tag, bytes, otf.get(tag) ?? null), tag).toBe(true);
		}
		expect(unwrap(parseFont(cff2)).postscriptName).toBe("AdobeVFPrototype-Master_2");
	});

	test("rebuilds Mada's composite and overlapping glyphs exactly", () => {
		let font = unwrap(parseWoff2(fixture("Mada/Mada-VF.woff2")));
		let reference = unwrap(parseFont(fixture("Mada/Mada-VF.ttf")));
		expectSameGlyphs(font, reference);
		expectSameTables(font, reference, ["glyf", "loca"]);
	});

	test("writes valid table checksums and checksum adjustment", () => {
		let sfnt = unwrap(decodeWoff2(fixture("Mada/Mada-VF.woff2")));
		let view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);
		let sum = (start: number, length: number) => {
			let total = 0;
			for (let index = 0; index < length; index += 4) {
				total = (total + view.getUint32(start + index)) >>> 0;
			}
			return total;
		};
		for (let index = 0; index < view.getUint16(4); index++) {
			let record = 12 + index * 16;
			let tag = String.fromCharCode(...sfnt.subarray(record, record + 4));
			let start = view.getUint32(record + 8);
			let expected = sum(start, Math.ceil(view.getUint32(record + 12) / 4) * 4);
			if (tag === "head") expected = (expected - view.getUint32(start + 8)) >>> 0;
			expect(view.getUint32(record + 4), tag).toBe(expected);
		}
		expect(sum(0, sfnt.length)).toBe(0xb1b0afba);
		let count = view.getUint16(4);
		let power = 2 ** Math.floor(Math.log2(count));
		expect([view.getUint16(6), view.getUint16(8), view.getUint16(10)]).toEqual([
			power * 16,
			Math.log2(power),
			count * 16 - power * 16,
		]);
	});

	test("decodes in well under a second", () => {
		let files = [
			fixture("SourceSansPro/SourceSansPro-Regular.ttf.woff2"),
			fixture("SourceSansPro/SourceSansPro-Regular.otf.woff2"),
			fixture("Mada/Mada-VF.woff2"),
		];
		for (let file of files) decodeWoff2(file);
		for (let file of files) {
			let start = performance.now();
			expect(isSuccess(decodeWoff2(file))).toBe(true);
			expect(performance.now() - start).toBeLessThan(250);
		}
	});

	test("the main entry never loads the Brotli decoder", () => {
		let seen = new Set<string>();
		let pending = [new URL("../index.ts", import.meta.url)];
		while (pending.length > 0) {
			let url = pending.pop();
			if (url === undefined || seen.has(url.href)) continue;
			seen.add(url.href);
			let source = readFileSync(url, "utf8");
			for (let match of source.matchAll(/^(?:import|export)[^;]*?from "(\.[^"]+)\.js";/gm)) {
				pending.push(new URL(`${match[1]}.ts`, url));
			}
		}
		expect([...seen].some((href) => href.endsWith("/parse-font.ts"))).toBe(true);
		expect([...seen].filter((href) => href.includes("/woff2/"))).toEqual([]);
	});

	test("parseFont names @sdxc/font/woff2 for a WOFF2", () => {
		let result = parseFont(fixture("Mada/Mada-VF.woff2"));
		expect(isFailure(result) && result.error.code).toBe("unsupported");
		expect(isFailure(result) && result.error.message).toContain("@sdxc/font/woff2");
	});
});

describe("re-encoded WOFF2 files", () => {
	/** A font's `hmtx` in the transformed form, side bearings omitted per `flags`. */
	function transformHmtx(font: Font, flags: number): Uint8Array {
		let hmtx = font.table("hmtx") ?? new Uint8Array(0);
		let metrics = (font.table("hhea") ?? new Uint8Array(36))[35] ?? 0;
		let view = new DataView(hmtx.buffer, hmtx.byteOffset, hmtx.byteLength);
		let bytes = [flags];
		for (let glyph = 0; glyph < metrics; glyph++) bytes.push(...u16(view.getUint16(glyph * 4)));
		if (!(flags & 1)) {
			for (let glyph = 0; glyph < metrics; glyph++) {
				bytes.push(...u16(view.getUint16(glyph * 4 + 2)));
			}
		}
		if (!(flags & 2)) {
			for (let glyph = metrics; glyph < font.glyphCount; glyph++) {
				bytes.push(...u16(view.getUint16(metrics * 4 + (glyph - metrics) * 2)));
			}
		}
		return Uint8Array.from(bytes);
	}

	/** Replaces a WOFF2's `hmtx` entry with its transformed form. */
	function withTransformedHmtx(path: string, flags: number): Uint8Array {
		let file = readWoff2(fixture(path));
		let font = unwrap(parseWoff2(fixture(path)));
		file.entries = file.entries.map((entry) =>
			entry.tag === "hmtx"
				? { ...entry, version: 1, transformed: true, data: transformHmtx(font, flags) }
				: entry,
		);
		return writeWoff2(file);
	}

	test("re-encoding a fixture decodes to the same font", () => {
		let original = unwrap(decodeWoff2(fixture("fonttest/TestGVAROne.woff2")));
		let copy = writeWoff2(readWoff2(fixture("fonttest/TestGVAROne.woff2")));
		expect(Buffer.from(unwrap(decodeWoff2(copy))).equals(Buffer.from(original))).toBe(true);
	});

	test("rebuilds a transformed hmtx from glyph xMins", () => {
		let reference = unwrap(parseFont(fixture("fonttest/TestGVAROne.ttf")));
		for (let path of ["fonttest/TestGVAROne.woff2", "fonttest/TestGVAROne.untransformed.woff2"]) {
			for (let flags of [1, 2, 3]) {
				let font = unwrap(parseWoff2(withTransformedHmtx(path, flags)));
				expect(sameTable("hmtx", font.table("hmtx"), reference.table("hmtx")), path).toBe(true);
			}
		}
	});

	test("decodes a collection, sharing the tables its fonts share", () => {
		let ttc = fixture("NotoSans/NotoSans.ttc");
		let reader = new Reader(ttc);
		let offsets = new Map<number, number>();
		let entries: Entry[] = [];
		let fonts: { flavor: number; tables: number[] }[] = [];
		for (let font = 0; font < reader.u32(8); font++) {
			let start = reader.u32(12 + font * 4);
			let tables: number[] = [];
			for (let index = 0; index < reader.u16(start + 4); index++) {
				let record = start + 12 + index * 16;
				let offset = reader.u32(record + 8);
				let tag = reader.tag(record);
				if (!offsets.has(offset)) {
					offsets.set(offset, entries.length);
					let data = reader.bytes(offset, reader.u32(record + 12));
					let version = tag === "glyf" || tag === "loca" ? 3 : 0;
					entries.push({ tag, version, transformed: false, length: data.length, data });
				}
				tables.push(offsets.get(offset) ?? 0);
			}
			fonts.push({ flavor: reader.u32(start), tables });
		}
		expect(entries.length).toBeLessThan(fonts.reduce((sum, font) => sum + font.tables.length, 0));
		for (let version of [1, 2]) {
			let woff2 = writeWoff2({ flavor: 0x74746366, entries, collection: { version, fonts } });
			let decoded = unwrap(decodeWoff2(woff2));
			expect(new Reader(decoded).u16(4)).toBe(version);
			let collection = unwrap(parseFontCollection(decoded));
			let original = unwrap(parseFontCollection(ttc));
			expect(collection.fonts.map((font) => font.postscriptName)).toEqual(
				original.fonts.map((font) => font.postscriptName),
			);
			for (let [index, font] of collection.fonts.entries()) {
				expectSameTables(font, original.fonts[index] ?? font);
			}
			let parsed = parseWoff2(woff2);
			expect(isFailure(parsed) && parsed.error.message).toContain("parseFontCollection");
		}
	});
});

describe("rejected WOFF2 files", () => {
	let file = fixture("fonttest/TestGVAROne.woff2");

	/** The code and table of a rejection. */
	function rejection(bytes: Uint8Array) {
		let result = decodeWoff2(bytes);
		if (!isFailure(result)) return null;
		return { code: result.error.code, table: result.error.table };
	}

	/** Rebuilds the fixture with one entry changed. */
	function changed(tag: string, change: (entry: Entry) => Entry): Uint8Array {
		let woff2 = readWoff2(file);
		woff2.entries = woff2.entries.map((entry) => (entry.tag === tag ? change(entry) : entry));
		return writeWoff2(woff2);
	}

	test("rejects a bad signature, a truncated header or directory", () => {
		expect(rejection(fixture("fonttest/TestGVAROne.woff"))?.code).toBe("malformed");
		expect(rejection(file.subarray(0, 30))?.code).toBe("malformed");
		expect(rejection(file.subarray(0, 60))?.code).toBe("malformed");
	});

	test("rejects compressed data past the end or corrupt", () => {
		expect(rejection(file.subarray(0, file.length - 10))?.code).toBe("malformed");
		let corrupt = Uint8Array.from(file);
		for (let at = 200; at < 260; at++) corrupt[at] = 0xff;
		expect(rejection(corrupt)?.code).toBe("malformed");
	});

	test("rejects unknown transforms and mismatched glyf and loca", () => {
		expect(
			rejection(changed("hmtx", (entry) => ({ ...entry, version: 2, transformed: true }))),
		).toEqual({ code: "malformed", table: "hmtx" });
		expect(
			rejection(changed("cmap", (entry) => ({ ...entry, version: 1, transformed: true }))),
		).toEqual({ code: "malformed", table: "cmap" });
		expect(rejection(changed("glyf", (entry) => ({ ...entry, version: 1 })))).toEqual({
			code: "malformed",
			table: "glyf",
		});
		expect(
			rejection(changed("loca", (entry) => ({ ...entry, data: Uint8Array.of(0, 0) }))),
		).toEqual({ code: "malformed", table: "loca" });
		expect(
			rejection(changed("loca", (entry) => ({ ...entry, version: 3, transformed: false }))),
		).toEqual({ code: "malformed", table: "loca" });
	});

	test("rejects a transformed glyf whose streams are inconsistent", () => {
		let glyf = readWoff2(file).entries.find((entry) => entry.tag === "glyf")?.data;
		let streams = Uint8Array.from(glyf ?? []);
		new DataView(streams.buffer).setUint32(8, 0xffff);
		expect(isFailure(reconstructGlyf(streams))).toBe(true);
		expect(isFailure(reconstructGlyf(Uint8Array.from(glyf ?? []).subarray(0, 100)))).toBe(true);
	});

	test("never throws on corrupt input", () => {
		let glyf =
			readWoff2(file).entries.find((entry) => entry.tag === "glyf")?.data ?? new Uint8Array();
		for (let seed = 0; seed < 300; seed++) {
			let corrupt = Uint8Array.from(glyf);
			let at = (seed * 7919) % corrupt.length;
			corrupt[at] = (corrupt[at] ?? 0) ^ (1 << (seed % 8));
			expect(() => reconstructGlyf(corrupt)).not.toThrow();
			let bytes = Uint8Array.from(file);
			let index = (seed * 104729) % bytes.length;
			bytes[index] = (bytes[index] ?? 0) ^ (1 << (seed % 8));
			expect(() => decodeWoff2(bytes)).not.toThrow();
		}
	});
});
