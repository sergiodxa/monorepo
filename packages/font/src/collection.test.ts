/**
 * Tests for `parseFontCollection` against Noto Sans as a TrueType collection and as a Mac
 * dfont, collections built here from single fonts (version 2 headers, resource forks), and
 * how `parseFont` points a collection at it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseFont, parseFontCollection } from "./index.js";

/** A fixture's bytes. */
function fixture(path: string): Uint8Array {
	return new Uint8Array(readFileSync(new URL(`./fixtures/${path}`, import.meta.url)));
}

/** Big-endian unsigned 16-bit fields. */
function u16(...values: number[]): number[] {
	return values.flatMap((value) => [(value >> 8) & 0xff, value & 0xff]);
}

/** Big-endian unsigned 32-bit fields. */
function u32(...values: number[]): number[] {
	return values.flatMap((value) => [...u16(value >>> 16), ...u16(value & 0xffff)]);
}

/** The bytes of an ASCII string. */
function ascii(text: string): number[] {
	return Array.from(text, (char) => char.charCodeAt(0));
}

/**
 * A TrueType collection of whole sfnt files: each copied in after the header with its table
 * offsets moved to where it lands.
 */
function toTtc(fonts: Uint8Array[], version: 1 | 2): Uint8Array {
	let header = 12 + fonts.length * 4 + (version === 2 ? 12 : 0);
	let starts: number[] = [];
	let size = header;
	for (let font of fonts) {
		starts.push(size);
		size += Math.ceil(font.length / 4) * 4;
	}
	let output = new Uint8Array(size);
	let view = new DataView(output.buffer);
	output.set([...ascii("ttcf"), ...u16(version, 0), ...u32(fonts.length, ...starts)]);
	for (let [index, font] of fonts.entries()) {
		let start = starts[index] ?? 0;
		output.set(font, start);
		for (let table = 0; table < view.getUint16(start + 4); table++) {
			let record = start + 12 + table * 16 + 8;
			view.setUint32(record, view.getUint32(record) + start);
		}
	}
	return output;
}

/** A Mac resource fork holding each font as an `sfnt` resource. */
function toDfont(fonts: Uint8Array[]): Uint8Array {
	let data: number[] = [];
	let references: number[] = [];
	for (let [index, font] of fonts.entries()) {
		let offset = data.length;
		references.push(...u16(128 + index, 0xffff), 0, offset >> 16, (offset >> 8) & 0xff);
		references.push(offset & 0xff, ...u32(0));
		data.push(...u32(font.length), ...font);
	}
	let typeList = [...u16(0), ...ascii("sfnt"), ...u16(fonts.length - 1, 10)];
	let map = [
		...Array.from({ length: 24 }, () => 0),
		...u16(28, 28 + typeList.length + references.length),
	];
	map.push(...typeList, ...references);
	let header = u32(256, 256 + data.length, data.length, map.length);
	let padding = Array.from({ length: 256 - 16 }, () => 0);
	return Uint8Array.from([...header, ...padding, ...data, ...map]);
}

describe("parseFontCollection", () => {
	test("opens every font of a TrueType collection, in file order", () => {
		let collection = unwrap(parseFontCollection(fixture("NotoSans/NotoSans.ttc")));
		expect(collection.fonts.map((font) => font.postscriptName)).toEqual([
			"NotoSans-Bold",
			"NotoSans",
			"NotoSans-Italic",
			"NotoSans-BoldItalic",
		]);
		expect(collection.get("NotoSans-Italic")?.postscriptName).toBe("NotoSans-Italic");
		expect(collection.get("NotoSans-Italic")?.isItalic).toBe(true);
		expect(collection.get("NotoSans")?.postscriptName).toBe("NotoSans");
		expect(collection.get("Missing")).toBeNull();
	});

	test("opens every font of a dfont, in resource order", () => {
		let collection = unwrap(parseFontCollection(fixture("NotoSans/NotoSans.dfont")));
		expect(collection.fonts.map((font) => font.postscriptName)).toEqual([
			"NotoSans",
			"NotoSans-Bold",
			"NotoSans-Italic",
			"NotoSans-BoldItalic",
		]);
		let font = collection.get("NotoSans-Italic");
		expect(font?.postscriptName).toBe("NotoSans-Italic");
		expect(font?.isItalic).toBe(true);
		let glyph = font?.glyphIndex("g".codePointAt(0) ?? 0) ?? 0;
		expect(glyph).toBeGreaterThan(0);
		expect(font?.outline(glyph).length).toBeGreaterThan(0);
	});

	test("reads version 2 collection headers", () => {
		let fonts = [fixture("inter-regular.ttf"), fixture("fonttest/TestGVAROne.ttf")];
		for (let version of [1, 2] as const) {
			let collection = unwrap(parseFontCollection(toTtc(fonts, version)));
			expect(collection.fonts.map((font) => font.postscriptName)).toEqual([
				"Inter-Regular",
				"MYingHeiPRC-W5",
			]);
			expect(collection.get("Inter-Regular")?.measure("Collection", 20)).toBe(
				unwrap(parseFont(fixture("inter-regular.ttf"))).measure("Collection", 20),
			);
		}
	});

	test("reads resource forks built from single fonts", () => {
		let fonts = [fixture("fonttest/TestGVAROne.ttf"), fixture("inter-regular.ttf")];
		let collection = unwrap(parseFontCollection(toDfont(fonts)));
		expect(collection.fonts.map((font) => font.postscriptName)).toEqual([
			"MYingHeiPRC-W5",
			"Inter-Regular",
		]);
	});

	test("opens a single font or WOFF as a collection of one", () => {
		let collection = unwrap(parseFontCollection(fixture("inter-regular.ttf")));
		expect(collection.fonts.map((font) => font.postscriptName)).toEqual(["Inter-Regular"]);
		let woff = unwrap(parseFontCollection(fixture("fonttest/TestGVAROne.woff")));
		expect(woff.fonts).toHaveLength(1);
	});

	test("sends WOFF2 to @sdxc/font/woff2", () => {
		let result = parseFontCollection(fixture("Mada/Mada-VF.woff2"));
		expect(isFailure(result) && result.error.code).toBe("unsupported");
		expect(isFailure(result) && result.error.message).toContain("@sdxc/font/woff2");
	});

	test("fails as a whole when one font cannot be read, with that font's error", () => {
		let broken = Uint8Array.from(fixture("fonttest/TestGVAROne.ttf"));
		broken.set(ascii("xxxx"), 12);
		broken.set(ascii("xxxx"), 28);
		let fonts = [fixture("inter-regular.ttf"), broken];
		let ttc = parseFontCollection(toTtc(fonts, 1));
		expect(isFailure(ttc) && ttc.error.code).toBe("missing-table");
		let dfont = parseFontCollection(toDfont(fonts));
		expect(isFailure(dfont) && dfont.error.code).toBe("missing-table");
	});

	test("rejects truncated or unknown collection headers", () => {
		let ttc = toTtc([fixture("fonttest/TestGVAROne.ttf")], 1);
		let unknown = Uint8Array.from(ttc);
		unknown[5] = 3;
		expect(isFailure(parseFontCollection(unknown))).toBe(true);
		let many = Uint8Array.from(ttc);
		new DataView(many.buffer).setUint32(8, 0x10000);
		expect(isFailure(parseFontCollection(many))).toBe(true);
		let empty = Uint8Array.from(ttc);
		new DataView(empty.buffer).setUint32(8, 0);
		expect(isFailure(parseFontCollection(empty))).toBe(true);
		let dfont = toDfont([fixture("fonttest/TestGVAROne.ttf")]);
		for (let length of [8, 20, 300, dfont.length - 20]) {
			expect(isFailure(parseFontCollection(dfont.subarray(0, length)))).toBe(true);
		}
	});

	test("never throws on corrupt collections", () => {
		let dfont = toDfont([fixture("fonttest/TestGVAROne.ttf")]);
		let ttc = toTtc([fixture("fonttest/TestGVAROne.ttf")], 2);
		for (let bytes of [dfont, ttc]) {
			for (let seed = 0; seed < 200; seed++) {
				let corrupt = Uint8Array.from(bytes);
				let at = (seed * 7919) % Math.min(corrupt.length, 400);
				corrupt[at] = (corrupt[at] ?? 0) ^ (1 << (seed % 8));
				let at2 = corrupt.length - 1 - ((seed * 31) % 100);
				corrupt[at2] = (corrupt[at2] ?? 0) ^ 0xff;
				expect(() => parseFontCollection(corrupt)).not.toThrow();
			}
		}
	});
});

describe("parseFont on a collection", () => {
	test("names parseFontCollection for a .ttc or a .dfont", () => {
		for (let path of ["NotoSans/NotoSans.ttc", "NotoSans/NotoSans.dfont"]) {
			let result = parseFont(fixture(path));
			expect(isFailure(result) && result.error.code).toBe("unsupported");
			expect(isFailure(result) && result.error.message).toContain("parseFontCollection");
		}
	});
});
