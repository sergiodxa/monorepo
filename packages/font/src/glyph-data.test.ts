/**
 * Tests for per-glyph data against real fonts: SVG path data, control and bounding boxes,
 * glyph names, vertical metrics and their fallbacks, and raw table access, for TrueType
 * (Open Sans, Amiri) and CFF (Source Sans Pro, Noto Sans CJK) outlines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Font } from "./font.js";

import { boundingBox, controlBox, toSVGPath } from "./svg-path.js";

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
 * An outline scaled to a font size with y kept up, as SVG path data: `path()` at the origin
 * with its y-down axis flipped back.
 *
 * @param font - The font.
 * @param glyph - Glyph index.
 * @param size - Pixels per em.
 */
function scaledSVG(font: Font, glyph: number, size: number): string {
	return toSVGPath(
		font.path(glyph, size, 0, 0).map((command): Font.Command => {
			if (command.type === "close") return command;
			if (command.type === "quad") return { ...command, cy: -command.cy, y: -command.y };
			if (command.type === "cubic") {
				return { ...command, c1y: -command.c1y, c2y: -command.c2y, y: -command.y };
			}
			return { ...command, y: -command.y };
		}),
	);
}

const EMPTY_BOX = { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };

describe("TrueType glyphs", () => {
	let font = open("OpenSans/OpenSans-Regular.ttf");

	test("writes a glyph's outline as SVG path data", () => {
		expect(font.svgPath(39)).toBe(
			"M1368 745Q1368 383 1171.5 191.5Q975 0 606 0L201 0L201 1462L649 1462Q990 1462 1179 1273Q1368 1084 1368 745ZM1188 739Q1188 1025 1044.5 1170Q901 1315 618 1315L371 1315L371 147L578 147Q882 147 1035 296.5Q1188 446 1188 739Z",
		);
	});

	test("draws the outline as move, line, quad and close commands in order", () => {
		let steps = font
			.outline(39)
			.map((command) =>
				command.type === "close"
					? "close"
					: `${command.type}(${Object.values(command).slice(1).join(", ")})`,
			);
		expect(steps.slice(0, 9)).toEqual([
			"move(1368, 745)",
			"quad(1368, 383, 1171.5, 191.5)",
			"quad(975, 0, 606, 0)",
			"line(201, 0)",
			"line(201, 1462)",
			"line(649, 1462)",
			"quad(990, 1462, 1179, 1273)",
			"quad(1368, 1084, 1368, 745)",
			"close",
		]);
	});

	test("starts contours whose ends are both off-curve at their implied midpoint", () => {
		let amiri = open("amiri/amiri-regular.ttf");
		expect(amiri.svgPath(amiri.glyphIndex(0x2e))).toBe(
			"M129.5 11.5Q96 45 96 90Q96 135 129.5 166.5Q163 198 208 198Q253 198 284.5 166.5Q316 135 316 90Q316 45 284.5 11.5Q253 -22 208 -22Q163 -22 129.5 11.5Z",
		);
	});

	test("writes a composite glyph's components", () => {
		expect(font.svgPath(171)).toBe(
			"M639 -20Q396 -20 255.5 128Q115 276 115 539Q115 804 245.5 960Q376 1116 596 1116Q802 1116 922 980.5Q1042 845 1042 623L1042 518L287 518Q292 325 384.5 225Q477 125 645 125Q822 125 995 199L995 51Q907 13 828.5 -3.5Q750 -20 639 -20ZM594 977Q462 977 383.5 891Q305 805 291 653L864 653Q864 810 794 893.5Q724 977 594 977ZM471 1266Q519 1328 574.5 1416Q630 1504 662 1569L864 1569L864 1548Q820 1483 733 1388Q646 1293 582 1241L471 1241Z",
		);
	});

	test("writes a path scaled to a font size", () => {
		expect(scaledSVG(font, 39, 1000)).toBe(
			"M667.97 363.77Q667.97 187.01 572.02 93.51Q476.07 0 295.9 0L98.14 0L98.14 713.87L316.89 713.87Q483.4 713.87 575.68 621.58Q667.97 529.3 667.97 363.77ZM580.08 360.84Q580.08 500.49 510.01 571.29Q439.94 642.09 301.76 642.09L181.15 642.09L181.15 71.78L282.23 71.78Q430.66 71.78 505.37 144.78Q580.08 217.77 580.08 360.84Z",
		);
	});

	test("reads the control box from the glyf header and computes the bounding box", () => {
		let box = { xMin: 201, yMin: 0, xMax: 1368, yMax: 1462 };
		expect(font.glyphCBox(39)).toEqual(box);
		expect(font.glyphBBox(39)).toEqual(box);
		expect(font.advance(39)).toBe(1493);
	});

	test("gives a blank glyph an empty box and finite metrics", () => {
		let space = font.glyphIndex(0x20);
		expect(font.glyphCBox(space)).toEqual(EMPTY_BOX);
		expect(font.glyphBBox(space)).toEqual(EMPTY_BOX);
		expect(font.glyphCBox(font.glyphCount)).toEqual(EMPTY_BOX);
		expect(font.advance(space)).toBe(532);
		expect(font.verticalAdvance(space)).toBe(2789);
		expect(font.topSideBearing(space)).toBe(2189);
	});

	test("names glyphs from the post table", () => {
		expect(font.glyphName(171)).toBe("eacute");
		expect(font.glyphName(font.glyphIndex(0x61))).toBe("a");
		expect(font.glyphName(0)).toBe(".notdef");
		expect(font.glyphName(font.glyphCount)).toBeNull();
	});

	test("hands out raw tables by tag", () => {
		for (let tag of ["head", "hhea", "OS/2", "post"]) expect(font.table(tag)).not.toBeNull();
		expect(font.table("head")?.byteLength).toBe(54);
		expect([...(font.table("head")?.subarray(12, 16) ?? [])]).toEqual([0x5f, 0x0f, 0x3c, 0xf5]);
		expect(font.table("ZZZZ")).toBeNull();
	});

	test("draws nothing and measures nothing for a glyph the font lacks", () => {
		expect(font.svgPath(font.glyphCount)).toBe("");
		expect([font.verticalAdvance(-1), font.topSideBearing(1.5)]).toEqual([0, 0]);
		expect(font.deviceAdvance(39, 12)).toBeNull();
	});
});

describe("CFF glyphs", () => {
	let font = open("SourceSansPro/SourceSansPro-Regular.otf");

	test("writes a cubic outline as SVG path data", () => {
		expect(font.svgPath(5)).toBe(
			"M90 0L258 0C456 0 564 122 564 331C564 539 456 656 254 656L90 656ZM173 68L173 588L248 588C401 588 478 496 478 331C478 165 401 68 248 68Z",
		);
	});

	test("computes both boxes from the outline", () => {
		let box = { xMin: 90, yMin: 0, xMax: 564, yMax: 656 };
		expect(font.glyphCBox(5)).toEqual(box);
		expect(font.glyphBBox(5)).toEqual(box);
		let space = font.glyphIndex(0x20);
		expect([font.glyphCBox(space), font.glyphBBox(space)]).toEqual([EMPTY_BOX, EMPTY_BOX]);
	});

	test("names glyphs from the CFF charset", () => {
		expect(font.glyphName(5)).toBe("D");
	});

	test("falls back to the line height for vertical advances without vmtx", () => {
		expect(font.verticalMetrics).toBeNull();
		expect(font.verticalAdvance(font.glyphIndex(0x41))).toBe(1257);
		expect(font.verticalOrigin(font.glyphIndex(0x41))).toBe(font.ascender);
	});
});

describe("vertical metrics", () => {
	test("reads vhea and vmtx", () => {
		let font = open("fonttest/TestGVAROne.ttf");
		expect(font.verticalMetrics).not.toBeNull();
		expect(font.verticalAdvance(font.glyphIndex(0x5f4c))).toBe(1000);
	});

	test("reads the vertical origin from VORG", () => {
		let font = open("NotoSansCJK/NotoSansCJKjp-Regular-subset.otf");
		let vorg = font.table("VORG") ?? new Uint8Array(8);
		let view = new DataView(vorg.buffer, vorg.byteOffset, vorg.byteLength);
		let fallback = view.getInt16(4);
		let listed = view.getUint16(6) > 0 ? view.getUint16(8) : -1;
		expect(font.verticalOrigin(font.glyphCount + 10)).toBe(fallback);
		if (listed >= 0) expect(font.verticalOrigin(listed)).toBe(view.getInt16(10));
		expect(font.verticalAdvance(font.glyphIndex(0x3001))).toBe(1000);
	});
});

describe("metrics", () => {
	test("uses the typographic metrics when the font sets USE_TYPO_METRICS", () => {
		let font = open("Mada/Mada-Regular.subset1.ttf");
		expect([font.ascender, font.descender, font.lineGap]).toEqual([900, -300, 100]);
	});
});

describe("outline geometry", () => {
	test("finds a curve's extremes beyond its end points", () => {
		let quad: Font.Command[] = [
			{ type: "move", x: 0, y: 0 },
			{ type: "quad", cx: 50, cy: 100, x: 100, y: 0 },
			{ type: "close" },
		];
		expect(controlBox(quad)).toEqual({ xMin: 0, yMin: 0, xMax: 100, yMax: 100 });
		expect(boundingBox(quad)).toEqual({ xMin: 0, yMin: 0, xMax: 100, yMax: 50 });
		let cubic: Font.Command[] = [
			{ type: "move", x: 0, y: 0 },
			{ type: "cubic", c1x: 0, c1y: 100, c2x: 100, c2y: 100, x: 100, y: 0 },
		];
		expect(boundingBox(cubic)).toEqual({ xMin: 0, yMin: 0, xMax: 100, yMax: 75 });
		expect(toSVGPath(cubic)).toBe("M0 0C0 100 100 100 100 0");
		expect([boundingBox([]), toSVGPath([])]).toEqual([EMPTY_BOX, ""]);
	});
});
