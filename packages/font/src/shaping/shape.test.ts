/**
 * Tests for `shape`, `availableFeatures` and `featureParams` against real fonts: lookup
 * continuation rules, GPOS kerning and marks, legacy `kern`, normalization, feature
 * variations, default ignorables, and the cases later script shapers will enable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Font } from "../font.js";

import { parseFont } from "../index.js";

import type { ShapeOptions } from "./index.js";

import { availableFeatures, featureParams, shape, UNICODE_VERSION } from "./index.js";

/** Fonts by fixture path, parsed once. */
const FONTS = new Map<string, Font>();

/**
 * A fixture font, parsed on first use.
 *
 * @param path - Path under `src/fixtures`.
 */
function font(path: string): Font {
	let cached = FONTS.get(path);
	if (cached !== undefined) return cached;
	let parsed = unwrap(parseFont(readFileSync(new URL(`../fixtures/${path}`, import.meta.url))));
	FONTS.set(path, parsed);
	return parsed;
}

/**
 * A shaped run in compact notation: `glyph@xOffset,yOffset+xAdvance`, the
 * offset only when non-zero, glyphs joined by `|`.
 *
 * @param path - Fixture path.
 * @param text - The run.
 * @param options - Shaping options.
 */
function hb(path: string, text: string, options?: ShapeOptions): string {
	return shape(font(path), text, options)
		.glyphs.map((glyph) => {
			let offset =
				glyph.xOffset !== 0 || glyph.yOffset !== 0 ? `@${glyph.xOffset},${glyph.yOffset}` : "";
			return `${glyph.glyph}${offset}+${glyph.xAdvance}`;
		})
		.join("|");
}

/**
 * The glyph indices of a shaped run.
 *
 * @param path - Fixture path.
 * @param text - The run.
 * @param options - Shaping options.
 */
function ids(path: string, text: string, options?: ShapeOptions): number[] {
	return shape(font(path), text, options).glyphs.map((glyph) => glyph.glyph);
}

/**
 * The glyph names of a shaped run.
 *
 * @param path - Fixture path.
 * @param text - The run.
 * @param options - Shaping options.
 */
function names(path: string, text: string, options?: ShapeOptions): (string | null)[] {
	let parsed = font(path);
	return shape(parsed, text, options).glyphs.map((glyph) => parsed.glyphName(glyph.glyph));
}

/**
 * Each glyph's advance and offsets, as `[xAdvance, yAdvance, xOffset, yOffset]`.
 *
 * @param path - Fixture path.
 * @param text - The run.
 * @param options - Shaping options.
 */
function positions(path: string, text: string, options?: ShapeOptions): number[][] {
	return shape(font(path), text, options).glyphs.map((glyph) => [
		glyph.xAdvance,
		glyph.yAdvance,
		glyph.xOffset,
		glyph.yOffset,
	]);
}

const SOURCE_SANS = "SourceSansPro/SourceSansPro-Regular.otf";
const FIRA = "FiraSans/FiraSans-Regular.ttf";
const AMIRI = "amiri/amiri-regular.ttf";
const CONTINUATION = "lookup-continuation/lookup-continuation.ttf";

describe("shape", () => {
	test("returns glyphs with code points, clusters and the plan it used", () => {
		let shaped = shape(font(FIRA), "office");
		expect(shaped.script).toBe("latn");
		expect(shaped.direction).toBe("ltr");
		expect(shaped.features).toContain("liga");
		expect(shaped.glyphs.length).toBeLessThan(6);
		let ligature = shaped.glyphs.find((glyph) => glyph.codePoints.length > 1);
		expect(ligature?.codePoints).toEqual([0x66, 0x69]);
		expect(ligature?.cluster).toBe(2);
		expect(shaped.advanceWidth).toBe(shaped.glyphs.reduce((sum, glyph) => sum + glyph.xAdvance, 0));
	});

	test("turns user features off", () => {
		expect(shape(font(FIRA), "office", { features: { liga: false } }).glyphs).toHaveLength(6);
	});

	test("answers an empty run for empty text", () => {
		expect(shape(font(FIRA), "").glyphs).toEqual([]);
	});

	test("gives astral characters their UTF-16 cluster", () => {
		let shaped = shape(font(FIRA), "a\u{1F600}b");
		expect(shaped.glyphs.map((glyph) => glyph.cluster)).toEqual([0, 1, 3]);
	});

	test("records the Unicode version of its tables", () => {
		expect(UNICODE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
	});

	test("reverses right-to-left runs and mirrors brackets", () => {
		let parsed = font(AMIRI);
		let shaped = shape(parsed, "(ب)");
		expect(shaped.direction).toBe("rtl");
		expect(shaped.glyphs.map((glyph) => glyph.cluster)).toEqual([2, 1, 0]);
		expect(shaped.glyphs[0]?.glyph).toBe(parsed.glyphIndex(0x28));
		expect(shaped.glyphs[2]?.glyph).toBe(parsed.glyphIndex(0x29));
	});
});

describe("opentype feature parameters", () => {
	test("featureParams nameID of stylistic set should be 257", () => {
		expect(featureParams(font(SOURCE_SANS), "ss01")).toMatchObject({
			kind: "stylistic-set",
			nameId: 257,
		});
	});

	test("featureParams version of stylistic set should be 0", () => {
		expect(featureParams(font(SOURCE_SANS), "ss01")).toMatchObject({ version: 0 });
	});

	test("featureParams should be null of aalt opentype feature", () => {
		expect(featureParams(font(SOURCE_SANS), "aalt")).toBeNull();
	});

	test("reads the size feature's design size from GPOS", () => {
		expect(featureParams(font(SOURCE_SANS), "size")).toMatchObject({
			kind: "size",
			designSize: 100,
		});
	});

	test("lists the features a script offers, legacy kern included", () => {
		expect(availableFeatures(font(SOURCE_SANS), { script: "latn" })).toEqual(
			expect.arrayContaining(["liga", "smcp", "ss01", "kern", "mark"]),
		);
		expect(availableFeatures(font("Play/Play-Regular.ttf"))).toEqual(["kern"]);
	});
});

describe("glyph positioning", () => {
	test("should get a glyph width", () => {
		expect(font(SOURCE_SANS).advance(5)).toBe(615);
	});

	test("should apply opentype GPOS features", () => {
		let shaped = shape(font(SOURCE_SANS), "Twitter");
		expect(shaped.glyphs.map((glyph) => glyph.xAdvance)).toEqual([
			502, 718, 246, 318, 324, 496, 347,
		]);
	});

	test("should ignore duplicate features", () => {
		let shaped = shape(font(SOURCE_SANS), "Twitter", { features: ["kern", "kern"] });
		expect(shaped.glyphs.map((glyph) => glyph.xAdvance)).toEqual([
			502, 718, 246, 318, 324, 496, 347,
		]);
	});

	test("should apply kerning by default (legacy kern table)", () => {
		let shaped = shape(font("Play/Play-Regular.ttf"), "Twitter");
		expect(shaped.glyphs.map((glyph) => glyph.xAdvance)).toEqual([
			535, 792, 246, 372, 402, 535, 351,
		]);
	});

	test("skips the legacy kern table when kern is turned off", () => {
		let parsed = font("Play/Play-Regular.ttf");
		let shaped = shape(parsed, "Twitter", { features: { kern: false } });
		expect(shaped.glyphs.map((glyph) => glyph.xAdvance)).toEqual(
			shaped.glyphs.map((glyph) => parsed.advance(glyph.glyph)),
		);
	});

	test("ignores the advances of marks zeroed after GPOS", () => {
		let shaped = shape(font("RobotoSerif/RobotoSerif-Subset.ttf"), "x́̈");
		expect(shaped.glyphs.map((glyph) => [glyph.xAdvance, glyph.xOffset, glyph.yOffset])).toEqual([
			[603, 0, 0],
			[0, 70, -18],
			[0, 5, -18],
		]);
	});
});

describe("general shaping", () => {
	test("should use correct script and language when features are not specified", () => {
		expect(ids(AMIRI, "۴", { script: "arab", language: "URD" })).toEqual([1940]);
	});

	test("should use specified left-to-right direction", () => {
		expect(ids(AMIRI, "١٢٣", { script: "arab", language: "ARA ", direction: "ltr" })).toEqual([
			446, 447, 448,
		]);
	});
});

describe("lookup application", () => {
	test("should not apply a multiple substitution to its own output", () => {
		expect(hb(CONTINUATION, "aa")).toBe("2+500|1+500|2+500|1+500");
	});

	test("should not skip the glyph after a deleted glyph", () => {
		expect(hb(CONTINUATION, "ccb")).toBe("2+500");
	});

	test("should continue after the input sequence of a contextual substitution", () => {
		expect(hb(CONTINUATION, "dddd")).toBe("8+500|4+500|8+500|4+500");
	});

	test("should continue after glyphs inserted by a contextual substitution", () => {
		expect(hb(CONTINUATION, "eef")).toBe("5+500|9+500|5+500|6+500");
	});

	test("should continue after the input sequence of a contextual positioning", () => {
		expect(hb(CONTINUATION, "gggg")).toBe("7+600|7+500|7+600|7+500");
	});

	test("should adjust the end of a contextual match after deletion", () => {
		expect(hb(CONTINUATION, "hhhh")).toBe("10+500|10+500");
	});

	test("should continue after a contextual match containing ignored marks", () => {
		expect(hb(CONTINUATION, "d́dd́d")).toBe("8+500|12+0|4+500|8+500|12+0|4+500");
	});

	test("should count inserted marks when advancing after a multiple substitution", () => {
		expect(hb(CONTINUATION, "ii")).toBe("9+500|12+0|11+500|9+500|12+0|11+500");
	});
});

describe("canonical composition", () => {
	test("composes base + combining mark into the precomposed glyph", () => {
		expect(ids(FIRA, "ì")).toEqual(ids(FIRA, "ì"));
	});

	test("composes a multi-mark sequence greedily", () => {
		expect(ids(FIRA, "ế")).toEqual(ids(FIRA, "ế"));
	});

	test("leaves a sequence decomposed when no Unicode composite exists", () => {
		expect(ids(FIRA, "b̀")).toHaveLength(2);
	});

	for (let text of ["ḉ", "ḉ", "ḉ"]) {
		test(`keeps the supported partial composition of ${JSON.stringify(text)}`, () => {
			expect(font(FIRA).hasGlyph(0x00e7)).toBe(true);
			expect(font(FIRA).hasGlyph(0x1e09)).toBe(false);
			expect(names(FIRA, text)).toEqual(["ccedilla", "acutecomb"]);
			expect(positions(FIRA, text)).toEqual([
				[478, 0, 0, 0],
				[0, 0, -39, 0],
			]);
		});
	}

	test("applies canonical replacements without changing the glyph count", () => {
		expect(ids(FIRA, "ȩ́")).toEqual(ids(FIRA, "ȩ́"));
		expect(positions(FIRA, "ȩ́")).toEqual(positions(FIRA, "ȩ́"));
	});

	test("replaces an unsupported singleton with its canonical equivalent", () => {
		expect(font(FIRA).hasGlyph(0x212b)).toBe(false);
		expect(ids(FIRA, "Å")).toEqual(ids(FIRA, "Å"));
	});

	test("keeps a supported singleton even when its NFC spelling differs", () => {
		expect(font(FIRA).hasGlyph(0x2126)).toBe(true);
		expect(ids(FIRA, "Ω")).toEqual([font(FIRA).glyphIndex(0x2126)]);
	});

	test("reorders marks that do not compose by combining class", () => {
		expect(names(FIRA, "q̣̇")).toEqual(["q", "dotbelowcomb", "uni0307"]);
	});

	test("does not compose across a blocking mark or combining grapheme joiner", () => {
		let parsed = font(FIRA);
		expect(ids(FIRA, "a̅́")).toEqual([0x61, 0x305, 0x301].map((cp) => parsed.glyphIndex(cp)));
		expect(ids(FIRA, "a͏́")[0]).toBe(parsed.glyphIndex(0x61));
	});

	test("does not interfere with GSUB ligatures", () => {
		expect(ids(FIRA, "office").length).toBeLessThan(6);
	});

	test("reorders and composes Arabic marks across combining classes", () => {
		expect(ids(AMIRI, "أ")).toEqual(ids(AMIRI, "أ"));
		expect(ids(AMIRI, "أً")).toEqual(ids(AMIRI, "أً"));
	});

	test("orders shadda before Arabic vowels", () => {
		let text = "اًّ";
		expect(names(AMIRI, text, { features: { calt: true }, language: "ARA " })).toEqual([
			"uni064B.small",
			"uni0651",
			"uni0627",
		]);
	});

	test("preserves remaining Arabic mark order when the cluster also composes", () => {
		let options: ShapeOptions = { features: { calt: true }, script: "arab", language: "ARA " };
		expect(names(AMIRI, "أًّ", options)).toEqual(["uni064B.small", "uni0651", "uni0623"]);
		expect(positions(AMIRI, "أًّ", options)).toEqual(positions(AMIRI, "أًّ", options));
	});

	describe("without GSUB", () => {
		let bytes = new Uint8Array(readFileSync(new URL(`../fixtures/${FIRA}`, import.meta.url)));
		let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		for (let index = 0; index < view.getUint16(4); index++) {
			let record = 12 + index * 16;
			if (String.fromCharCode(...bytes.subarray(record, record + 4)) === "GSUB") {
				bytes.set([0x4e, 0x4f, 0x4e, 0x45], record);
			}
		}
		let hidden = unwrap(parseFont(bytes));
		let run = (text: string) => shape(hidden, text).glyphs;

		test("positions the composed glyphs and the following cluster", () => {
			expect(hidden.table("GSUB")).toBeNull();
			let actual = run("ìb̀");
			let expected = run("ìb̀");
			expect(actual.map((glyph) => glyph.glyph)).toEqual(expected.map((glyph) => glyph.glyph));
			expect(actual.map(({ xAdvance, xOffset, yOffset }) => [xAdvance, xOffset, yOffset])).toEqual(
				expected.map(({ xAdvance, xOffset, yOffset }) => [xAdvance, xOffset, yOffset]),
			);
			expect(actual).toHaveLength(3);
			expect(actual[1]?.xAdvance).toBe(hidden.advance(hidden.glyphIndex(0x62)));
		});

		test("allocates positions for decomposed fallback glyphs", () => {
			let actual = run("ḉ");
			let expected = run("ḉ");
			expect(actual.map((glyph) => glyph.glyph)).toEqual(expected.map((glyph) => glyph.glyph));
			expect(actual).toHaveLength(2);
		});
	});
});

describe("GSUB type 8, default ignorables, alternates and feature variations", () => {
	test("GSUB Type 8: Coptic stacked-macron .cap variant", () => {
		expect(hb("NotoCoptic/NotoSansCoptic-Regular.ttf", "Ⲁ̅ⲁ̅")).toBe(
			"33+633|196@-319,0+0|34+574|199@-291,0+0",
		);
	});

	test("hides a soft hyphen", () => {
		expect(names(FIRA, "A­B")).toEqual(["A", "space", "B"]);
	});

	test("keeps a soft hyphen substituted by GSUB", () => {
		expect(names(FIRA, "A­B", { features: ["case"] })).toEqual(["A", "uni00AD.case", "B"]);
	});

	test("selects the first alternate when aalt is `true` (or 1)", () => {
		expect(ids(FIRA, "A", { features: { aalt: true } })).toEqual([1078]);
		expect(ids(FIRA, "A", { features: { aalt: 1 } })).toEqual([1078]);
	});

	test("selects the second alternate when aalt is 2", () => {
		expect(ids(FIRA, "A", { features: { aalt: 2 } })).toEqual([764]);
	});

	test("applies FeatureVariations at the default location", () => {
		expect(names("Archivo/Archivo-Subset.ttf", "$¢")).toEqual([
			"dollar.BRACKET.110",
			"cent.BRACKET.110",
		]);
	});
});

describe("hebrew shaper", () => {
	let HEBREW = "Hebrew/TaameyFrankCLM.ttf";

	test("should shape plain Hebrew consonants", () => {
		expect(hb(HEBREW, "קול")).toBe("40+901|33+484|50+997");
	});

	test("should position Hebrew nikud via GPOS", () => {
		expect(hb(HEBREW, "הֲבֵל")).toBe("40+901|15@512,0+0|29+967|13@600,0+0|32+1071");
	});

	test("should let the font handle dagesh composition via GSUB", () => {
		expect(hb(HEBREW, "בַּבֹּקֶר")).toBe("51+883|16@618,0+0|50+997|19@422,0+0|71+967|17@505,0+0|71+967");
	});
});
