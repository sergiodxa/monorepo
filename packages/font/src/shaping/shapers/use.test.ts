/**
 * Universal Shaping Engine tests against Noto fonts: syllable reordering of repha and
 * pre-base vowels, dotted circles in broken clusters, Balinese text and joiners.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Font } from "../../font.js";

import { parseFont } from "../../index.js";
import { shape } from "../index.js";

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
	let parsed = unwrap(parseFont(readFileSync(new URL(`../../fixtures/${path}`, import.meta.url))));
	FONTS.set(path, parsed);
	return parsed;
}

/**
 * A shaped run in compact notation, `glyph@xOffset,yOffset+xAdvance` with the offset only
 * when non-zero, glyphs joined by `|`.
 *
 * @param path - Fixture path under `NotoSans/`.
 * @param text - The run.
 */
function hb(path: string, text: string): string {
	return shape(font(`NotoSans/${path}`), text)
		.glyphs.map((glyph) => {
			let offset =
				glyph.xOffset !== 0 || glyph.yOffset !== 0 ? `@${glyph.xOffset},${glyph.yOffset}` : "";
			return `${glyph.glyph}${offset}+${glyph.xAdvance}`;
		})
		.join("|");
}

describe("reorders syllables", () => {
	test.each([
		[
			"should insert a dotted circle before a lone vowel sign",
			"NotoSansBalinese-Regular.ttf",
			"ᬶ",
			"128+1127|58+0",
		],
		[
			"should keep a lone pre-base vowel sign before the dotted circle",
			"NotoSansBalinese-Regular.ttf",
			"ᬾ",
			"66+990|128+1127",
		],
		[
			"should move a repha after its base",
			"NotoSansTirhuta-Regular.ttf",
			"\u{114A9}\u{114C2}\u{1148F}",
			"25+807|134@-367,-8+0",
		],
		[
			"should move a repha within a word",
			"NotoSansTirhuta-Regular.ttf",
			"\u{1148F}\u{114A9}\u{114C2}\u{114A7}",
			"25+807|49+622|134@-355,-8+0",
		],
		[
			"should move a repha after a nukta",
			"NotoSansTirhuta-Regular.ttf",
			"\u{114A9}\u{114C2}\u{1148F}\u{114C3}\u{114B0}",
			"25+807|77@-331,165+0|134@-367,-8+0|58+266",
		],
		[
			"should only move the first part of a split pre-base vowel sign",
			"NotoSansSiddham-Regular.ttf",
			"\u{1158E}\u{115B9}",
			"61+80|25+739|260@-603,0+0",
		],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("shapes balinese text", () => {
	test.each([
		["SHBALI-1/1", "NotoSansBalinese-Regular.ttf", "ᬓᬸᬀ", "23+2275|60@5,0+0|4@-95,0+0"],
		["SHBALI-1/2", "NotoSansBalinese-Regular.ttf", "ᬕ᭄ᬖᬂ", "25+2237|132+0|6@-307,0+0"],
		["SHBALI-1/3", "NotoSansBalinese-Regular.ttf", "ᬘᬻ", "28+1627|62@3,0+0|57+916"],
		["SHBALI-1/4", "NotoSansBalinese-Regular.ttf", "ᬙᭀ", "66+990|29+2155|57+916"],
		["SHBALI-1/5", "NotoSansBalinese-Regular.ttf", "ᬚᬿ", "67+990|30+1800"],
		["SHBALI-1/6", "NotoSansBalinese-Regular.ttf", "ᬔᬶ", "24+2316|58@-620,0+0"],
		["SHBALI-1/7", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᬓᬁ", "23+2275|129+0|5@-95,0+0"],
		["SHBALI-1/8", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᬛᬁ", "23+2275|137+0|5@550,370+0"],
		["SHBALI-1/9", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᬦᬃ", "23+2275|148+0|7@-245,0+0"],
		["SHBALI-1/10", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᬓᬸ", "23+2275|129+0|60@0,-1000+0"],
		["SHBALI-1/11", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᬓᬼ", "23+2275|129+0|70@35,0+0|170@5,0+0"],
		[
			"SHBALI-1/12",
			"NotoSansBalinese-Regular.ttf",
			"ᬓ᭄ᬓᬽ",
			"23+2275|129+0|70@35,0+0|170@5,0+0|57+916",
		],
		["SHBALI-1/13", "NotoSansBalinese-Regular.ttf", "ᬓᬾ", "66+990|23+2275"],
		["SHBALI-1/14", "NotoSansBalinese-Regular.ttf", "ᬓᬶᬾ", "23+2275|58@-95,0+0|66+990|128+1127"],
		["SHBALI-1/15", "NotoSansBalinese-Regular.ttf", "ᬓᬸᬾ", "23+2275|60@5,0+0|66+990|128+1127"],
		["SHBALI-1/16", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᬕᬾ", "66+990|23+2275|131+0"],
		["SHBALI-1/17", "NotoSansBalinese-Regular.ttf", "ᬓᭀ", "66+990|23+2275|57+916"],
		["SHBALI-1/18", "NotoSansBalinese-Regular.ttf", "ᬓᬾ", "66+990|23+2275"],
		["SHBALI-1/19", "NotoSansBalinese-Regular.ttf", "ᬓᬾᬶ", "66+990|23+2275|58@-95,0+0"],
		["SHBALI-1/20", "NotoSansBalinese-Regular.ttf", "ᬓᬾᬸ", "66+990|23+2275|60@5,0+0"],
		["SHBALI-1/21", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᬕᬾ", "66+990|23+2275|131+0"],
		["SHBALI-1/22", "NotoSansBalinese-Regular.ttf", "ᬓᭀ", "66+990|23+2275|57+916"],
		["SHBALI-2/1", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᬧᬾ", "66+990|23+2275|149+1315"],
		["SHBALI-2/2", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᬨᬿ", "67+990|23+2275|150+1228"],
		["SHBALI-2/3", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᬱᬾ", "66+990|23+2275|159+1315"],
		["SHBALI-2/4", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᬲᬾ", "66+990|23+2275|60@5,0+0|149+1315"],
		["SHBALI-2/5", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᭊᬾ", "66+990|23+2275|60@5,0+0|165+1315"],
		["SHBALI-2/6", "NotoSansBalinese-Regular.ttf", "ᬛ᭄ᬓ", "181+2473|129@-293,-400+0"],
		["SHBALI-2/7", "NotoSansBalinese-Regular.ttf", "ᬛ᭄ᬓᬾ", "66+990|181+2473|129@-293,-400+0"],
		[
			"SHBALI-2/8",
			"NotoSansBalinese-Regular.ttf",
			"ᬛ᭄ᬓᬸᬀ",
			"181+2473|129@-293,-400+0|60@-293,-1400+0|4@-722,0+0",
		],
		["SHBALI-2/9", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᬓᬸ", "23+2275|129+0|60@0,-1000+0"],
		["SHBALI-2/10", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᬛᬹ", "23+2275|137+0|61@308,-1000+0"],
		["SHBALI-2/11", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᬱᬺ", "23+2275|159+1315|62+0"],
		["SHBALI-2/12", "NotoSansBalinese-Regular.ttf", "ᬓ᭄ᭅᬸ", "23+2275|162+0|60@0,-1000+0"],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("shapes text with joiners", () => {
	test.each([
		[
			"should keep a ZWNJ between syllables",
			"NotoSansBalinese-Regular.ttf",
			"ᬅ\u{200C}ᬓ",
			"9+2258|3+0|23+2275",
		],
		[
			"should keep a ZWJ between syllables",
			"NotoSansBalinese-Regular.ttf",
			"ᬅ\u{200D}ᬓ",
			"9+2258|3+0|23+2275",
		],
		[
			"should not form a conjunct across a ZWNJ",
			"NotoSansBalinese-Regular.ttf",
			"ᬓ᭄\u{200C}ᬱ",
			"23+2275|72+712|3+0|53+1653",
		],
	])("%s", (_name, path, text, expected) => {
		expect(hb(path, text)).toBe(expected);
	});
});

describe("Universal Shaping Engine behaviour", () => {
	test("selects the USE shaper for Balinese", () => {
		let shaped = shape(font("NotoSans/NotoSansBalinese-Regular.ttf"), "ᬓᬸᬀ");
		expect(shaped.script).toBe("bali");
		expect(shaped.features).toEqual(expect.arrayContaining(["rphf", "pref", "abvs"]));
	});

	test("gives every glyph of a reordered cluster the cluster's first offset", () => {
		let { glyphs } = shape(font("NotoSans/NotoSansBalinese-Regular.ttf"), "ᬓᬾ");
		expect(glyphs.map((glyph) => glyph.cluster)).toEqual([0, 0]);
	});

	test("shapes a long run of vowel signs without throwing", () => {
		let text = "ᬓ" + "ᬾ".repeat(3000) + "᭄".repeat(3000);
		let { glyphs } = shape(font("NotoSans/NotoSansBalinese-Regular.ttf"), text);
		expect(glyphs.length).toBeGreaterThan(3000);
	});
});
