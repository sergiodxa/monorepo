/**
 * Tests for paragraph layout against Inter Regular: wrapping, collapsing whitespace, style
 * inheritance, alignment and justification, line-height metrics, splitting at a page break
 * and drawing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { unwrap } from "@sdxc/result";
import { assert, describe, expect, test } from "vitest";

import type { Fragment, Line, Paragraph } from "./paragraph.js";

import { PDF } from "./pdf.js";

const INTER = new Uint8Array(
	readFileSync(join(import.meta.dirname, "../../font/src/fixtures/inter-regular.ttf")),
);

const LOREM =
	"Built and maintained a TypeScript monorepo of more than forty packages, shipping daily " +
	"releases to npm and deploying a dozen Cloudflare Workers with zero-downtime migrations.";

/**
 * A document with Inter registered twice, so the second registration stands in for a
 * different face with the same metrics.
 */
function setup() {
	let pdf = new PDF();
	let regular = unwrap(pdf.font(INTER));
	let bold = unwrap(pdf.font(INTER));
	return { pdf, regular, bold };
}

/**
 * Each line's text, fragments joined.
 *
 * @param paragraph - A laid-out paragraph.
 */
function texts(paragraph: Paragraph): string[] {
	return paragraph.lines.map((line) => line.fragments.map((f) => f.text).join(""));
}

/**
 * A line the test expects to exist, failing the test when it is missing.
 *
 * @param paragraph - A laid-out paragraph.
 * @param index - The line's position.
 */
function lineAt(paragraph: Paragraph, index: number): Line {
	let line = paragraph.lines[index];
	assert.exists(line);
	return line;
}

/**
 * A fragment the test expects to exist, failing the test when it is missing.
 *
 * @param line - A line.
 * @param index - The fragment's position.
 */
function fragmentAt(line: Line, index: number): Fragment {
	let fragment = line.fragments[index];
	assert.exists(fragment);
	return fragment;
}

describe("layoutParagraph", () => {
	test("an empty paragraph has no lines and no height", () => {
		let { pdf, regular } = setup();
		let paragraph = pdf.paragraph([], { width: 100, font: regular, size: 10 });
		expect(paragraph.lines).toEqual([]);
		expect(paragraph.height).toBe(0);
		let blank = pdf.paragraph([{ text: "   " }], { width: 100, font: regular, size: 10 });
		expect(blank.lines).toEqual([]);
	});

	test("wraps within the width and keeps every word in order", () => {
		let { pdf, regular } = setup();
		let paragraph = pdf.paragraph([{ text: LOREM }], { width: 180, font: regular, size: 10 });
		expect(paragraph.lines.length).toBeGreaterThan(2);
		for (let line of paragraph.lines) {
			expect(line.width).toBeLessThanOrEqual(180);
			let last = line.fragments.at(-1);
			expect(last?.text.endsWith(" ")).toBe(false);
		}
		let words = texts(paragraph).join(" ").replace(/- /g, "-").split(" ");
		expect(words).toEqual(LOREM.split(" "));
	});

	test("a word that fits on the line it continues stays on it", () => {
		let { pdf, regular } = setup();
		let full = regular.measure("one two", 10);
		let paragraph = pdf.paragraph([{ text: "one two three" }], {
			width: full,
			font: regular,
			size: 10,
		});
		expect(texts(paragraph)).toEqual(["one two", "three"]);
	});

	test("collapses whitespace and treats a newline as a forced break", () => {
		let { pdf, regular } = setup();
		let paragraph = pdf.paragraph([{ text: "  one \t two  \n  three\n\nfour" }], {
			width: 500,
			font: regular,
			size: 10,
		});
		expect(texts(paragraph)).toEqual(["one two", "three", "", "four"]);
		expect(lineAt(paragraph, 2).height).toBeCloseTo(lineAt(paragraph, 0).height);
	});

	test("breaks after a hyphen and keeps the hyphen on the first line", () => {
		let { pdf, regular } = setup();
		let width = regular.measure("zero-down", 10);
		let paragraph = pdf.paragraph([{ text: "zero-downtime" }], { width, font: regular, size: 10 });
		expect(texts(paragraph)).toEqual(["zero-", "downtime"]);
		let dashes = pdf.paragraph([{ text: "--flag -5" }], {
			width: regular.measure("--flag", 10),
			font: regular,
			size: 10,
		});
		expect(texts(dashes)).toEqual(["--flag", "-5"]);
	});

	test("breaks a word wider than the line between characters", () => {
		let { pdf, regular } = setup();
		let word = "supercalifragilistic";
		let width = regular.measure("supercal", 10);
		let paragraph = pdf.paragraph([{ text: `${word} ok` }], { width, font: regular, size: 10 });
		expect(paragraph.lines.length).toBeGreaterThan(2);
		for (let line of paragraph.lines) expect(line.width).toBeLessThanOrEqual(width + 1e-6);
		expect(texts(paragraph).join("").replace(" ", "")).toBe(`${word}ok`);
		let narrow = pdf.paragraph([{ text: "MW" }], { width: 1, font: regular, size: 10 });
		expect(texts(narrow)).toEqual(["M", "W"]);
	});

	test("runs inherit the paragraph's style and override parts of it", () => {
		let { pdf, regular, bold } = setup();
		let paragraph = pdf.paragraph(
			[
				{ text: "Plain " },
				{ text: "bold", font: bold },
				{ text: " big", size: 14, color: "#ff0000", href: "https://example.com" },
			],
			{ width: 500, font: regular, size: 10, color: "#333333" },
		);
		let first = lineAt(paragraph, 0);
		let plain = fragmentAt(first, 0);
		let strong = fragmentAt(first, 1);
		let big = fragmentAt(first, 2);
		expect(plain).toMatchObject({ text: "Plain ", font: regular, size: 10, color: "#333333" });
		expect(plain.href).toBeUndefined();
		expect(strong).toMatchObject({ text: "bold", font: bold, size: 10, color: "#333333" });
		expect(big).toMatchObject({
			text: " big",
			font: regular,
			size: 14,
			color: "#ff0000",
			href: "https://example.com",
		});
		expect(strong.x).toBeCloseTo(plain.width);
		expect(big.x).toBeCloseTo(plain.width + strong.width);
	});

	test("merges adjacent text in one style into one fragment per line", () => {
		let { pdf, regular } = setup();
		let paragraph = pdf.paragraph([{ text: "one two " }, { text: "three four" }], {
			width: regular.measure("one two three", 10),
			font: regular,
			size: 10,
		});
		expect(paragraph.lines.map((line) => line.fragments.map((f) => f.text))).toEqual([
			["one two three"],
			["four"],
		]);
		let link = pdf.paragraph([{ text: "see my site", href: "https://example.com" }], {
			width: regular.measure("see my", 10),
			font: regular,
			size: 10,
		});
		expect(link.lines.map((line) => line.fragments.length)).toEqual([1, 1]);
	});

	test("justifies every line but the last and those ending in a newline", () => {
		let { pdf, regular, bold } = setup();
		let paragraph = pdf.paragraph(
			[{ text: "Built and " }, { text: "maintained", font: bold }, { text: ` ${LOREM}\nEnd here` }],
			{ width: 200, font: regular, size: 10, align: "justify" },
		);
		let lines = paragraph.lines;
		let forced = texts(paragraph).indexOf("End here") - 1;
		for (let [index, line] of lines.entries()) {
			let last = line.fragments.at(-1);
			let right = (last?.x ?? 0) + (last?.width ?? 0);
			if (index === forced || index === lines.length - 1) {
				expect(line.fragments.every((f) => f.wordSpacing === 0)).toBe(true);
				expect(right).toBeCloseTo(line.width);
			} else {
				expect(right).toBeCloseTo(200, 6);
				expect(fragmentAt(line, 0).wordSpacing).toBeGreaterThan(0);
			}
		}
		expect(forced).toBeGreaterThan(0);
	});

	test("a justified line without spaces stays at the left", () => {
		let { pdf, regular } = setup();
		let paragraph = pdf.paragraph([{ text: "abcdefghijklmnop" }], {
			width: regular.measure("abcdefg", 10),
			font: regular,
			size: 10,
			align: "justify",
		});
		expect(fragmentAt(lineAt(paragraph, 0), 0)).toMatchObject({ x: 0, wordSpacing: 0 });
	});

	test("centers and right-aligns each line in the width", () => {
		let { pdf, regular } = setup();
		let natural = regular.measure("Hello world", 10);
		let center = pdf.paragraph([{ text: "Hello world" }], {
			width: 300,
			font: regular,
			size: 10,
			align: "center",
		});
		expect(fragmentAt(lineAt(center, 0), 0).x).toBeCloseTo((300 - natural) / 2);
		let right = pdf.paragraph([{ text: "Hello world" }], {
			width: 300,
			font: regular,
			size: 10,
			align: "right",
		});
		expect(fragmentAt(lineAt(right, 0), 0).x).toBeCloseTo(300 - natural);
		expect(lineAt(right, 0).width).toBeCloseTo(natural);
	});

	test("line height follows the CSS model across mixed sizes", () => {
		let { pdf, regular } = setup();
		let ascent = (size: number) => regular.ascent(size);
		let descent = (size: number) => regular.descent(size);
		let half = (size: number) => (size * 1.5 - (ascent(size) + descent(size))) / 2;
		let paragraph = pdf.paragraph([{ text: "small " }, { text: "large", size: 20 }], {
			width: 500,
			font: regular,
			size: 10,
			lineHeight: 1.5,
		});
		let above = Math.max(ascent(10) + half(10), ascent(20) + half(20));
		let below = Math.max(descent(10) + half(10), descent(20) + half(20));
		let line = lineAt(paragraph, 0);
		expect(line.baseline).toBeCloseTo(above);
		expect(line.height).toBeCloseTo(above + below);
		let single = pdf.paragraph([{ text: "x" }], { width: 500, font: regular, size: 10 });
		expect(lineAt(single, 0).height).toBeCloseTo(12);
	});

	test("line offsets accumulate and the height is their sum", () => {
		let { pdf, regular } = setup();
		let paragraph = pdf.paragraph([{ text: LOREM }], { width: 150, font: regular, size: 10 });
		let y = 0;
		for (let line of paragraph.lines) {
			expect(line.y).toBeCloseTo(y);
			y += line.height;
		}
		expect(paragraph.height).toBeCloseTo(y);
	});
});

describe("Paragraph.split", () => {
	let { pdf, regular } = setup();
	let paragraph = pdf.paragraph([{ text: "one\ntwo\nthree\nfour" }], {
		width: 500,
		font: regular,
		size: 10,
	});
	let line = lineAt(paragraph, 0).height;

	test("keeps every line that fits exactly", () => {
		let [fits, rest] = paragraph.split(line * 2);
		expect(texts(fits)).toEqual(["one", "two"]);
		expect(fits.width).toBe(500);
		expect(fits.height).toBeCloseTo(line * 2);
		expect(rest && texts(rest)).toEqual(["three", "four"]);
		expect(rest?.lines.map((l) => l.y)).toEqual([0, expect.closeTo(line)]);
		expect(rest?.width).toBe(500);
		expect(rest?.height).toBeCloseTo(line * 2);
	});

	test("answers no lines and the whole paragraph when the first line does not fit", () => {
		let [fits, rest] = paragraph.split(line - 0.01);
		expect(fits.lines).toEqual([]);
		expect(fits.height).toBe(0);
		expect(rest).toBe(paragraph);
	});

	test("answers the paragraph itself and no rest when everything fits", () => {
		let [fits, rest] = paragraph.split(paragraph.height);
		expect(fits).toBe(paragraph);
		expect(rest).toBeNull();
	});
});

describe("drawParagraph", () => {
	test("returns the y below the last line", () => {
		let { pdf, regular } = setup();
		let paragraph = pdf.paragraph([{ text: LOREM, href: "https://example.com" }], {
			width: 200,
			font: regular,
			size: 10,
		});
		let page = pdf.page();
		expect(page.paragraph(paragraph, { x: 40, y: 60 })).toBeCloseTo(60 + paragraph.height);
	});
});
