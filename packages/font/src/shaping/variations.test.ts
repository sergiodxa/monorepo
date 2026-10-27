/**
 * Tests for shaping variable font instances: feature variations chosen at the instance's
 * location, and GPOS anchors and value records moved by their VariationIndex deltas.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Font } from "../font.js";

import { parseFont } from "../index.js";
import { instance } from "../variations/index.js";
import { parseWoff2 } from "../woff2/index.js";

import { shape } from "./index.js";

/**
 * A fixture font.
 *
 * @param path - Path under `src/fixtures`.
 */
function font(path: string): Font {
	return unwrap(parseFont(readFileSync(new URL(`../fixtures/${path}`, import.meta.url))));
}

/**
 * The glyph names a run shapes to.
 *
 * @param shaped - The font to shape with.
 * @param text - The run.
 */
function names(shaped: Font, text: string): (string | null)[] {
	return shape(shaped, text).glyphs.map((glyph) => shaped.glyphName(glyph.glyph));
}

describe("shaping variable font instances", () => {
	test("moves GPOS mark anchors by their variation deltas, rounded to font units", () => {
		let regular = shape(font("Mada/Mada-VF.ttf"), "ف", { features: ["isol"] }).glyphs[0];
		expect(regular?.xOffset).not.toBe(640);
	});

	test("should support adjusting GPOS mark anchor points for variations", () => {
		let heavy = unwrap(instance(font("Mada/Mada-VF.ttf"), { wght: 900 }));
		let [first] = shape(heavy, "ف", { features: ["isol"] }).glyphs;
		expect(first?.xOffset).toBe(640);
		expect(first?.yOffset).toBe(542);
	});

	test("lays out text in a variation of a WOFF2", () => {
		let bytes = readFileSync(new URL("../fixtures/Mada/Mada-VF.woff2", import.meta.url));
		let heavy = unwrap(instance(unwrap(parseWoff2(bytes)), { wght: 900 }));
		let [first] = shape(heavy, "ف", { features: ["isol"] }).glyphs;
		expect(first?.xOffset).toBe(640);
		expect(first?.yOffset).toBe(542);
	});

	test("adds VariationIndex deltas to GPOS value records", () => {
		let regular = font("Mada/Mada-VF.ttf");
		let heavy = unwrap(instance(regular, { wght: 900 }));
		/**
		 * The kerning GPOS adds to the first glyph of `AT`.
		 *
		 * @param shaped - The font to shape with.
		 */
		let kerning = (shaped: Font) => {
			let [first] = shape(shaped, "AT").glyphs;
			return (first?.xAdvance ?? 0) - shaped.advance(first?.glyph ?? 0);
		};
		expect(kerning(regular)).toBe(-61);
		expect(kerning(heavy)).toBe(-76);
	});

	test("applies FeatureVariations at the default location", () => {
		expect(names(font("Archivo/Archivo-Subset.ttf"), "$¢")).toEqual([
			"dollar.BRACKET.110",
			"cent.BRACKET.110",
		]);
	});

	test("skips FeatureVariations outside their condition set", () => {
		let light = unwrap(instance(font("Archivo/Archivo-Subset.ttf"), { wght: 100 }));
		expect(names(light, "$¢")).toEqual(["dollar", "cent"]);
	});

	test("substitutes GSUB features depending on variations", () => {
		let prototype = font("fonttest/AdobeVFPrototype-Subset.otf");
		expect(names(unwrap(instance(prototype, { wght: 100 })), "$")).toEqual(["dollar"]);
		expect(names(unwrap(instance(prototype, { wght: 900 })), "$")).toEqual(["dollar.nostroke"]);
	});
});
