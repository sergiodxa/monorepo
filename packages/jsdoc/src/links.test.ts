/**
 * Tests for the inline link reader, including the offsets a renderer substitutes
 * at and the label forms JSDoc accepts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { inlineLinks } from "./links.js";

describe("inlineLinks", () => {
	test("reads a bare target", () => {
		expect(inlineLinks("See {@link parseComment}.")).toEqual([
			{ raw: "{@link parseComment}", target: "parseComment", text: null, index: 4 },
		]);
	});

	test("reads both label separators", () => {
		let links = inlineLinks("{@link parse|the parser} and {@link parse the parser}");

		expect(links.map((link) => link.text)).toEqual(["the parser", "the parser"]);
	});

	test("reads the code and plain variants", () => {
		let links = inlineLinks("{@linkcode extract} {@linkplain https://example.com Docs}");

		expect(links.map((link) => link.target)).toEqual(["extract", "https://example.com"]);
	});

	test("reports offsets that address the raw text", () => {
		let text = "Prefix {@link extract} suffix";
		let [link] = inlineLinks(text);

		expect(text.slice(link?.index, (link?.index ?? 0) + (link?.raw.length ?? 0))).toBe(link?.raw);
	});

	test("returns nothing for text without links", () => {
		expect(inlineLinks("Plain prose.")).toEqual([]);
	});
});
