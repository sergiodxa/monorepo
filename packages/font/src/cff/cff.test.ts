/**
 * Tests for CFF and CFF2 outlines: Source Sans Pro (name-keyed CFF), Noto Sans CJK JP (a
 * CID-keyed subset), Playfair Display and Adobe's CFF2 prototype at several weights, plus
 * hand-built charstrings for the operators no fixture reaches and for hostile input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Font, TableRecord } from "../font.js";

import { fontData } from "../font.js";
import { parseFont } from "../index.js";
import { Reader } from "../reader.js";

import type { CffOutlines } from "./index.js";

import { openCff } from "./index.js";

/**
 * Reads a fixture font.
 *
 * @param path - Path under `src/fixtures/`.
 */
function fixture(path: string): Uint8Array {
	return readFileSync(new URL(`../fixtures/${path}`, import.meta.url));
}

/**
 * Opens a fixture font through `parseFont`.
 *
 * @param path - Path under `src/fixtures/`.
 */
function open(path: string): Font {
	return unwrap(parseFont(fixture(path)));
}

/**
 * The font's CFF outlines, which every font in these tests has.
 *
 * @param font - A CFF-flavoured font.
 */
function outlines(font: Font): CffOutlines {
	let cff = fontData(font).cff;
	if (cff === null) throw new Error("The font has no CFF outlines.");
	return cff;
}

/**
 * Commands as an SVG path, numbers rounded to two decimals.
 *
 * @param commands - An outline.
 */
function svg(commands: Font.Command[]): string {
	let n = (value: number): number => Math.round(value * 100) / 100;
	return commands
		.map((command) => {
			if (command.type === "close") return "Z";
			if (command.type === "move") return `M${n(command.x)} ${n(command.y)}`;
			if (command.type === "quad") {
				return `Q${n(command.cx)} ${n(command.cy)} ${n(command.x)} ${n(command.y)}`;
			}
			if (command.type === "cubic") {
				let { c1x, c1y, c2x, c2y, x, y } = command;
				return `C${[c1x, c1y, c2x, c2y, x, y].map(n).join(" ")}`;
			}
			return `L${n(command.x)} ${n(command.y)}`;
		})
		.join("");
}

/**
 * The bounding box of an outline's points, control points included.
 *
 * @param commands - An outline.
 */
function cbox(commands: Font.Command[]): [number, number, number, number] {
	let xs: number[] = [];
	let ys: number[] = [];
	for (let command of commands) {
		if (command.type === "close") continue;
		xs.push(command.x);
		ys.push(command.y);
		if (command.type === "cubic") xs.push(command.c1x, command.c2x);
		if (command.type === "cubic") ys.push(command.c1y, command.c2y);
	}
	return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

describe("Source Sans Pro (CFF)", () => {
	let font = open("SourceSansPro/SourceSansPro-Regular.otf");
	let cff = outlines(font);

	test("opens as name-keyed CFF", () => {
		expect(cff.kind).toBe("cff");
		expect(cff.table.cid).toBe(false);
		expect(cff.table.charStrings.count).toBe(font.glyphCount);
	});

	test("draws glyph 5 (D)", () => {
		expect(svg(font.outline(5))).toBe(
			"M90 0L258 0C456 0 564 122 564 331C564 539 456 656 254 656L90 656ZM173 68L173 588L248 588C401 588 478 496 478 331C478 165 401 68 248 68Z",
		);
	});

	test("draws glyph 5 as a command sequence", () => {
		let types = font.outline(5).map((command) => command.type);
		expect(types).toEqual([
			"move",
			"line",
			"cubic",
			"cubic",
			"line",
			"close",
			"move",
			"line",
			"line",
			"cubic",
			"cubic",
			"close",
		]);
	});

	test("bounds glyph 5", () => {
		expect(cbox(font.outline(5))).toEqual([90, 0, 564, 656]);
	});

	test("names glyphs from the charset", () => {
		expect(cff.glyphName(5)).toBe("D");
		expect(cff.glyphName(0)).toBe(".notdef");
		expect(cff.glyphName(font.glyphIndex("a".codePointAt(0) ?? 0))).toBe("a");
	});

	test("reads charstring widths matching hmtx", () => {
		for (let glyph of [0, 5, font.glyphIndex(0x41), font.glyphIndex(0x20)]) {
			expect(cff.width(glyph)).toBe(font.advance(glyph));
		}
	});

	test("draws every glyph without failing", () => {
		for (let glyph = 0; glyph < font.glyphCount; glyph++) {
			let commands = font.outline(glyph);
			if (commands.length > 0) expect(commands.at(-1)?.type).toBe("close");
		}
	});

	test("answers a fresh array for a cached glyph", () => {
		let first = font.outline(5);
		first.length = 0;
		expect(font.outline(5)).toHaveLength(12);
	});

	test("answers [] past the glyph count", () => {
		expect(font.outline(font.glyphCount)).toEqual([]);
		expect(font.outline(-1)).toEqual([]);
	});

	test("scales a path to a size", () => {
		let path = font.path(5, font.unitsPerEm, 10, 20);
		expect(path[0]).toEqual({ type: "move", x: 100, y: 20 });
		expect(path[2]?.type).toBe("cubic");
	});
});

describe("Noto Sans CJK JP subset (CID-keyed CFF)", () => {
	let font = open("NotoSansCJK/NotoSansCJKjp-Regular-subset.otf");
	let cff = outlines(font);

	test("opens as CID-keyed with an FDArray", () => {
		expect(cff.table.cid).toBe(true);
		expect(cff.table.fontDicts.length).toBeGreaterThan(0);
		expect(cff.glyphName(1)).toBeNull();
	});

	test("selects a Font DICT for every glyph", () => {
		let fds = cff.table.fdSelect?.fds ?? new Uint16Array();
		expect(fds).toHaveLength(font.glyphCount);
		for (let fd of fds) expect(fd).toBeLessThan(cff.table.fontDicts.length);
	});

	test("draws every glyph as closed contours", () => {
		let drawn = 0;
		for (let glyph = 1; glyph < font.glyphCount; glyph++) {
			let commands = font.outline(glyph);
			if (commands.length > 0) drawn++;
		}
		expect(drawn).toBeGreaterThan(0);
	});
});

describe("Playfair Display (CFF)", () => {
	let font = open("PlayfairDisplay/PlayfairDisplay-Regular.otf");

	test("draws glyph 5", () => {
		let commands = font.outline(5);
		expect(commands.length).toBeGreaterThan(0);
		expect(commands.at(-1)?.type).toBe("close");
	});

	test("draws every glyph", () => {
		for (let glyph = 0; glyph < font.glyphCount; glyph++) font.outline(glyph);
	});
});

describe("AdobeVFPrototype (CFF2)", () => {
	let font = open("fonttest/AdobeVFPrototype-Subset.otf");
	let cff = outlines(font);
	let dollar = font.glyphIndex(0x24);

	test("opens as CFF2 without glyph names", () => {
		expect(cff.kind).toBe("cff2");
		expect(cff.glyphName(dollar)).toBeNull();
		expect(cff.width(dollar)).toBeNull();
		expect(cff.table.variationStore).not.toBeNull();
	});

	test("draws the default instance with or without zero coordinates", () => {
		let commands = font.outline(dollar);
		expect(commands.length).toBeGreaterThan(0);
		expect(cff.commands(dollar, [0, 0])).toEqual(commands);
	});

	test("blends to wght 100", () => {
		expect(svg(cff.commands(dollar, [-0.9, 0]))).toBe(
			"M245.82 14.61C187.88 14.61 147.25 26.89 101.25 68.2L141.87 23.46L116.86 116.93C110.69 142.99 95.97 149.44 81.44 149.44C65.26 149.44 55.63 141.35 52.46 125.72C71.02 40.17 137.46 -13 244.46 -13C347.69 -13 435.51 46.25 435.51 156.16C435.51 229.42 405.44 295.15 271.16 349.44L247 358.79C159.98 393.45 118.52 438.64 118.52 505.55C118.52 592.21 177.71 637.22 261.9 637.22C310.84 637.22 346.11 625.66 389.56 584.63L347.76 628.64L372.77 535.16C380.4 510.11 394.48 502.66 408.47 502.66C423.83 502.66 434.27 510.48 437.17 526.38C418.07 613.84 347.53 665.1 258.91 665.1C160.66 665.1 78.39 606.22 78.39 499.85C78.39 414.41 128.01 361.14 223.54 320.5L260.54 304.59C366.66 258.56 395.38 216.91 395.38 152.46C395.38 65.35 333.64 14.61 245.82 14.61ZM267.35 330.74L267.35 758.74L240.46 758.74L240.46 330.74L267.35 330.74ZM240.18 -115L267.08 -115L267.08 330.74L240.18 330.74L240.18 -115Z",
		);
	});

	test("blends to wght 500", () => {
		expect(svg(cff.commands(dollar, [-0.5, 0]))).toBe(
			"M250.51 35.84C206.08 35.84 164.63 42.09 118 61.34L176.22 21.37L161.1 99.25C150.56 152.04 128.56 166.51 100.6 166.51C77.76 166.51 61.04 154.88 51 131.12C54.16 43.49 133.08 -13.63 246.76 -13.63C388.4 -13.63 473.95 64.04 473.95 171.25C473.95 258.48 429.82 321.18 294.19 370.06L257.44 383.06C188.12 406.48 150.2 437.92 150.2 498.58C150.2 571.08 204.28 605.57 275.56 605.57C308.07 605.57 342.19 600.78 386.28 582.32L327.39 620.61L342.92 546.49C354.72 489.69 382.22 475.69 407.77 475.69C428.24 475.69 447.74 486.73 455.12 511.91C450.37 597.49 369.53 655.82 264.36 655.82C140.37 655.82 56.96 575.82 56.96 473.61C56.96 372.57 119.37 318.36 226.88 278.85L262.63 265.85C344.91 235.85 379.24 208.15 379.24 145.15C379.24 76.37 329.16 35.84 250.51 35.84ZM288.61 320.33L288.61 746.03L242.13 746.03L242.13 320.33L288.61 320.33ZM239.67 -115L286.15 -115L286.15 320.33L239.67 320.33L239.67 -115Z",
		);
	});

	test("blends the GSUB alternate dollar.nostroke to wght 900", () => {
		expect(svg(cff.commands(2, [-0.1, 0]))).toBe(
			"M258.1 38.37C197.22 38.37 166.53 48.42 118 71.47L192.04 19.47L182.62 103.05C176.51 155.21 154.51 174.1 114.52 174.1C89.15 174.1 64.21 160.58 51 125.42C51.63 35.9 124.22 -15.53 258.15 -15.53C416.88 -15.53 513.19 67.21 513.19 175.05C513.19 278.1 457.04 327.94 322.04 388.41L289.09 403.1C231.56 428.62 203.34 451.84 203.34 499.84C203.34 562.22 244.35 589.11 300.67 589.11C341.61 589.11 370.04 584.96 420.46 562.06L340.68 607.32L351.78 538.9C362.94 467.54 398.04 453.54 434.35 453.54C459.25 453.54 486.35 467.75 491.82 505.58C490.87 589.9 407.51 643.16 289.67 643.16C141 643.16 57.16 563.16 57.16 460.32C57.16 356.96 121.68 307.16 232.58 255.85L264.53 241.17C333.53 209.49 362.8 186.22 362.8 129.96C362.8 77 319.9 38.37 258.1 38.37ZM317.72 615.64L317.72 734.01L251.63 734.01L251.63 615.64L317.72 615.64ZM253.15 -115L319.25 -115L319.25 13.68L253.15 13.68L253.15 -115Z",
		);
	});

	test("leaves the cached default instance alone after blending", () => {
		let before = font.outline(dollar);
		cff.commands(dollar, [-0.9, 0]);
		expect(font.outline(dollar)).toEqual(before);
	});
});

describe("aots cmap10_font1 (CFF)", () => {
	test("opens and draws its glyphs", () => {
		let bytes = fixture("aots/cmap10_font1.otf");
		let reader = new Reader(bytes);
		let tables = new Map<string, TableRecord>();
		for (let index = 0; index < reader.u16(4); index++) {
			let record = 12 + index * 16;
			tables.set(reader.tag(record), {
				offset: reader.u32(record + 8),
				length: reader.u32(record + 12),
			});
		}
		let maxp = tables.get("maxp")?.offset ?? 0;
		let numGlyphs = reader.u16(maxp + 4);
		let cff = unwrap(openCff(reader, tables, numGlyphs));
		expect(cff.kind).toBe("cff");
		let drawn = 0;
		for (let glyph = 0; glyph < numGlyphs; glyph++) {
			if (cff.commands(glyph).length > 0) drawn++;
		}
		expect(drawn).toBeGreaterThan(0);
	});
});

/** Charstring and DICT operand: a 16-bit integer, or 16.16 fixed for a fraction. */
function num(value: number): number[] {
	if (Number.isInteger(value)) return [28, (value >> 8) & 0xff, value & 0xff];
	let fixed = Math.round(value * 65536);
	return [255, (fixed >>> 24) & 0xff, (fixed >>> 16) & 0xff, (fixed >>> 8) & 0xff, fixed & 0xff];
}

/** A DICT integer operand in its 5-byte form, so DICT sizes never depend on offsets. */
function long(value: number): number[] {
	return [29, (value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

/** A CFF INDEX with 4-byte offsets. */
function index(items: number[][]): number[] {
	if (items.length === 0) return [0, 0];
	let offsets: number[] = [];
	let at = 1;
	offsets.push(...long(at).slice(1));
	for (let item of items) {
		at += item.length;
		offsets.push(...long(at).slice(1));
	}
	return [(items.length >> 8) & 0xff, items.length & 0xff, 4, ...offsets, ...items.flat()];
}

/** What a hand-built CFF table holds. */
interface Build {
	charStrings: number[][];
	subrs?: number[][];
	globalSubrs?: number[][];
	/** SID of each glyph after `.notdef`, written as a format 0 charset. */
	sids?: number[];
	nominalWidthX?: number;
	numGlyphs?: number;
}

/**
 * Builds a name-keyed `CFF ` table and opens it.
 *
 * @param build - Charstrings, subroutines and charset.
 */
function build(build: Build): ReturnType<typeof openCff> {
	let names = index([[0x41]]);
	let strings = index([]);
	let globals = index(build.globalSubrs ?? []);
	let topSize = 6 + 11 + 6;
	let topIndex = 2 + 1 + 8 + topSize;
	let charStringsAt = 4 + names.length + topIndex + strings.length + globals.length;
	let charStrings = index(build.charStrings);
	let privateAt = charStringsAt + charStrings.length;
	let privateDict = [...long(12), 19, ...long(build.nominalWidthX ?? 0), 21];
	let subrs = index(build.subrs ?? []);
	let charsetAt = privateAt + privateDict.length + subrs.length;
	let charset = [
		0,
		...(build.sids ?? build.charStrings.slice(1).map(() => 0)).flatMap((sid) => [
			sid >> 8,
			sid & 0xff,
		]),
	];
	let top = [
		...long(charStringsAt),
		17,
		...long(privateDict.length),
		...long(privateAt),
		18,
		...long(charsetAt),
		15,
	];
	let bytes = [
		1,
		0,
		4,
		4,
		...names,
		...index([top]),
		...strings,
		...globals,
		...charStrings,
		...privateDict,
		...subrs,
		...charset,
	];
	let tables = new Map<string, TableRecord>([["CFF ", { offset: 0, length: bytes.length }]]);
	return openCff(
		new Reader(new Uint8Array(bytes)),
		tables,
		build.numGlyphs ?? build.charStrings.length,
	);
}

/**
 * Draws glyph 1 of a font whose `.notdef` is empty.
 *
 * @param charstring - Glyph 1's charstring.
 * @param extra - Other parts of the font.
 */
function draw(charstring: number[], extra: Partial<Build> = {}): string {
	let cff = unwrap(build({ charStrings: [[14], charstring], ...extra }));
	return svg(cff.commands(1));
}

const RMOVETO = 21;
const ENDCHAR = 14;

describe("hand-built charstrings", () => {
	test("hflex draws two curves back to the starting height", () => {
		let flex = [...[10, 10, 10, 10, 10, 10, 10].flatMap(num), 12, 34];
		expect(draw([...num(0), ...num(0), RMOVETO, ...flex, ENDCHAR])).toBe(
			"M0 0C10 0 20 10 30 10C40 10 50 0 60 0Z",
		);
	});

	test("flex draws two curves from twelve deltas", () => {
		let flex = [...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 50].flatMap(num), 12, 35];
		expect(draw([...num(0), ...num(0), RMOVETO, ...flex, ENDCHAR])).toBe(
			"M0 0C1 2 4 6 9 12C16 20 25 30 36 42Z",
		);
	});

	test("hflex1 returns to the starting height", () => {
		let flex = [...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap(num), 12, 36];
		expect(draw([...num(0), ...num(0), RMOVETO, ...flex, ENDCHAR])).toBe(
			"M0 0C1 2 4 6 9 6C15 6 22 14 31 0Z",
		);
	});

	test("flex1 ends on the axis the curves travelled further", () => {
		let flex = [...[10, 1, 10, 1, 10, 1, 10, -1, 10, -1, 5].flatMap(num), 12, 37];
		expect(draw([...num(0), ...num(0), RMOVETO, ...flex, ENDCHAR])).toBe(
			"M0 0C10 1 20 2 30 3C40 2 50 1 55 0Z",
		);
	});

	test("line and curve operators chain from the current point", () => {
		let body = [
			...[0, 0].flatMap(num),
			RMOVETO,
			...[10, 20, 30].flatMap(num),
			6,
			...[1, 2, 3, 4, 5].flatMap(num),
			31,
			...[1, 1, 2, 2, 3, 3, 4, 4].flatMap(num),
			24,
			...[5, 5, 1, 2, 3, 4, 5, 6].flatMap(num),
			25,
			ENDCHAR,
		];
		expect(draw(body)).toBe(
			"M0 0L10 0L10 20L40 20C41 20 43 23 48 27C49 28 51 30 54 33L58 37L63 42C64 44 67 48 72 54Z",
		);
	});

	test("vvcurveto and hhcurveto take an optional leading offset", () => {
		let body = [
			...[0, 0].flatMap(num),
			RMOVETO,
			...[5, 10, 1, 1, 10].flatMap(num),
			26,
			...[7, 10, 1, 1, 10].flatMap(num),
			27,
			ENDCHAR,
		];
		expect(draw(body)).toBe("M0 0C5 10 6 11 6 21C16 28 17 29 27 29Z");
	});

	test("arithmetic and storage operators compute operands", () => {
		let body = [
			...[10, 3].flatMap(num),
			12,
			11,
			...[0].flatMap(num),
			12,
			20,
			...[9, 3].flatMap(num),
			12,
			12,
			...[0].flatMap(num),
			12,
			21,
			12,
			10,
			...[1, 2].flatMap(num),
			12,
			28,
			12,
			11,
			12,
			24,
			...[0].flatMap(num),
			RMOVETO,
			ENDCHAR,
		];
		expect(draw(body)).toBe("M10 0Z");
	});

	test("ifelse, roll, index and dup rearrange the stack", () => {
		let body = [
			...[1, 2, 3, 4].flatMap(num),
			12,
			22,
			...[5, 6, 7].flatMap(num),
			...[3, 1].flatMap(num),
			12,
			30,
			12,
			18,
			12,
			18,
			...[0].flatMap(num),
			12,
			29,
			12,
			10,
			12,
			27,
			12,
			24,
			RMOVETO,
			ENDCHAR,
		];
		expect(draw(body)).toBe("M1 196Z");
	});

	test("a width operand is read before the first stack-clearing operator", () => {
		let cff = unwrap(
			build({
				charStrings: [[14], [...[50, 0, 0].flatMap(num), RMOVETO, ENDCHAR]],
				nominalWidthX: 100,
			}),
		);
		expect(cff.width(1)).toBe(150);
		expect(cff.width(0)).toBe(0);
	});

	test("hintmask skips its mask bytes", () => {
		let body = [...[10, 20].flatMap(num), 1, 19, 0xff, ...[5, 5].flatMap(num), RMOVETO, ENDCHAR];
		expect(draw(body)).toBe("M5 5Z");
	});

	test("callsubr and callgsubr apply the subroutine bias", () => {
		let body = [...num(-107), 10, ...num(-107), 29, ENDCHAR];
		let extra = {
			subrs: [[...[1, 2].flatMap(num), RMOVETO, 11]],
			globalSubrs: [[...[3, 4].flatMap(num), 5, 11]],
		};
		expect(draw(body, extra)).toBe("M1 2L4 6Z");
	});

	test("seac composes a base and an accent through the Standard encoding", () => {
		let a = [...[10, 0].flatMap(num), RMOVETO, ...[10, 10].flatMap(num), 5, ENDCHAR];
		let acute = [...[0, 0].flatMap(num), RMOVETO, ...[5, 5].flatMap(num), 5, ENDCHAR];
		let aacute = [...[100, 200, 65, 194].flatMap(num), ENDCHAR];
		let cff = unwrap(build({ charStrings: [[14], a, acute, aacute], sids: [34, 125, 0] }));
		expect(svg(cff.commands(3))).toBe("M10 0L20 10ZM100 200L105 205Z");
	});
});

describe("hostile charstrings", () => {
	test("a subroutine calling itself stops at the depth limit", () => {
		let body = [...[1, 1].flatMap(num), RMOVETO, ...num(-107), 10, ENDCHAR];
		let subrs = [[...[1, 0].flatMap(num), 5, ...num(-107), 10, 11]];
		let path = draw(body, { subrs });
		expect(path.startsWith("M1 1L2 1L3 1")).toBe(true);
		expect(path.endsWith("Z")).toBe(true);
	});

	test("a call tree that would run for ages stops at the work limit", () => {
		let fan = (next: number): number[] => [
			...Array.from({ length: 20 }, () => [...num(next - 107), 10]).flat(),
			11,
		];
		let subrs = [
			...Array.from({ length: 9 }, (_, level) => fan(level + 1)),
			[...[1, 0].flatMap(num), 5, 11],
		];
		let started = performance.now();
		let path = draw([...[0, 0].flatMap(num), RMOVETO, ...num(-107), 10, ENDCHAR], { subrs });
		expect(performance.now() - started).toBeLessThan(2000);
		expect(path.startsWith("M0 0L1 0L2 0")).toBe(true);
	});

	test("a stack deeper than 48 operands stops the glyph", () => {
		let body = [
			...[0, 0].flatMap(num),
			RMOVETO,
			...Array.from({ length: 60 }, () => num(1)).flat(),
			5,
		];
		expect(draw(body)).toBe("M0 0Z");
	});

	test("an unknown operator, a missing subroutine and a truncated operand end the glyph", () => {
		expect(draw([...[0, 0].flatMap(num), RMOVETO, 0, ...[1, 1].flatMap(num), 5])).toBe("M0 0Z");
		expect(draw([...[0, 0].flatMap(num), RMOVETO, ...num(5), 10])).toBe("M0 0Z");
		expect(draw([...[0, 0].flatMap(num), RMOVETO, 28])).toBe("M0 0Z");
	});
});

describe("malformed tables", () => {
	test("a CharStrings count other than numGlyphs", () => {
		let result = build({ charStrings: [[14], [14]], numGlyphs: 3 });
		expect(isFailure(result) && result.error.code).toBe("malformed");
		expect(isFailure(result) && result.error.table).toBe("CFF ");
	});

	test("a truncated table and an unknown version", () => {
		let reader = new Reader(new Uint8Array([1, 0, 4, 4, 0, 1, 4]));
		let tables = new Map<string, TableRecord>([["CFF ", { offset: 0, length: 7 }]]);
		expect(isFailure(openCff(reader, tables, 1))).toBe(true);
		let wrong = new Reader(new Uint8Array([3, 0, 4, 4, 0, 0]));
		let result = openCff(wrong, new Map([["CFF ", { offset: 0, length: 6 }]]), 1);
		expect(isFailure(result) && result.error.code).toBe("malformed");
	});

	test("every truncation of a valid table fails or draws without throwing", () => {
		let bytes = fixture("NotoSansCJK/NotoSansCJKjp-Regular-subset.otf");
		let reader = new Reader(bytes);
		let tables = new Map<string, TableRecord>();
		for (let index = 0; index < reader.u16(4); index++) {
			let record = 12 + index * 16;
			tables.set(reader.tag(record), {
				offset: reader.u32(record + 8),
				length: reader.u32(record + 12),
			});
		}
		let cff = tables.get("CFF ") ?? { offset: 0, length: 0 };
		for (let cut = 0; cut < cff.length; cut += 7) {
			let result = openCff(reader, new Map([["CFF ", { offset: cff.offset, length: cut }]]), 4);
			if (isFailure(result)) continue;
			for (let glyph = 0; glyph < 4; glyph++) result.data.commands(glyph);
		}
	});
});
