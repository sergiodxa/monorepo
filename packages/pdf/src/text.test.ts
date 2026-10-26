/**
 * Tests for single lines of text: where `page.text()` puts the baseline and each alignment,
 * and how a line's glyphs, kerning and word spacing reach the `TJ` operand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Canvas } from "./canvas.js";

import { inspect, pageContents } from "./inspect.js";
import { num } from "./objects.js";
import { PDF } from "./pdf.js";
import { showText } from "./text.js";

const INTER = new Uint8Array(
	readFileSync(join(import.meta.dirname, "../../font/src/fixtures/inter-regular.ttf")),
);

/**
 * The `Td` operands of every text block in a content stream.
 *
 * @param content - A page's content.
 */
function positions(content: string): [number, number][] {
	return [...content.matchAll(/^(-?[\d.]+) (-?[\d.]+) Td$/gm)].map((match) => [
		Number(match[1]),
		Number(match[2]),
	]);
}

describe("page.text", () => {
	test("places the baseline the font's ascent below y, in PDF space", async () => {
		let pdf = new PDF({ size: [300, 200] });
		let font = unwrap(pdf.font(INTER));
		pdf.page().text("Hi", { x: 20, y: 30, font, size: 10, color: "#ff0000" });
		let [content = ""] = await pageContents(inspect(await pdf.bytes()));
		expect(content).toBe(
			[
				"BT",
				"1 0 0 rg",
				"/F1 10 Tf",
				`20 ${num(200 - 30 - font.ascent(10))} Td`,
				content.split("\n")[4],
				"ET",
			].join("\n"),
		);
		expect(content).toMatch(/^\[<[\dA-F]{8}>\] TJ$/m);
	});

	test("defaults to black", async () => {
		let pdf = new PDF();
		let font = unwrap(pdf.font(INTER));
		pdf.page().text("Hi", { x: 0, y: 0, font, size: 10 });
		let [content = ""] = await pageContents(inspect(await pdf.bytes()));
		expect(content).toContain("BT\n0 0 0 rg\n");
	});

	test("measures from x for center and right alignment", async () => {
		let pdf = new PDF();
		let font = unwrap(pdf.font(INTER));
		let page = pdf.page();
		let width = font.measure("Total due", 12);
		page.text("Total due", { x: 300, y: 0, font, size: 12, align: "left" });
		page.text("Total due", { x: 300, y: 0, font, size: 12, align: "center" });
		page.text("Total due", { x: 300, y: 0, font, size: 12, align: "right" });
		let [content = ""] = await pageContents(inspect(await pdf.bytes()));
		let xs = positions(content).map(([x]) => x);
		expect(xs).toEqual([300, Number(num(300 - width / 2)), Number(num(300 - width))]);
	});

	test("writes each kerning pair as a TJ adjustment", async () => {
		let pdf = new PDF();
		let font = unwrap(pdf.font(INTER));
		pdf.page().text("AV To", { x: 0, y: 0, font, size: 12 });
		let [content = ""] = await pageContents(inspect(await pdf.bytes()));
		let f = font.font;
		let kern = (pair: string) =>
			f.kerning(f.glyphIndex(pair.codePointAt(0) ?? 0), f.glyphIndex(pair.codePointAt(1) ?? 0));
		expect(kern("AV")).toBeLessThan(0);
		expect(kern("To")).toBeLessThan(0);
		let adjust = (pair: string) => num((-kern(pair) * 1000) / f.unitsPerEm);
		expect(content).toMatch(
			new RegExp(
				`^\\[<[\\dA-F]{4}> ${adjust("AV")} <[\\dA-F]{12}> ${adjust("To")} <[\\dA-F]{4}>\\] TJ$`,
				"m",
			),
		);
	});
});

describe("showText", () => {
	test("adds word spacing after every space as a TJ adjustment", async () => {
		let pdf = new PDF({ size: [200, 100] });
		let font = unwrap(pdf.font(INTER));
		let canvas: Canvas = {
			width: 200,
			height: 100,
			ops: [],
			fonts: new Set(),
			images: new Set(),
			links: [],
		};
		showText(canvas, {
			font,
			size: 10,
			color: "#000000",
			x: 5,
			baseline: 50,
			text: "a b c",
			wordSpacing: 2,
		});
		expect(canvas.fonts.has(font)).toBe(true);
		let op = canvas.ops[0];
		let block = typeof op === "function" ? op() : op;
		expect(block).toContain("5 50 Td");
		expect(block).toMatch(/^\[<[\dA-F]{8}> -200 <[\dA-F]{8}> -200 <[\dA-F]{4}>\] TJ$/m);
	});
});
