/**
 * Tests for character mapping against real fonts: Open Sans (format 4), Adobe's format 10
 * test font, the Unicode variation-sequence fonts (format 14) and a Mac Turkish legacy
 * `cmap`, plus the reverse mapping from glyphs back to strings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Font } from "./font.js";

import { parseFont } from "./index.js";

/**
 * Opens a fixture font.
 *
 * @param path - Path under `src/fixtures/`.
 */
function open(path: string): Font {
	return unwrap(parseFont(readFileSync(new URL(`./fixtures/${path}`, import.meta.url))));
}

/**
 * The glyph of each character in a string, a variation selector folded into the character
 * before it, as `layout` places them.
 *
 * @param font - The font.
 * @param text - The characters.
 */
function glyphs(font: Font, text: string): number[] {
	return font.layout(text, font.unitsPerEm).glyphs.map(({ glyph }) => glyph);
}

describe("Open Sans", () => {
	let font = open("OpenSans/OpenSans-Regular.ttf");

	test("lists the characters it maps, leaving .notdef ones out", () => {
		expect(font.characterSet).toHaveLength(883);
		expect(font.characterSet).not.toContain(0xffff);
		expect(font.characterSet.every((codePoint) => font.hasGlyph(codePoint))).toBe(true);
		expect([...font.characterSet].sort((a, b) => a - b)).toEqual(font.characterSet);
	});

	test("builds the character set once per font", () => {
		let other = open("OpenSans/OpenSans-Regular.ttf");
		expect(font.characterSet).toBe(font.characterSet);
		expect(other.characterSet).toEqual(font.characterSet);
		expect(other.characterSet).not.toBe(font.characterSet);
	});

	test("checks whether a character has a glyph", () => {
		expect(font.hasGlyph(0x61)).toBe(true);
		expect(font.hasGlyph(0)).toBe(false);
	});

	test("maps characters and strings to glyphs", () => {
		expect(font.glyphIndex(0x61)).toBe(68);
		expect(glyphs(font, "hello")).toEqual([75, 72, 79, 79, 82]);
	});

	test("maps glyphs back to the strings that draw them", () => {
		expect(font.stringsForGlyph(68)).toEqual(["a"]);
		expect(font.stringsForGlyph(69)).toEqual(["b"]);
		expect(font.stringsForGlyph(0xffff)).toEqual([]);
	});
});

describe("cmap format 10", () => {
	let font = open("aots/cmap10_font1.otf");

	test("maps trimmed-array code points", () => {
		expect(font.characterSet).toEqual([0x109423, 0x109424, 0x109425]);
		expect(glyphs(font, "\u{109423}\u{109424}\u{109425}")).toEqual([26, 27, 32]);
		expect(font.stringsForGlyph(27)).toEqual(["\u{109424}"]);
	});
});

describe("Unicode variation sequences", () => {
	test("pick the variant a format 14 subtable lists", () => {
		let font = open("fonttest/TestCMAP14.otf");
		expect(font.characterSet).toEqual([0x20, 0x2269, 0x82a6]);
		expect(glyphs(font, "\u{82a6}\u{82a6}\u{E0100}\u{82a6}\u{E0101}")).toEqual([1, 1, 2]);
		expect(font.glyphIndex(0x82a6, 0xe0101)).toBe(2);
		expect(font.glyphIndex(0x82a6, 0xe0100)).toBe(1);
		expect(font.glyphIndex(0x82a6, 0xfe0f)).toBe(1);
	});

	test("use non-default sequences when the selector also has default ones", () => {
		let font = open("NotoSansCJK/NotoSansCJKjp-Regular-subset.otf");
		expect(glyphs(font, "\u{4FAE}\u{FE00}\u{3001}\u{FE00}\u{4FAE}")).toEqual([
			font.glyphIndex(0xfa30),
			font.glyphIndex(0x3001),
			font.glyphIndex(0x4fae),
		]);
		expect(font.glyphIndex(0xfa30)).not.toBe(font.glyphIndex(0x4fae));
	});

	test("place no glyph for a selector, even one without a base", () => {
		let font = open("OpenSans/OpenSans-Regular.ttf");
		expect(glyphs(font, "\u{FE0F}a\u{FE0F}b")).toEqual([68, 69]);
	});
});

describe("legacy encodings", () => {
	let font = open("fonttest/TestCMAPMacTurkish.ttf");

	test("map Unicode through the Mac Turkish encoding when no Unicode cmap exists", () => {
		expect(glyphs(font, "“ABÇĞIİÖŞÜ”")).toEqual([
			200, 34, 35, 126, 176, 42, 178, 140, 181, 145, 201,
		]);
	});

	test("map characters the encoding lacks to .notdef", () => {
		expect(glyphs(font, "  ¹\u0080")).toEqual([1, 96, 0, 0]);
	});

	test("list the character set in Unicode", () => {
		expect(font.characterSet).toContain(0x011e);
		expect(font.characterSet).not.toContain(0x2044);
		expect(font.stringsForGlyph(176)).toEqual(["Ğ"]);
	});
});
