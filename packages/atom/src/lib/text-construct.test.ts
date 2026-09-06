/**
 * Tests the three text construct types, including the XHTML case where the value
 * is the markup inside a wrapper the reader never sees.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildTextElement, parseText } from "./text-construct.js";

describe("parseText", () => {
	test("collapses an untyped construct to a bare string", () => {
		expect(parseText({ name: "title", children: ["Plain"] })).toBe("Plain");
	});

	test("collapses an explicitly text-typed construct to a bare string", () => {
		expect(parseText({ name: "title", attributes: { type: "text" }, children: ["Plain"] })).toBe(
			"Plain",
		);
	});

	test("keeps the type on an html construct", () => {
		expect(
			parseText({ name: "title", attributes: { type: "html" }, children: ["<em>x</em>"] }),
		).toEqual({ value: "<em>x</em>", type: "html" });
	});

	test("serializes the children of an xhtml wrapper, dropping the wrapper", () => {
		let element = {
			name: "title",
			attributes: { type: "xhtml" },
			children: [
				{
					name: "div",
					attributes: { xmlns: "http://www.w3.org/1999/xhtml" },
					children: ["A ", { name: "em", attributes: {}, children: ["marked"] }, " title"],
				},
			],
		};

		expect(parseText(element)).toEqual({ value: "A <em>marked</em> title", type: "xhtml" });
	});

	test("escapes text an xhtml wrapper holds directly", () => {
		let element = {
			name: "summary",
			attributes: { type: "xhtml" },
			children: [
				{
					name: "div",
					attributes: { xmlns: "http://www.w3.org/1999/xhtml" },
					children: ["a & b < c"],
				},
			],
		};

		expect(parseText(element)).toEqual({ value: "a &amp; b &lt; c", type: "xhtml" });
	});

	test("reads an xhtml construct that omits its wrapper", () => {
		let element = {
			name: "summary",
			attributes: { type: "xhtml" },
			children: [{ name: "p", attributes: {}, children: ["Body"] }],
		};

		expect(parseText(element)).toEqual({ value: "<p>Body</p>", type: "xhtml" });
	});

	test("reads an empty construct as empty text", () => {
		expect(parseText({ name: "title", children: [] })).toBe("");
	});
});

describe("buildTextElement", () => {
	test("writes a bare string with no type attribute", () => {
		expect(buildTextElement("title", "Plain")).toEqual({
			name: "title",
			attributes: {},
			children: ["Plain"],
		});
	});

	test("omits the type attribute for the default type", () => {
		expect(buildTextElement("title", { value: "Plain", type: "text" })).toEqual({
			name: "title",
			attributes: {},
			children: ["Plain"],
		});
	});

	test("keeps an html construct's type", () => {
		expect(buildTextElement("title", { value: "<em>x</em>", type: "html" })).toEqual({
			name: "title",
			attributes: { type: "html" },
			children: ["<em>x</em>"],
		});
	});

	test("writes an xhtml construct as html, since its value is already markup", () => {
		expect(buildTextElement("title", { value: "<em>x</em>", type: "xhtml" })).toEqual({
			name: "title",
			attributes: { type: "html" },
			children: ["<em>x</em>"],
		});
	});
});
