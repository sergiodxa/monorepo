/**
 * Tests for the script shapers against real fonts: Arabic-family joining forms and cursive
 * attachment, Hebrew mark order, Thai and Lao SARA AM, and Hangul syllable composition.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Font } from "../../font.js";
import type { ShapeOptions } from "../index.js";
import type { ShapingFont } from "../shaping-font.js";

import { parseFont } from "../../index.js";
import { GlyphInfo } from "../glyph-info.js";
import { shape } from "../index.js";
import { ShapingPlan } from "../plan.js";

import { HangulShaper } from "./hangul.js";
import { HebrewShaper } from "./hebrew.js";
import { ThaiShaper } from "./thai.js";

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
 * A shaped run in compact notation: `glyph@xOffset,yOffset+xAdvance`, the offset only when
 * non-zero, glyphs joined by `|`.
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
 * The glyph names of a shaped run.
 *
 * @param path - Fixture path.
 * @param text - The run.
 */
function names(path: string, text: string): (string | null)[] {
	let parsed = font(path);
	return shape(parsed, text).glyphs.map((glyph) => parsed.glyphName(glyph.glyph));
}

describe("arabic shaper", () => {
	test("should shape Arabic text", () => {
		expect(hb("NotoSans/NotoKufiArabic-Regular.ttf", "سُلَّاِّمتی")).toBe(
			"223+1974|143+801|39+1176|270@180,80+0|268@1060,50+0|51+1452|101@900,-600+0|15+1798",
		);
	});

	test("should handle cursive attachment positioning", () => {
		expect(hb("NotoSans/NotoNastaliqUrduDraft.ttf", "ححححححب")).toBe(
			"18@652,-180+0|226+1350|574@0,279+90|825@0,707+176|825@0,1058+176|825@0,1409+176|825@0,1760+176|509@0,2111+636",
		);
	});

	test("should shape Mongolian text", () => {
		expect(hb("NotoSans/NotoSansMongolian-Regular.ttf", "ᠬᠦᠮᠦᠨ ᠪᠦᠷ ᠲᠥᠷᠥᠵᠦ ᠮᠡᠨᠳᠡᠯᠡᠬᠦ ᠡᠷᠬᠡ")).toBe(
			"488+2417|193+582|945+1174|56+874|3+532|358+2507|32+1032|3+532|35+1372|942+1778|31+1145|943+1174|101+1085|" +
				"342+1298|3+532|206+1008|64+582|946+582|957+1255|64+582|75+582|64+582|493+1438|3+532|62+1008|31+1145|396+1993",
		);
	});

	test("should shape Syriac text", () => {
		expect(hb("NotoSans/NotoSansSyriacEstrangela-Regular.ttf", "ܚܐܪܐ ܘܒܪܒܪ ܓܘ ܐܝܩܪܐ ܘܙܕܩܐ.")).toBe(
			"218+545|11+1781|94+1362|26@35,0+1139|34+564|32+1250|3+532|9+1904|96+1088|93+1383|51+569|8+1904|" +
				"3+532|33+1225|21+1470|3+532|96+1088|17+1496|96+1088|17+1496|32+1250|3+532|9+1904|95+1104|12+1781|39+1052",
		);
	});

	test("should match chain context backtrack in OpenType spec order", () => {
		expect(hb("NotoSans/NotoSansSyriacEstrangela-Regular.ttf", "ܒܱܓ")).toBe(
			"249+2485|141@606,-200+0|17+1496",
		);
	});

	test("should honour useMarkFilteringSet during contextual matching", () => {
		expect(hb("Mada/Mada-VF.ttf", "جَِ")).toBe("86@273,-335+0|83@253,495+0|111@273,-95+0|8+568");
	});

	test("should shape N'Ko text", () => {
		expect(hb("NotoSans/NotoSansNKo-Regular.ttf", "ߞߊ߬ ߞߐߕߐ߮ ߞߎߘߊ ߘߏ߫ ߘߊߦߟߍ߬ ߸ ߏ߬")).toBe(
			"52@10,-300+0|23+1128|3+532|64+985|3+532|52@150,-300+0|84+1268|139+1184|160+1067|76+543|119+1622|3+532|51@10,-300+0|90+1128" +
				"|119+1622|3+532|75+543|118+1622|88+1212|137+1114|3+532|54@170,0+0|93+1321|109+1155|94+1321|137+1114|3+532|52@-210,0+0|75+543|137+1114",
		);
	});

	test("should shape Phags Pa text", () => {
		expect(hb("NotoSans/NotoSansPhagsPa-Regular.ttf", "ꡀꡁꡂꡃ ꡄꡅꡆꡇ ꡈꡉꡊꡋ ꡌꡍꡎꡏ")).toBe(
			"100+1491|212+1462|217+1462|87+1386|3+532|161+1677|168+1427|148+1532|329+1122|3+532|112+1614" +
				"|153+1491|158+1073|107+1231|3+532|171+1686|178+1542|313+1542|115+1231",
		);
	});

	test("should attach marks to the first base of a multiple substitution", () => {
		expect(hb("amiri/amiri-regular.ttf", "الله")).toBe(
			"1824+721|461@-267,-162+0|430@-277,-440+0|6714+0|1823+473|1822+319|388+446",
		);
	});

	test("should adjust attached marks if base is adjusted", () => {
		expect(hb("amiri/amiri-regular.ttf", "لَكنت")).toBe(
			"2054+1810|2133+500|2300+1206|427@-96,0+0|5988+380|2322+360",
		);
	});

	test("moves Arabic modifier combining marks before other marks", () => {
		expect(names("amiri/amiri-regular.ttf", "بَٔ")).toEqual(["uni064E", "uni0654", "uni0628"]);
	});

	test("orders shadda before a vowel typed first", () => {
		expect(names("amiri/amiri-regular.ttf", "اللَّه")).toEqual([
			"uni0647.fina_Lellah",
			"uni064E.small",
			"uni0651",
			"uni0644.medi_Lellah",
			"uni0644.init_Lellah",
			"uni0627",
		]);
	});
});

describe("hebrew shaper", () => {
	let HEBREW = "Hebrew/TaameyFrankCLM.ttf";

	test("should reorder patah/sheva/meteg per HarfBuzz", () => {
		expect(hb(HEBREW, "אְַֽ")).toBe("11@506,0+0|22@744,0+0|17@739,0+0|28+1048");
	});

	test("should reorder qamats/hiriq/meteg per HarfBuzz", () => {
		expect(hb(HEBREW, "אִָֽ")).toBe("14@506,0+0|22@744,0+0|18@740,0+0|28+1048");
	});

	test("should reorder marks regardless of input order", () => {
		expect(hb(HEBREW, String.fromCodePoint(0x05d0, 0x05b7, 0x05b0, 0x05bd))).toBe(
			"11@506,0+0|22@744,0+0|17@739,0+0|28+1048",
		);
	});
});

describe("thai shaper", () => {
	let THAI = "NotoSans/NotoSansThai-Regular.ttf";

	test("should decompose SARA AM and shift tone mark", () => {
		expect(hb(THAI, "น้ำ")).toBe("71+613|59+0|49@-29,0+0|86+406");
	});

	test("should decompose SARA AM with mai-ek tone", () => {
		expect(hb(THAI, "ก่ำ")).toBe("29+600|59@-2,0+0|44@-31,0+0|86+406");
	});

	test("should decompose SARA AM after a consonant with an ascender", () => {
		expect(hb(THAI, "ข่ำ")).toBe("23+547|59@7,0+0|44@-22,0+0|86+406");
	});

	test("should shape สวัสดี", () => {
		expect(hb(THAI, "สวัสดี")).toBe("110+572|134+492|45@10,0+0|110+572|12+616|94+0");
	});

	test("should decompose a bare SARA AM", () => {
		expect(hb(THAI, "ำ")).toBe("59+0|86+406");
	});

	test("should reorder NIKHAHIT past a leading above-mark with no base", () => {
		expect(hb(THAI, "ัำ")).toBe("59+0|45@-29,236+0|86+406");
	});

	test("should decompose multiple SARA AMs in one word", () => {
		expect(hb(THAI, "น้ำน้ำ")).toBe("71+613|59+0|49@-29,0+0|86+406|71+613|59+0|49@-29,0+0|86+406");
	});

	test("should decompose Lao SARA AM and reorder NIKHAHIT past an above-mark", () => {
		expect(hb("NotoSans/NotoSansLao-Regular.ttf", "ຫັຳ")).toBe(
			"28+726|72@-28,0+0|58@-152,278+0|34+324",
		);
	});
});

/**
 * A font without layout tables that draws exactly the given characters, with glyph index
 * equal to code point; the Hangul tone marks get the given advance, everything else 1000.
 *
 * @param covered - The characters the font draws.
 * @param toneAdvance - The advance of U+302E and U+302F.
 */
function stubFont(covered: string, toneAdvance = 500): ShapingFont {
	let drawn = new Set(Array.from(covered, (character) => character.codePointAt(0) ?? 0));
	let stub = {
		font: {
			advance: (glyph: number) => (glyph === 0x302e || glyph === 0x302f ? toneAdvance : 1000),
		},
		gdef: null,
		gsub: null,
		gpos: null,
		glyphIndex: (codePoint: number) => (drawn.has(codePoint) ? codePoint : 0),
	};
	return stub as unknown as ShapingFont;
}

/**
 * Runs a shaper's planning and feature assignment over text against a stub font.
 *
 * @param shaper - The shaper.
 * @param script - The script tag the plan carries.
 * @param text - The run.
 * @param font - The font.
 * @returns Each resulting glyph as its hex code point, followed by its jamo feature.
 */
function run(
	shaper: HangulShaper | HebrewShaper | ThaiShaper,
	script: string,
	text: string,
	font: ShapingFont,
): string[] {
	let glyphs = Array.from(text, (character, index) => {
		let codePoint = character.codePointAt(0) ?? 0;
		return new GlyphInfo(font, font.glyphIndex(codePoint), [codePoint], index);
	});
	shaper.plan(new ShapingPlan(font, script, "ltr", null), glyphs, undefined);
	return glyphs.map((glyph) => {
		let jamo = ["ljmo", "vjmo", "tjmo"].find((tag) => glyph.features.has(tag));
		let hex = glyph.codePoints.map((codePoint) => codePoint.toString(16).toUpperCase()).join(",");
		return jamo === undefined ? hex : `${hex}:${jamo}`;
	});
}

/**
 * Runs the Hangul shaper over text against a font that draws exactly the given characters,
 * with glyph index equal to code point; the Hangul tone marks get the given advance.
 *
 * @param text - The run.
 * @param covered - The characters the font draws.
 * @param toneAdvance - The advance of U+302E and U+302F.
 * @returns Each resulting glyph as its hex code point, followed by its jamo feature.
 */
function hangul(text: string, covered: string, toneAdvance = 500): string[] {
	return run(new HangulShaper(), "hang", text, stubFont(covered, toneAdvance));
}

describe("hangul shaper", () => {
	let JAMO = "ᄀ하ᅲ오ꥠힰퟋ〯◌";

	test("should use composed versions if supported by the font", () => {
		expect(hangul("휴가 가", `${JAMO}휴가 `)).toEqual(["D734", "AC00", "20", "AC00"]);
	});

	test("should compose decomposed syllables if supported", () => {
		expect(hangul("휴가 오", `${JAMO}휴가오 `)).toEqual(["D734", "AC00", "20", "C624"]);
	});

	test("should decompose syllables the font lacks into jamo with their features", () => {
		expect(hangul("각", "각")).toEqual(["1100:ljmo", "1161:vjmo", "11A8:tjmo"]);
	});

	test("should keep a syllable the font lacks when it lacks a jamo too", () => {
		expect(hangul("각", "가")).toEqual(["AC01"]);
	});

	test("should use OT features for non-combining <L,V,T>", () => {
		expect(hangul("ꥠힰퟋ", JAMO)).toEqual(["A960:ljmo", "D7B0:vjmo", "D7CB:tjmo"]);
	});

	test("should decompose <LV,T> to <L,V,T> if <LVT> is not supported", () => {
		expect(hangul("가ퟋ", `${JAMO}가`)).toEqual(["1100:ljmo", "1161:vjmo", "D7CB:tjmo"]);
	});

	test("should reorder tone marks to the beginning of <L,V> syllables", () => {
		expect(hangul("ꥠힰ〯", JAMO)).toEqual(["302F", "A960:ljmo", "D7B0:vjmo"]);
	});

	test("should reorder tone marks to the beginning of <L,V,T> syllables", () => {
		expect(hangul("ꥠힰퟋ〯", JAMO)).toEqual(["302F", "A960:ljmo", "D7B0:vjmo", "D7CB:tjmo"]);
	});

	test("should reorder tone marks to the beginning of <LV> syllables", () => {
		expect(hangul("가〯", `${JAMO}가`)).toEqual(["302F", "AC00"]);
	});

	test("should reorder tone marks to the beginning of <LVT> syllables", () => {
		expect(hangul("각〯", `${JAMO}각`)).toEqual(["302F", "AC01"]);
	});

	test("should keep a zero-width tone mark after its syllable", () => {
		expect(hangul("가〯", `${JAMO}가`, 0)).toEqual(["AC00", "302F"]);
	});

	test("should insert a dotted circle for invalid tone marks", () => {
		expect(hangul("ᄀ〯ᅡ", JAMO)).toEqual(["1100", "302F", "25CC", "1161"]);
	});

	test("should insert the dotted circle before a zero-width invalid tone mark", () => {
		expect(hangul("〯", JAMO, 0)).toEqual(["25CC", "302F"]);
	});
});

describe("hebrew presentation forms", () => {
	test("composes shin, shin dot and dagesh when the font has no GPOS marks", () => {
		let font = stubFont("\u05E9\u05C1\u05BC\uFB2A\uFB2C");
		expect(run(new HebrewShaper(), "hebr", "\u05E9\u05BC\u05C1", font)).toEqual(["5E9,5C1,5BC"]);
	});

	test("keeps the marks when the font lacks the presentation form", () => {
		let font = stubFont("\u05D1\u05BC");
		expect(run(new HebrewShaper(), "hebr", "\u05D1\u05BC", font)).toEqual(["5D1", "5BC"]);
	});
});

describe("thai private-use fallback", () => {
	test("shifts a tone mark down after a consonant when the font has no Thai GSUB", () => {
		let font = stubFont("\u0E01\u0E48\uF70A");
		expect(run(new ThaiShaper(), "thai", "\u0E01\u0E48", font)).toEqual(["E01", "F70A"]);
	});

	test("shifts an above vowel and the tone mark after it left of an ascender", () => {
		let font = stubFont("\u0E1B\u0E34\u0E48\uF701\uF713");
		expect(run(new ThaiShaper(), "thai", "\u0E1B\u0E34\u0E48", font)).toEqual([
			"E1B",
			"F701",
			"F713",
		]);
	});

	test("removes the descender of a consonant before a below vowel", () => {
		let font = stubFont("\u0E0D\u0E38\uF70F");
		expect(run(new ThaiShaper(), "thai", "\u0E0D\u0E38", font)).toEqual(["F70F", "E38"]);
	});

	test("leaves Lao marks to the font", () => {
		let font = stubFont("\u0E81\u0EC8\uF70A");
		expect(run(new ThaiShaper(), "lao ", "\u0E81\u0EC8", font)).toEqual(["E81", "EC8"]);
	});
});
