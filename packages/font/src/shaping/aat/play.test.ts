/**
 * Tests for AAT shaping against Play, whose substitutions live in `morx` and whose kerning
 * lives in `kern`, with no GSUB or GPOS.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseFont } from "../../index.js";
import { availableFeatures, shape } from "../index.js";

/** Play Regular, an OFL font with `morx`, `feat` and `kern`. */
const PLAY = unwrap(
	parseFont(readFileSync(new URL("../../fixtures/Play/Play-Regular.ttf", import.meta.url))),
);

describe("AAT features", () => {
	test("should apply kerning by default", () => {
		let { glyphs } = shape(PLAY, "Twitter");
		expect(glyphs.map((glyph) => glyph.xAdvance)).toEqual([535, 792, 246, 372, 402, 535, 351]);
	});

	test("should list available features", () => {
		expect(availableFeatures(PLAY)).toEqual([
			"tnum",
			"sups",
			"subs",
			"frac",
			"onum",
			"lnum",
			"liga",
			"kern",
		]);
	});

	test("should apply default AAT morx features", () => {
		let { glyphs } = shape(PLAY, "ffi 1⁄2");
		expect(glyphs.map((glyph) => glyph.glyph)).toEqual([767, 3, 20, 645, 21]);
		expect(glyphs.map((glyph) => glyph.codePoints)).toEqual([
			[102, 102, 105],
			[32],
			[49],
			[8260],
			[50],
		]);
	});

	test("should allow for disabling of default AAT morx features", () => {
		let { glyphs } = shape(PLAY, "ffi 1⁄2", { features: { liga: false } });
		expect(glyphs.map((glyph) => glyph.glyph)).toEqual([73, 73, 76, 3, 20, 645, 21]);
		expect(glyphs.map((glyph) => glyph.codePoints)).toEqual([
			[102],
			[102],
			[105],
			[32],
			[49],
			[8260],
			[50],
		]);
	});

	test("should apply user specified features", () => {
		let { glyphs } = shape(PLAY, "ffi 1⁄2", { features: ["numr"] });
		expect(glyphs.map((glyph) => glyph.glyph)).toEqual([767, 3, 126]);
		expect(glyphs.map((glyph) => glyph.codePoints)).toEqual([
			[102, 102, 105],
			[32],
			[49, 8260, 50],
		]);
	});
});
