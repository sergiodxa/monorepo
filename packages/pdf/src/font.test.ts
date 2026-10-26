/**
 * Tests for embedding a TrueType font: the `Type0`/`CIDFontType2` objects, the subset written
 * as `FontFile2`, the `W` array and `ToUnicode` map, and the licenses that refuse embedding.
 * Every check reads the written file back, so it covers what a viewer receives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseFont } from "@sdxc/font";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { InspectedFile, InspectedObject } from "./inspect.js";

import { inflate, inspect, latin1, pageContents } from "./inspect.js";
import { PDF } from "./pdf.js";

const INTER = new Uint8Array(
	readFileSync(join(import.meta.dirname, "../../font/src/fixtures/inter-regular.ttf")),
);

/**
 * Writes a one-page document drawing each line with Inter at 12 points.
 *
 * @param lines - The lines to draw.
 */
async function document(lines: string[]): Promise<InspectedFile> {
	let pdf = new PDF();
	let font = unwrap(pdf.font(INTER));
	let page = pdf.page();
	for (let [index, line] of lines.entries())
		page.text(line, { x: 40, y: 40 + index * 20, font, size: 12 });
	return inspect(await pdf.bytes());
}

/**
 * The first object whose dictionary matches a pattern.
 *
 * @param file - An inspected file.
 * @param pattern - What its head must contain.
 */
function find(file: InspectedFile, pattern: RegExp): InspectedObject {
	let object = [...file.objects.values()].find((candidate) => pattern.test(candidate.head));
	if (!object) return expect.unreachable(`No object matches ${pattern}`);
	return object;
}

/**
 * The object a key of a dictionary references.
 *
 * @param file - An inspected file.
 * @param object - The dictionary holding the key.
 * @param key - The key, without its slash.
 */
function follow(file: InspectedFile, object: InspectedObject, key: string): InspectedObject {
	let id = new RegExp(`/${key} (\\d+) 0 R`).exec(object.head)?.[1];
	let target = file.objects.get(Number(id));
	if (!target) return expect.unreachable(`/${key} references nothing`);
	return target;
}

/**
 * The `bfchar` entries of a `ToUnicode` CMap as id to text.
 *
 * @param cmap - The inflated CMap.
 */
function bfchars(cmap: string): Map<number, string> {
	let map = new Map<number, string>();
	for (let match of cmap.matchAll(/^<([\dA-F]{4})> <([\dA-F]+)>$/gm)) {
		let units = (match[2] ?? "").match(/.{4}/g) ?? [];
		map.set(
			Number.parseInt(match[1] ?? "", 16),
			String.fromCharCode(...units.map((unit) => Number.parseInt(unit, 16))),
		);
	}
	return map;
}

/**
 * The ids every `TJ` operand of a content stream shows, in order.
 *
 * @param content - A page's content.
 */
function shownIds(content: string): number[] {
	let ids: number[] = [];
	for (let match of content.matchAll(/<([\dA-F]+)>/g)) {
		for (let unit of (match[1] ?? "").match(/.{4}/g) ?? []) ids.push(Number.parseInt(unit, 16));
	}
	return ids;
}

/**
 * Inter with `OS/2.fsType` overwritten, for licenses the fixture does not carry. `parseFont`
 * reads no checksums, so the patched file still parses.
 *
 * @param fsType - The value to write.
 */
function withFsType(fsType: number): Uint8Array {
	let bytes = INTER.slice();
	let view = new DataView(bytes.buffer);
	let tables = view.getUint16(4);
	for (let index = 0; index < tables; index++) {
		let record = 12 + index * 16;
		if (latin1(bytes.subarray(record, record + 4)) !== "OS/2") continue;
		view.setUint16(view.getUint32(record + 8) + 8, fsType);
	}
	return bytes;
}

describe("font embedding", () => {
	test("writes a Type0 font with an Identity-H CIDFontType2 descendant", async () => {
		let file = await document(["Hello"]);
		let type0 = find(file, /\/Subtype \/Type0/);
		expect(type0.head).toContain("/Encoding /Identity-H");
		let descendant = file.objects.get(
			Number(/\/DescendantFonts \[(\d+) 0 R\]/.exec(type0.head)?.[1]),
		);
		expect(descendant?.head).toContain("/Subtype /CIDFontType2");
		expect(descendant?.head).toContain(
			"/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >>",
		);
		expect(descendant?.head).toContain("/CIDToGIDMap /Identity");
		expect(find(file, /\/Type \/Page\b/).head).toMatch(/\/Font << \/F1 \d+ 0 R >>/);
		expect(file.xrefValid).toBe(true);
	});

	test("embeds a renumbered subset with a tagged name that parses back", async () => {
		let file = await document(["Hello, World"]);
		let descriptor = find(file, /\/Type \/FontDescriptor/);
		expect(descriptor.head).toMatch(/\/FontName \/[A-Z]{6}\+Inter-Regular/);
		expect(find(file, /\/Subtype \/Type0/).head).toMatch(/\/BaseFont \/[A-Z]{6}\+Inter-Regular/);
		let fontFile = follow(file, descriptor, "FontFile2");
		let length1 = Number(/\/Length1 (\d+)/.exec(fontFile.head)?.[1]);
		let bytes = await inflate(fontFile.stream ?? new Uint8Array());
		expect(bytes.length).toBe(length1);
		expect(length1).toBeLessThan(INTER.length / 10);

		let subset = unwrap(parseFont(bytes));
		let original = unwrap(parseFont(INTER));
		let [content = ""] = await pageContents(file);
		let ids = shownIds(content);
		expect(ids).toHaveLength("Hello, World".length);
		for (let [index, character] of Array.from("Hello, World").entries()) {
			let glyph = original.glyphIndex(character.codePointAt(0) ?? 0);
			expect(subset.advance(ids[index] ?? 0)).toBe(original.advance(glyph));
		}
	});

	test("fills the descriptor from the font's metrics in glyph space", async () => {
		let file = await document(["x"]);
		let head = find(file, /\/Type \/FontDescriptor/).head;
		let font = unwrap(parseFont(INTER));
		let scale = 1000 / font.unitsPerEm;
		expect(head).toContain("/Flags 32");
		expect(head).toContain(`/Ascent ${Math.round(font.ascender * scale)}`);
		expect(head).toContain(`/Descent ${Math.round(font.descender * scale)}`);
		expect(head).toContain(`/CapHeight ${Math.round((font.capHeight ?? 0) * scale)}`);
		expect(head).toContain(`/XHeight ${Math.round((font.xHeight ?? 0) * scale)}`);
		expect(head).toContain("/ItalicAngle 0");
		expect(head).toContain("/StemV 43");
		expect(head).toMatch(/\/FontBBox \[-?\d+ -?\d+ -?\d+ -?\d+\]/);
	});

	test("writes the advance of every glyph shown in the W array", async () => {
		let file = await document(["Wave"]);
		let descendant = find(file, /\/Subtype \/CIDFontType2/);
		let font = unwrap(parseFont(INTER));
		let [content = ""] = await pageContents(file);
		let ids = shownIds(content);
		let widths = /\/W \[(\d+) \[([\d ]+)\]\]/.exec(descendant.head);
		let first = Number(widths?.[1]);
		let values = (widths?.[2] ?? "").split(" ").map(Number);
		for (let [index, character] of Array.from("Wave").entries()) {
			let advance = font.advance(font.glyphIndex(character.codePointAt(0) ?? 0));
			expect(values[(ids[index] ?? 0) - first]).toBe(
				Math.round((advance * 1000) / font.unitsPerEm),
			);
		}
	});

	test("maps every glyph back to the text it was drawn for", async () => {
		let file = await document(["Café ±", "naïve — €5"]);
		let type0 = find(file, /\/Subtype \/Type0/);
		let cmap = latin1(await inflate(follow(file, type0, "ToUnicode").stream ?? new Uint8Array()));
		expect(cmap).toContain("1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange");
		let map = bfchars(cmap);
		let [content = ""] = await pageContents(file);
		let text = shownIds(content)
			.map((id) => map.get(id) ?? "?")
			.join("");
		expect(text).toBe("Café ±naïve — €5");
	});

	test("writes the whole file under its own ids when the license forbids subsetting", async () => {
		let pdf = new PDF();
		let font = unwrap(pdf.font(withFsType(0x0100)));
		pdf.page().text("Hi", { x: 0, y: 0, font, size: 10 });
		let file = inspect(await pdf.bytes());
		let descriptor = find(file, /\/Type \/FontDescriptor/);
		expect(descriptor.head).toContain("/FontName /Inter-Regular");
		expect(follow(file, descriptor, "FontFile2").head).toContain(`/Length1 ${INTER.length}`);
		let [content = ""] = await pageContents(file);
		let parsed = unwrap(parseFont(INTER));
		expect(shownIds(content)).toEqual([parsed.glyphIndex(72), parsed.glyphIndex(105)]);
	});

	test("writes the same bytes for the same calls", async () => {
		let draw = async () => {
			let pdf = new PDF();
			let font = unwrap(pdf.font(INTER));
			pdf.page().text("Same bytes", { x: 10, y: 10, font, size: 14 });
			return pdf.bytes();
		};
		expect(await draw()).toEqual(await draw());
	});

	test("refuses a font whose license restricts embedding", () => {
		let result = new PDF().font(withFsType(0x0002));
		expect(isFailure(result) && result.error.code).toBe("restricted-font");
	});

	test("refuses a font that allows embedding its bitmaps only", () => {
		let result = new PDF().font(withFsType(0x0200));
		expect(isFailure(result) && result.error.code).toBe("restricted-font");
	});

	test("accepts a preview-and-print font", () => {
		expect(isSuccess(new PDF().font(withFsType(0x0004)))).toBe(true);
	});

	test("refuses bytes that are not a font", () => {
		let result = new PDF().font(new Uint8Array([1, 2, 3, 4]));
		expect(isFailure(result) && result.error.code).toBe("invalid-font");
	});
});
