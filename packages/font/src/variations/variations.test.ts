/**
 * Tests for `@sdxc/font/variations` against variable fonts: the Unicode `gvar` test fonts
 * (shared, enumerated and empty point sets, `HVAR`), Mada (composites, `MVAR`), Archivo
 * (`avar`, `HVAR` mapping, feature variations) and Adobe's CFF2 prototype.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Font } from "../font.js";

import { fontData } from "../font.js";
import { contoursToCommands, decodeGlyph } from "../glyf.js";
import { parseFont } from "../index.js";
import { toSVGPath } from "../svg-path.js";
import { parseWoff2 } from "../woff2/index.js";

import { featureVariationSubstitutions } from "./feature-variations.js";
import { variationOf } from "./variation.js";

import { axes, instance, namedInstances } from "./index.js";

/** A fixture font, parsed. */
function open(path: string): Font {
	return unwrap(parseFont(readFileSync(new URL(`../fixtures/${path}`, import.meta.url))));
}

/** The varied glyph's outline as SVG path data, numbers rounded to two decimals. */
function svg(font: Font, glyph: number): string {
	let data = fontData(font);
	let variation = variationOf(data);
	if (data.cff !== null) return toSVGPath(data.cff.commands(glyph, variation?.coords));
	return toSVGPath(contoursToCommands(variation?.contours(glyph) ?? decodeGlyph(data, glyph)));
}

/**
 * Asserts two SVG paths match command for command with every number within 0.02. Variation
 * coordinates are snapped to the 2.14 grid the tables are stored on, which moves CFF2's
 * fractional coordinates by up to a hundredth against an unsnapped reference.
 */
function expectPathClose(actual: string, expected: string): void {
	let pattern = /[A-Z]|-?[\d.]+/g;
	let a = actual.match(pattern) ?? [];
	let b = expected.match(pattern) ?? [];
	expect(a.length).toBe(b.length);
	for (let [index, token] of a.entries()) {
		let other = b[index] ?? "";
		if (/[A-Z]/.test(token)) expect(token).toBe(other);
		else expect(Math.abs(Number(token) - Number(other))).toBeLessThanOrEqual(0.02);
	}
}

/** The advance of the glyph a character maps to, at the font's instance. */
function advanceOf(font: Font, text: string): number {
	let glyph = font.glyphIndex(text.codePointAt(0) ?? 0);
	return variationOf(fontData(font))?.advance(glyph) ?? font.advance(glyph);
}

/** `彌` at wght 300 in the Unicode `gvar` test fonts, as HarfBuzz and FreeType draw it. */
const MI_300 =
	"M371 -102L371 539L914 539L914 -27Q914 -102 840 -102Q796 -102 755 -98L742 -59Q790 -66 836 -66Q871 -66 871 -31L871 504L414 504L414 -102ZM203 -94Q138 -94 86 -90L74 -52Q137 -59 188 -59Q211 -59 222 -46.5Q233 -34 235.5 12Q238 58 240 134.5Q242 211 242 262L74 262L94 527L242 527L242 719L63 719L63 754L285 754L285 492L133 492L117 297L285 297Q285 241 284 185Q284 104 281 46Q278 -20 269 -49Q260 -78 241.5 -86Q223 -94 203 -94ZM461 12L434 43Q473 73 503 115Q478 150 441 188L469 211Q501 179 525 147Q538 172 559 230L594 211Q571 152 551 117Q577 84 602 43L566 20Q544 64 528 86Q500 44 461 12ZM465 258L438 285Q474 316 501 351Q474 388 445 418L473 441Q500 414 523 381Q546 413 563 453L598 434Q571 382 549 352Q576 320 598 285L563 262Q546 294 525 322Q491 280 465 258ZM707 12L680 43Q717 68 753 115Q731 147 691 188L719 211Q739 190 754 172Q769 154 774 147Q793 185 809 230L844 211Q822 155 801 117Q828 82 852 43L820 20Q798 58 778 87Q747 43 707 12ZM621 -94L621 730L664 730L664 -94ZM348 570L324 605Q425 629 527 688L555 656Q491 621 438.5 601Q386 581 348 570ZM715 258L688 285Q727 318 753 351Q733 378 695 418L723 441Q754 410 775 381Q794 407 813 453L848 434Q826 387 801 352Q823 321 848 281L813 262Q791 301 775 323Q749 288 715 258ZM348 719L348 754L941 754L941 719ZM936 570Q870 602 817 621.5Q764 641 727 652L749 688Q852 655 957 605Z";

/** `$` in Adobe's CFF2 prototype at wght 100, 500 and (the `dollar.nostroke` glyph) 900. */
const DOLLAR = {
	100: "M245.82 14.61C187.88 14.61 147.25 26.89 101.25 68.2L141.87 23.46L116.86 116.93C110.69 142.99 95.97 149.44 81.44 149.44C65.26 149.44 55.63 141.35 52.46 125.72C71.02 40.17 137.46 -13 244.46 -13C347.69 -13 435.51 46.25 435.51 156.16C435.51 229.42 405.44 295.15 271.16 349.44L247 358.79C159.98 393.45 118.52 438.64 118.52 505.55C118.52 592.21 177.71 637.22 261.9 637.22C310.84 637.22 346.11 625.66 389.56 584.63L347.76 628.64L372.77 535.16C380.4 510.11 394.48 502.66 408.47 502.66C423.83 502.66 434.27 510.48 437.17 526.38C418.07 613.84 347.53 665.1 258.91 665.1C160.66 665.1 78.39 606.22 78.39 499.85C78.39 414.41 128.01 361.14 223.54 320.5L260.54 304.59C366.66 258.56 395.38 216.91 395.38 152.46C395.38 65.35 333.64 14.61 245.82 14.61ZM267.35 330.74L267.35 758.74L240.46 758.74L240.46 330.74L267.35 330.74ZM240.18 -115L267.08 -115L267.08 330.74L240.18 330.74L240.18 -115Z",
	500: "M250.51 35.84C206.08 35.84 164.63 42.09 118 61.34L176.22 21.37L161.1 99.25C150.56 152.04 128.56 166.51 100.6 166.51C77.76 166.51 61.04 154.88 51 131.12C54.16 43.49 133.08 -13.63 246.76 -13.63C388.4 -13.63 473.95 64.04 473.95 171.25C473.95 258.48 429.82 321.18 294.19 370.06L257.44 383.06C188.12 406.48 150.2 437.92 150.2 498.58C150.2 571.08 204.28 605.57 275.56 605.57C308.07 605.57 342.19 600.78 386.28 582.32L327.39 620.61L342.92 546.49C354.72 489.69 382.22 475.69 407.77 475.69C428.24 475.69 447.74 486.73 455.12 511.91C450.37 597.49 369.53 655.82 264.36 655.82C140.37 655.82 56.96 575.82 56.96 473.61C56.96 372.57 119.37 318.36 226.88 278.85L262.63 265.85C344.91 235.85 379.24 208.15 379.24 145.15C379.24 76.37 329.16 35.84 250.51 35.84ZM288.61 320.33L288.61 746.03L242.13 746.03L242.13 320.33L288.61 320.33ZM239.67 -115L286.15 -115L286.15 320.33L239.67 320.33L239.67 -115Z",
	900: "M258.1 38.37C197.22 38.37 166.53 48.42 118 71.47L192.04 19.47L182.62 103.05C176.51 155.21 154.51 174.1 114.52 174.1C89.15 174.1 64.21 160.58 51 125.42C51.63 35.9 124.22 -15.53 258.15 -15.53C416.88 -15.53 513.19 67.21 513.19 175.05C513.19 278.1 457.04 327.94 322.04 388.41L289.09 403.1C231.56 428.62 203.34 451.84 203.34 499.84C203.34 562.22 244.35 589.11 300.67 589.11C341.61 589.11 370.04 584.96 420.46 562.06L340.68 607.32L351.78 538.9C362.94 467.54 398.04 453.54 434.35 453.54C459.25 453.54 486.35 467.75 491.82 505.58C490.87 589.9 407.51 643.16 289.67 643.16C141 643.16 57.16 563.16 57.16 460.32C57.16 356.96 121.68 307.16 232.58 255.85L264.53 241.17C333.53 209.49 362.8 186.22 362.8 129.96C362.8 77 319.9 38.37 258.1 38.37ZM317.72 615.64L317.72 734.01L251.63 734.01L251.63 615.64L317.72 615.64ZM253.15 -115L319.25 -115L319.25 13.68L253.15 13.68L253.15 -115Z",
};

describe("axes and named instances", () => {
	test("lists the axes of a variable font", () => {
		expect(axes(open("Mada/Mada-VF.ttf"))).toEqual([
			{ tag: "wght", name: "Weight", min: 100, default: 520, max: 1000, hidden: false },
		]);
	});

	test("lists no axes for a static font", () => {
		expect(axes(open("inter-regular.ttf"))).toEqual([]);
		expect(namedInstances(open("inter-regular.ttf"))).toEqual([]);
	});

	test("lists the named instances with their coordinates", () => {
		let named = namedInstances(open("Mada/Mada-VF.ttf"));
		expect(named.map(({ name }) => name)).toMatchInlineSnapshot(`
			[
			  "Light",
			  "Regular",
			  "SemiBold",
			  "Bold",
			  "Black",
			]
		`);
		expect(named[0]?.coordinates).toMatchInlineSnapshot(`
			{
			  "wght": 100,
			}
		`);
	});

	test("refuses to instance a static font", () => {
		let result = instance(open("inter-regular.ttf"), { wght: 700 });
		expect(isFailure(result) && result.error.code).toBe("unsupported");
	});

	test("refuses an unknown named instance", () => {
		let result = instance(open("Mada/Mada-VF.ttf"), "Nonexistent");
		expect(isFailure(result) && result.error.code).toBe("unsupported");
	});
});

describe("truetype variations", () => {
	test("shares all points", () => {
		let font = unwrap(instance(open("fonttest/TestGVAROne.ttf"), { wght: 300 }));
		expect(svg(font, font.glyphIndex(0x5f4c))).toBe(MI_300);
	});

	test("shares enumerated points", () => {
		let font = unwrap(instance(open("fonttest/TestGVARTwo.ttf"), { wght: 300 }));
		expect(svg(font, font.glyphIndex(0x5f4c))).toBe(MI_300);
	});

	test("shares no points", () => {
		let font = unwrap(instance(open("fonttest/TestGVARThree.ttf"), { wght: 300 }));
		expect(svg(font, font.glyphIndex(0x5f4c))).toBe(MI_300);
	});

	test("uses HVAR for advances", () => {
		let font = unwrap(instance(open("fonttest/TestGVARFour.ttf"), { wght: 150 }));
		expect(advanceOf(font, "O")).toBe(706);
	});

	test("reads the last HVAR mapping entry for glyphs past it", () => {
		let font = unwrap(instance(open("fonttest/TestHVARTwo.ttf"), { wght: 400 }));
		expect(advanceOf(font, "A")).toBe(584);
	});

	test("keeps the advances of glyphs used by several composites", () => {
		let font = unwrap(instance(open("Mada/Mada-VF.ttf"), { wght: 100 }));
		expect(
			["\u00ec", "\u00ed", "\u00ee", "\u00ef", "\u0131"].map((text) => advanceOf(font, text)),
		).toEqual([229, 229, 229, 229, 229]);
		expect(["\u00e9", "\u00e8", "e"].map((text) => advanceOf(font, text))).toEqual([483, 483, 483]);
	});
});

describe("instances", () => {
	test("draws the default outline at the default location", () => {
		let font = open("Mada/Mada-VF.ttf");
		let varied = unwrap(instance(font, {}));
		for (let glyph = 0; glyph < font.glyphCount; glyph++) {
			expect(svg(varied, glyph)).toBe(toSVGPath(font.outline(glyph)));
			expect(variationOf(fontData(varied))?.advance(glyph)).toBe(font.advance(glyph));
		}
	});

	test("varies a variation from the default location", () => {
		let font = open("fonttest/TestGVAROne.ttf");
		let light = unwrap(instance(font, { wght: 300 }));
		let heavy = unwrap(instance(light, { wght: 700 }));
		let direct = unwrap(instance(font, { wght: 700 }));
		let glyph = font.glyphIndex(0x5f4c);
		expect(svg(heavy, glyph)).toBe(svg(direct, glyph));
		expect(svg(heavy, glyph)).not.toBe(svg(light, glyph));
	});

	test("picks a named instance by name and reports it", () => {
		let font = open("Mada/Mada-VF.ttf");
		let bold = unwrap(instance(font, "Bold"));
		let byValue = unwrap(instance(font, namedInstances(font)[3]?.coordinates ?? {}));
		expect(bold.subfamily).toBe("Bold");
		expect(bold.weightClass).toBe(namedInstances(font)[3]?.coordinates.wght);
		let glyph = font.glyphIndex(0x42);
		expect(svg(bold, glyph)).toBe(svg(byValue, glyph));
		expect(svg(bold, glyph)).not.toBe(toSVGPath(font.outline(glyph)));
	});

	test("clamps values to the axis range", () => {
		let font = open("Mada/Mada-VF.ttf");
		let glyph = font.glyphIndex(0x42);
		let max = unwrap(instance(font, { wght: 1000 }));
		expect(svg(unwrap(instance(font, { wght: 5000 })), glyph)).toBe(svg(max, glyph));
		expect(variationOf(fontData(max))?.settings).toEqual({ wght: 1000 });
	});

	test("moves composite components with their own variations", () => {
		let font = unwrap(instance(open("Mada/Mada-VF.ttf"), { wght: 900 }));
		let e = svg(font, font.glyphIndex(0x65));
		let eAcute = svg(font, font.glyphIndex(0xe9));
		expect(eAcute.startsWith(e)).toBe(true);
		expect(eAcute.length).toBeGreaterThan(e.length);
	});

	test("varies font-wide metrics with MVAR", () => {
		let font = open("Mada/Mada-VF.ttf");
		let black = unwrap(instance(font, { wght: 1000 }));
		let changed = (["ascender", "descender", "lineGap", "capHeight", "xHeight"] as const).filter(
			(key) => black[key] !== font[key],
		);
		expect(changed.length).toBeGreaterThan(0);
	});

	test("measures the left side bearing of the varied outline", () => {
		let font = unwrap(instance(open("Mada/Mada-VF.ttf"), { wght: 900 }));
		let variation = variationOf(fontData(font));
		let glyph = font.glyphIndex(0x42);
		let xMin = Math.min(...(variation?.contours(glyph).flat() ?? []).map((point) => point.x));
		expect(variation?.leftSideBearing(glyph)).toBe(xMin);
	});

	test("survives corrupt gvar data", () => {
		let bytes = new Uint8Array(
			readFileSync(new URL("../fixtures/fonttest/TestGVAROne.ttf", import.meta.url)),
		);
		let base = unwrap(parseFont(bytes));
		let gvar = fontData(base).tables.get("gvar");
		let random = 1;
		for (let round = 0; round < 20; round++) {
			let copy = bytes.slice();
			for (let index = 0; index < 200; index++) {
				random = (random * 1103515245 + 12345) % 2147483648;
				let at = (gvar?.offset ?? 0) + (random % (gvar?.length ?? 1));
				copy[at] = random & 0xff;
			}
			let font = unwrap(instance(unwrap(parseFont(copy)), { wght: 300 }));
			for (let glyph = 0; glyph < font.glyphCount; glyph++) {
				expect(() => svg(font, glyph)).not.toThrow();
			}
		}
	});
});

describe("avar and HVAR mappings", () => {
	test("maps coordinates through avar", () => {
		let font = open("Archivo/Archivo-Subset.ttf");
		let [axis] = axes(font);
		expect(axis?.tag).toBe("wght");
		let coords = (wght: number): readonly number[] =>
			variationOf(fontData(unwrap(instance(font, { wght }))))?.coords ?? [];
		expect(coords(axis?.min ?? 0)[0]).toBe(-1);
		expect(coords(axis?.default ?? 0)[0]).toBe(0);
		expect(coords(axis?.max ?? 0)[0]).toBe(1);
		expect(coords(400)[0]).toMatchInlineSnapshot(`-0.45947265625`);
	});
});

describe("CFF2 variations", () => {
	let font = open("fonttest/AdobeVFPrototype-Subset.otf");

	test("applies variations to CFF2 glyphs", () => {
		let dollar = font.glyphIndex(0x24);
		expectPathClose(svg(unwrap(instance(font, { wght: 100 })), dollar), DOLLAR[100]);
		expectPathClose(svg(unwrap(instance(font, { wght: 500 })), dollar), DOLLAR[500]);
	});

	test("substitutes GSUB features depending on variations", () => {
		let heavy = unwrap(instance(font, { wght: 900 }));
		let light = unwrap(instance(font, { wght: 100 }));
		let substituted = featureVariationSubstitutions(heavy, "GSUB");
		expect(substituted.size).toBeGreaterThan(0);
		expect(featureVariationSubstitutions(light, "GSUB").size).toBe(0);
		expectPathClose(svg(heavy, font.glyphIndex(0x24) + 1), DOLLAR[900]);
	});
});

describe("feature variations", () => {
	let font = open("Archivo/Archivo-Subset.ttf");

	test("applies at the default location when the range covers it", () => {
		expect(featureVariationSubstitutions(font, "GSUB").size).toBeGreaterThan(0);
	});

	test("skips records outside their condition set", () => {
		let light = unwrap(instance(font, { wght: 100 }));
		expect(featureVariationSubstitutions(light, "GSUB").size).toBe(0);
	});

	test("answers no substitutions for a table without feature variations", () => {
		expect(featureVariationSubstitutions(open("Mada/Mada-VF.ttf"), "GPOS").size).toBe(0);
		expect(featureVariationSubstitutions(open("inter-regular.ttf"), "GSUB").size).toBe(0);
	});
});

describe("an instance as a Font", () => {
	test("draws and measures its varied glyphs through the Font API", () => {
		let font = open("Mada/Mada-VF.ttf");
		let bold = unwrap(instance(font, { wght: 900 }));
		let variation = variationOf(fontData(bold));
		let alef = font.glyphIndex(0x627);
		expect(bold.advance(alef)).toBe(variation?.advance(alef));
		expect(bold.advance(alef)).toBeGreaterThan(font.advance(alef));
		expect(bold.outline(alef)).toEqual(contoursToCommands(variation?.contours(alef) ?? []));
		expect(bold.glyphCBox(alef)).not.toEqual(font.glyphCBox(alef));
	});

	test("blends CFF2 outlines at the instance's coordinates", () => {
		let font = open("fonttest/AdobeVFPrototype-Subset.otf");
		let light = unwrap(instance(font, { wght: 100 }));
		let coords = variationOf(fontData(light))?.coords;
		expect(light.outline(1)).toEqual(fontData(font).cff?.commands(1, coords));
		expect(light.outline(1)).not.toEqual(font.outline(1));
	});

	test("sends subsetting to @sdxc/font/subset", () => {
		let bold = unwrap(instance(open("Mada/Mada-VF.ttf"), { wght: 900 }));
		let result = bold.subset([1]);
		expect(isFailure(result) && result.error.code).toBe("unsupported");
	});
});

describe("variations of a font in a WOFF2 container", () => {
	test.each([
		["fonttest/TestGVAROne.woff2", "fonttest/TestGVAROne.ttf", { wght: 300 }],
		["Mada/Mada-VF.woff2", "Mada/Mada-VF.ttf", { wght: 900 }],
		[
			"fonttest/AdobeVFPrototype-Subset.woff2",
			"fonttest/AdobeVFPrototype-Subset.otf",
			{ wght: 100 },
		],
	])("varies %s like the sfnt it was made from", (woff2, sfnt, settings) => {
		let packed = unwrap(
			instance(
				unwrap(parseWoff2(readFileSync(new URL(`../fixtures/${woff2}`, import.meta.url)))),
				settings,
			),
		);
		let plain = unwrap(instance(open(sfnt), settings));
		expect(packed.glyphCount).toBe(plain.glyphCount);
		for (let glyph = 0; glyph < plain.glyphCount; glyph++) {
			expect(packed.outline(glyph)).toEqual(plain.outline(glyph));
			expect(packed.advance(glyph)).toBe(plain.advance(glyph));
		}
	});
});
