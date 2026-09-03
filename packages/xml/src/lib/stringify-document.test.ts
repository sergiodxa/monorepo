/**
 * Tests serialization of plain XML document data into strings, pinning escaping,
 * self-closing form and attribute order, plus the trees a caller receives back as
 * an error because valid XML cannot express them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { XML } from "../index.js";

import { stringifyDocument } from "./stringify-document.js";

/**
 * Serializes a document the test expects to succeed and returns the XML text.
 */
function stringifyRoot(root: XML.Element) {
	let result = stringifyDocument({ root });
	if (isFailure(result)) throw result.error;
	return result.data;
}

/**
 * Serializes a document the test expects to fail and returns the error message.
 */
function stringifyError(root: XML.Element) {
	let result = stringifyDocument({ root });
	if (isSuccess(result)) throw new Error(`Expected a failure, produced ${result.data}`);
	return result.error.message;
}

describe("stringifyDocument", () => {
	test("serializes document data with declaration and namespaces", () => {
		let result = stringifyDocument({
			declaration: { version: "1.0", encoding: "UTF-8" },
			root: {
				name: "rss",
				attributes: {
					version: "2.0",
					"xmlns:atom": "http://www.w3.org/2005/Atom",
				},
				children: [
					{
						name: "channel",
						attributes: {},
						children: [
							{ name: "title", attributes: {}, children: ["Feed"] },
							{
								name: "atom:link",
								attributes: {
									href: "https://example.com/feed.xml",
									rel: "self",
									type: "application/rss+xml",
								},
								children: [],
							},
						],
					},
				],
			},
		});

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(result.data).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
			expect(result.data).toContain("<title>Feed</title>");
		}
	});

	test("writes the declaration on its own line ahead of the root", () => {
		let result = stringifyDocument({
			declaration: { version: "1.1", encoding: "utf-8", standalone: "yes" },
			root: { name: "r", attributes: {}, children: [] },
		});

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data).toBe(`<?xml version="1.1" encoding="utf-8" standalone="yes"?>\n<r/>`);
		}
	});

	test("defaults the declaration version when only other attributes are given", () => {
		let result = stringifyDocument({
			declaration: { encoding: "UTF-8" },
			root: { name: "r", attributes: {}, children: [] },
		});

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toContain(`<?xml version="1.0" encoding="UTF-8"?>`);
	});

	test("omits the declaration when the document has none", () => {
		expect(stringifyRoot({ name: "r", attributes: {}, children: [] })).toBe("<r/>");
	});
});

describe("stringifyDocument elements", () => {
	test("self-closes an element with no children", () => {
		expect(stringifyRoot({ name: "r", attributes: {}, children: [] })).toBe("<r/>");
	});

	test("writes a full pair for an element holding empty text", () => {
		expect(stringifyRoot({ name: "r", attributes: {}, children: [""] })).toBe("<r></r>");
	});

	test("treats missing attributes and children as empty", () => {
		expect(stringifyRoot({ name: "r" })).toBe("<r/>");
	});

	test("keeps attributes in the order they were declared", () => {
		let root: XML.Element = { name: "r", attributes: { b: "2", a: "1" }, children: [] };

		expect(stringifyRoot(root)).toBe(`<r b="2" a="1"/>`);
	});

	test("nests children in order", () => {
		let root: XML.Element = {
			name: "r",
			attributes: {},
			children: ["before", { name: "b", attributes: {}, children: ["bold"] }, "after"],
		};

		expect(stringifyRoot(root)).toBe("<r>before<b>bold</b>after</r>");
	});
});

describe("stringifyDocument escaping", () => {
	test("escapes the markup delimiters in text", () => {
		let root: XML.Element = { name: "r", attributes: {}, children: ["a & b < c > d"] };

		expect(stringifyRoot(root)).toBe("<r>a &amp; b &lt; c &gt; d</r>");
	});

	test("escapes quotes and line breaks in attribute values", () => {
		let root: XML.Element = { name: "r", attributes: { a: `x"y<z>&\nw` }, children: [] };

		expect(stringifyRoot(root)).toBe(`<r a="x&quot;y&lt;z&gt;&amp;&#10;w"/>`);
	});
});

describe("stringifyDocument namespaces", () => {
	test("accepts a prefix an ancestor declared", () => {
		let root: XML.Element = {
			name: "r",
			attributes: { "xmlns:a": "http://1" },
			children: [
				{ name: "c", attributes: {}, children: [{ name: "a:d", attributes: {}, children: [] }] },
			],
		};

		expect(stringifyRoot(root)).toBe(`<r xmlns:a="http://1"><c><a:d/></c></r>`);
	});

	test("accepts a prefix the element declares on itself", () => {
		let root: XML.Element = {
			name: "r",
			attributes: {},
			children: [{ name: "a:d", attributes: { "xmlns:a": "http://1" }, children: [] }],
		};

		expect(stringifyRoot(root)).toBe(`<r><a:d xmlns:a="http://1"/></r>`);
	});

	test("accepts the built-in `xml` prefix without a declaration", () => {
		expect(stringifyRoot({ name: "r", attributes: { "xml:lang": "en" }, children: [] })).toBe(
			`<r xml:lang="en"/>`,
		);
	});

	test("writes a default namespace declaration through to children", () => {
		let root: XML.Element = {
			name: "r",
			attributes: { xmlns: "http://x" },
			children: [{ name: "c", attributes: {}, children: [] }],
		};

		expect(stringifyRoot(root)).toBe(`<r xmlns="http://x"><c/></r>`);
	});

	test("returns a failure when a namespace prefix is missing", () => {
		let root: XML.Element = {
			name: "rss",
			attributes: {},
			children: [{ name: "atom:link", attributes: {}, children: [] }],
		};

		expect(stringifyError(root)).toContain("Missing namespace declaration");
	});

	test("names the element carrying an undeclared prefix", () => {
		let root: XML.Element = {
			name: "rss",
			attributes: {},
			children: [{ name: "atom:link", attributes: {}, children: [] }],
		};

		expect(stringifyError(root)).toBe(
			`Missing namespace declaration for prefix "atom" on element "atom:link".`,
		);
	});

	test("names the attribute carrying an undeclared prefix", () => {
		expect(stringifyError({ name: "r", attributes: { "foo:bar": "v" }, children: [] })).toBe(
			`Missing namespace declaration for prefix "foo" on attribute "foo:bar".`,
		);
	});
});

describe("stringifyDocument names", () => {
	test("fails on a root name that is not an XML name", () => {
		expect(stringifyError({ name: "1bad", attributes: {}, children: [] })).toBe(
			`Invalid root element name "1bad".`,
		);
		expect(stringifyError({ name: "a b", attributes: {}, children: [] })).toBe(
			`Invalid root element name "a b".`,
		);
	});

	test("fails on a child name that is not an XML name", () => {
		let root: XML.Element = {
			name: "r",
			attributes: {},
			children: [{ name: "1bad", attributes: {}, children: [] }],
		};

		expect(stringifyError(root)).toBe(`Invalid element name "1bad".`);
	});

	test("fails on an attribute name that is not an XML name", () => {
		expect(stringifyError({ name: "r", attributes: { "1bad": "v" }, children: [] })).toBe(
			`Invalid attribute name "1bad".`,
		);
	});
});
