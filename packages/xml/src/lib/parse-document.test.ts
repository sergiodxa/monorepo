/**
 * Tests for parsing XML documents into plain document data, pinning the subset a
 * feed can rely on: text, CDATA, references, prefixed names, skipped constructs,
 * and the malformed inputs a caller receives back as an error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@pkg/result";
import { describe, expect, test } from "vitest";

import { parseDocument } from "./parse-document";

/**
 * Parses a source that the test expects to succeed and returns its root element.
 */
function parseRoot(source: string) {
	let result = parseDocument(source);
	if (isFailure(result)) throw result.error;
	return result.data.root;
}

/**
 * Parses a source that the test expects to fail and returns the error message.
 */
function parseError(source: string) {
	let result = parseDocument(source);
	if (isSuccess(result))
		throw new Error(`Expected a failure, parsed ${JSON.stringify(result.data)}`);
	return result.error.message;
}

describe("parseDocument", () => {
	test("parses RSS-like XML into plain document data", () => {
		let result = parseDocument(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
	<channel>
		<title>Feed</title>
		<item>
			<description><![CDATA[Hello <strong>world</strong>]]></description>
			<content:encoded><![CDATA[<p>Markup</p>]]></content:encoded>
		</item>
	</channel>
</rss>`);

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data).toEqual({
				declaration: { version: "1.0", encoding: "UTF-8" },
				root: {
					name: "rss",
					attributes: {
						version: "2.0",
						"xmlns:content": "http://purl.org/rss/1.0/modules/content/",
					},
					children: [
						{
							name: "channel",
							attributes: {},
							children: [
								{ name: "title", attributes: {}, children: ["Feed"] },
								{
									name: "item",
									attributes: {},
									children: [
										{
											name: "description",
											attributes: {},
											children: ["Hello <strong>world</strong>"],
										},
										{
											name: "content:encoded",
											attributes: {},
											children: ["<p>Markup</p>"],
										},
									],
								},
							],
						},
					],
				},
			});
		}
	});

	test("reads every declaration attribute", () => {
		let result = parseDocument(`<?xml version="1.1" encoding="utf-8" standalone="yes"?><r/>`);

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.declaration).toEqual({
				version: "1.1",
				encoding: "utf-8",
				standalone: "yes",
			});
		}
	});

	test("omits the declaration when the document has none", () => {
		let result = parseDocument("<r/>");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.declaration).toBeUndefined();
	});
});

describe("parseDocument text", () => {
	test("drops text that is only indentation", () => {
		expect(parseRoot("<r>\n\t<t>x</t>\n</r>")).toEqual({
			name: "r",
			attributes: {},
			children: [{ name: "t", attributes: {}, children: ["x"] }],
		});
	});

	test("keeps space that surrounds real content", () => {
		expect(parseRoot("<r><t> spaced </t></r>").children).toEqual([
			{ name: "t", attributes: {}, children: [" spaced "] },
		]);
	});

	test("drops a reference that decodes to whitespace alone", () => {
		expect(parseRoot("<r><t>&#32;</t></r>").children).toEqual([
			{ name: "t", attributes: {}, children: [] },
		]);
	});

	test("keeps text and elements interleaved in source order", () => {
		expect(parseRoot("<r><t>before<b>bold</b>after</t></r>").children).toEqual([
			{
				name: "t",
				attributes: {},
				children: ["before", { name: "b", attributes: {}, children: ["bold"] }, "after"],
			},
		]);
	});

	test("keeps a raw CDATA terminator in text", () => {
		expect(parseRoot("<r><t>a]]>b</t></r>").children).toEqual([
			{ name: "t", attributes: {}, children: ["a]]>b"] },
		]);
	});
});

describe("parseDocument CDATA", () => {
	test("takes CDATA content verbatim", () => {
		expect(parseRoot("<r><t><![CDATA[a ]] b]]></t></r>").children).toEqual([
			{ name: "t", attributes: {}, children: ["a ]] b"] },
		]);
	});

	test("keeps CDATA as its own node beside adjacent text", () => {
		expect(parseRoot("<r><t>before<![CDATA[mid]]>after</t></r>").children).toEqual([
			{ name: "t", attributes: {}, children: ["before", "mid", "after"] },
		]);
	});

	test("drops CDATA holding only whitespace", () => {
		expect(parseRoot("<r><t>a<![CDATA[   ]]>b</t></r>").children).toEqual([
			{ name: "t", attributes: {}, children: ["a", "b"] },
		]);
	});

	test("fails on an unterminated CDATA section", () => {
		expect(parseError("<r><![CDATA[open</r>")).toBe("Unterminated CDATA section");
	});
});

describe("parseDocument references", () => {
	test("resolves references in text and attributes", () => {
		expect(parseRoot(`<r><t a="x &amp; y &#65;">a &lt; b</t></r>`).children).toEqual([
			{ name: "t", attributes: { a: "x & y A" }, children: ["a < b"] },
		]);
	});

	test("keeps an ampersand that starts no reference", () => {
		expect(parseRoot("<r><t>a & b</t></r>").children).toEqual([
			{ name: "t", attributes: {}, children: ["a & b"] },
		]);
	});

	test("fails on an entity the document never declares", () => {
		expect(parseError("<r><t>caf&eacute;</t></r>")).toBe("entity not found:&eacute;");
	});
});

describe("parseDocument attributes", () => {
	test("accepts either quote style and spacing around the equals sign", () => {
		expect(parseRoot(`<r a='v' b = "w"/>`).attributes).toEqual({ a: "v", b: "w" });
	});

	test("keeps an empty value and a bare `>` inside a value", () => {
		expect(parseRoot(`<r a="" b="a>b"/>`).attributes).toEqual({ a: "", b: "a>b" });
	});

	test("collapses literal whitespace but keeps it when written as a reference", () => {
		expect(parseRoot(`<r a="one\ntwo" b="one&#10;two"/>`).attributes).toEqual({
			a: "one two",
			b: "one\ntwo",
		});
	});

	test("fails on an unquoted value", () => {
		expect(parseError("<r a=v/>")).toBe(`attribute "a" missed quot(")!`);
	});

	test("fails on a repeated attribute", () => {
		expect(parseError(`<r a="1" a="2"/>`)).toBe("Attribute a redefined");
	});
});

describe("parseDocument ignorable constructs", () => {
	test("skips comments, processing instructions and the doctype", () => {
		let source = `<!DOCTYPE rss><r><!-- note --><?php echo 1; ?><t>x</t></r>`;

		expect(parseRoot(source)).toEqual({
			name: "r",
			attributes: {},
			children: [{ name: "t", attributes: {}, children: ["x"] }],
		});
	});

	test("skips a doctype whose internal subset contains a closing bracket", () => {
		let source = `<!DOCTYPE r [<!ENTITY x "y">]><r><t>x</t></r>`;

		expect(parseRoot(source).children).toEqual([{ name: "t", attributes: {}, children: ["x"] }]);
	});

	test("fails on an unterminated comment", () => {
		expect(parseError("<r><!-- open</r>")).toBe("Unterminated comment");
	});
});

describe("parseDocument names", () => {
	test("preserves case, prefixes, dots and dashes", () => {
		let root = parseRoot(`<r><lastBuildDate>x</lastBuildDate><a.b-c/><ns:d/></r>`);

		expect(root.children?.map((child) => (typeof child === "string" ? child : child.name))).toEqual(
			["lastBuildDate", "a.b-c", "ns:d"],
		);
	});

	test("accepts a non-ASCII element name", () => {
		expect(parseRoot("<r><café>x</café></r>").children).toEqual([
			{ name: "café", attributes: {}, children: ["x"] },
		]);
	});
});

describe("parseDocument failures", () => {
	test("returns a failure for malformed XML", () => {
		expect(parseError("<rss><channel></rss>")).toContain("Opening and ending tag mismatch");
	});

	test("names both tags when a closing tag does not match", () => {
		expect(parseError("<rss><channel></rss>")).toBe(
			`Opening and ending tag mismatch: "channel" != "rss"`,
		);
	});

	test("fails when a tag is left open", () => {
		expect(parseError("<r><t>x</t>")).toBe("unclosed xml tag(s): r");
	});

	test("fails when the document has no element", () => {
		expect(parseError("   ")).toBe("missing root element");
		expect(parseError("")).toBe("missing root element");
		expect(parseError(`<?xml version="1.0"?>`)).toBe("missing root element");
	});

	test("fails on text before the root element", () => {
		expect(parseError("hello<a/>")).toBe("Unexpected content outside root element: 'hello'");
	});

	test("fails on content after the root element", () => {
		expect(parseError("<r><t>x</t></r>trailing")).toBe("Extra content at the end of the document");
		expect(parseError("<a/><b/>")).toBe("Extra content at the end of the document");
	});

	test("allows whitespace around the root element", () => {
		expect(parseRoot("\n <r><t>x</t></r>\n  ").name).toBe("r");
	});
});
