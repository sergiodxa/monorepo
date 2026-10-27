/**
 * Tests for WOFF decoding through `parseFont`: SourceSansPro, TestGVAROne and
 * AdobeVFPrototype in WOFF against the sfnt each was made from, WOFF files built here from
 * Inter with stored and compressed tables, and every way a WOFF file can be inconsistent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Font } from "./font.js";

import { Reader } from "./reader.js";
import { decodeWoff } from "./woff.js";

import { parseFont } from "./index.js";

/** A fixture's bytes. */
function fixture(path: string): Uint8Array {
	return new Uint8Array(readFileSync(new URL(`./fixtures/${path}`, import.meta.url)));
}

/** The tags and bytes of every table of an sfnt, in directory order. */
function sfntTables(bytes: Uint8Array): [string, Uint8Array][] {
	let reader = new Reader(bytes);
	let count = reader.u16(4);
	return Array.from({ length: count }, (_, index) => {
		let record = 12 + index * 16;
		let tag = reader.tag(record);
		return [tag, reader.bytes(reader.u32(record + 8), reader.u32(record + 12))];
	});
}

/** Wraps an sfnt in WOFF, compressing the tables `compress` picks. */
function toWoff(sfnt: Uint8Array, compress: (tag: string) => boolean): Uint8Array {
	let tables = sfntTables(sfnt);
	let directory: number[] = [];
	let data: number[] = [];
	let offset = 44 + tables.length * 20;
	for (let [tag, bytes] of tables) {
		let stored = compress(tag) ? deflateSync(bytes) : bytes;
		if (stored.length >= bytes.length) stored = bytes;
		directory.push(...ascii(tag), ...u32(offset, stored.length, bytes.length, 0));
		data.push(...stored);
		while (data.length % 4 !== 0) data.push(0);
		offset = 44 + tables.length * 20 + data.length;
	}
	let header = [...ascii("wOFF"), ...u32(0x00010000, offset), ...u16(tables.length, 0)];
	header.push(...u32(sfnt.length), ...u16(1, 0), ...u32(0, 0, 0, 0, 0));
	return Uint8Array.from([...header, ...directory, ...data]);
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
 * Every table of `font` equals the same table of `reference`, byte for byte, except the
 * `head` fields a WOFF encoder rewrites: the checksum adjustment and the modified date.
 */
function expectSameTables(font: Font, reference: Uint8Array): void {
	for (let [tag, bytes] of sfntTables(reference)) {
		let actual = Uint8Array.from(font.table(tag) ?? []);
		let expected = Uint8Array.from(bytes);
		if (tag === "head") {
			for (let range of [actual, expected]) range.fill(0, 8, 12).fill(0, 28, 36);
		}
		expect(Buffer.from(actual).equals(Buffer.from(expected)), tag).toBe(true);
	}
}

describe("WOFF fonts", () => {
	test("opens TrueType-flavored WOFF", () => {
		let font = unwrap(parseFont(fixture("SourceSansPro/SourceSansPro-Regular.ttf.woff")));
		expect(font.postscriptName).toBe("SourceSansPro-Regular");
		expect(font.glyphCount).toBe(1974);
		let glyph = font.glyphIndex("D".codePointAt(0) ?? 0);
		expect(font.glyphName(glyph)).toBe("D");
		expect(font.outline(glyph).some((command) => command.type === "quad")).toBe(true);
		expect(font.svgPath(glyph)).toBe(
			"M90 0L90 656L254 656Q406 656 485 571.5Q564 487 564 331Q564 174 485.5 87Q407 0 258 0ZM173 68L248 68Q363 68 420.5 137.5Q478 207 478 331Q478 455 420.5 521.5Q363 588 248 588L173 588Z",
		);
	});

	test("opens CFF-flavored WOFF", () => {
		let font = unwrap(parseFont(fixture("SourceSansPro/SourceSansPro-Regular.otf.woff")));
		expect(font.postscriptName).toBe("SourceSansPro-Regular");
		expect(font.glyphCount).toBe(1974);
		expect(font.table("CFF ")?.subarray(0, 2)).toEqual(Uint8Array.of(1, 0));
		let glyph = font.glyphIndex("D".codePointAt(0) ?? 0);
		expect(font.glyphName(glyph)).toBe("D");
		expect(font.svgPath(glyph)).toBe(
			"M90 0L258 0C456 0 564 122 564 331C564 539 456 656 254 656L90 656ZM173 68L173 588L248 588C401 588 478 496 478 331C478 165 401 68 248 68Z",
		);
	});

	test("decodes variable fonts to the sfnt they came from", () => {
		let font = unwrap(parseFont(fixture("fonttest/TestGVAROne.woff")));
		let reference = unwrap(parseFont(fixture("fonttest/TestGVAROne.ttf")));
		expectSameTables(font, fixture("fonttest/TestGVAROne.ttf"));
		expect(font.postscriptName).toBe(reference.postscriptName);
		for (let glyph = 0; glyph < reference.glyphCount; glyph++) {
			expect(font.svgPath(glyph)).toBe(reference.svgPath(glyph));
			expect(font.advance(glyph)).toBe(reference.advance(glyph));
		}
		let four = unwrap(parseFont(fixture("fonttest/TestGVARFour.woff")));
		expectSameTables(four, fixture("fonttest/TestGVARFour.ttf"));
		let cff2 = decodeWoff(new Reader(fixture("fonttest/AdobeVFPrototype-Subset.woff")));
		let tables = new Map(sfntTables(unwrap(cff2)));
		for (let [tag, bytes] of sfntTables(fixture("fonttest/AdobeVFPrototype-Subset.otf"))) {
			if (tag === "head") continue;
			expect(Buffer.from(tables.get(tag) ?? []).equals(Buffer.from(bytes)), tag).toBe(true);
		}
	});

	test("reads stored and compressed tables alike", () => {
		let inter = fixture("inter-regular.ttf");
		let reference = unwrap(parseFont(inter));
		for (let compress of [() => false, () => true, (tag: string) => tag === "glyf"]) {
			let font = unwrap(parseFont(toWoff(inter, compress)));
			expectSameTables(font, inter);
			expect(font.measure("Hello, WOFF", 32)).toBe(reference.measure("Hello, WOFF", 32));
		}
	});
});

describe("rejected WOFF files", () => {
	/** The code and table of a WOFF rejection. */
	function rejection(bytes: Uint8Array) {
		let result = parseFont(bytes);
		if (!isFailure(result)) return null;
		return { code: result.error.code, table: result.error.table };
	}

	let woff = toWoff(fixture("inter-regular.ttf"), () => true);
	let view = () => {
		let copy = Uint8Array.from(woff);
		return { copy, data: new DataView(copy.buffer) };
	};
	let firstTag = String.fromCharCode(...woff.subarray(44, 48));

	test("rejects a truncated header or directory", () => {
		expect(rejection(woff.subarray(0, 30))?.code).toBe("malformed");
		expect(rejection(woff.subarray(0, 60))?.code).toBe("malformed");
		let { copy, data } = view();
		data.setUint16(12, 0);
		expect(rejection(copy)?.code).toBe("malformed");
	});

	test("rejects a table past the end of the file", () => {
		let { copy, data } = view();
		data.setUint32(44 + 4, copy.length);
		expect(rejection(copy)).toEqual({ code: "malformed", table: firstTag });
	});

	test("rejects a compressed length above the original length", () => {
		let { copy, data } = view();
		data.setUint32(44 + 12, data.getUint32(44 + 8) - 1);
		expect(rejection(copy)).toEqual({ code: "malformed", table: firstTag });
	});

	test("rejects an original length the compressed data cannot reach", () => {
		let { copy, data } = view();
		data.setUint32(44 + 12, 0xffffffff);
		expect(rejection(copy)).toEqual({ code: "malformed", table: firstTag });
		let { copy: short, data: shortView } = view();
		shortView.setUint32(44 + 12, shortView.getUint32(44 + 12) + 1);
		expect(rejection(short)).toEqual({ code: "malformed", table: firstTag });
	});

	test("rejects corrupt compressed data and never throws", () => {
		let { copy, data } = view();
		let start = data.getUint32(44 + 4);
		copy[start + 5] = (copy[start + 5] ?? 0) ^ 0xff;
		expect(rejection(copy)?.code).toBe("malformed");
		for (let seed = 0; seed < 200; seed++) {
			let { copy: corrupt } = view();
			let at = (seed * 104729) % corrupt.length;
			corrupt[at] = (corrupt[at] ?? 0) ^ (1 << (seed % 8));
			expect(() => parseFont(corrupt)).not.toThrow();
		}
		expect(isSuccess(parseFont(woff))).toBe(true);
	});
});
