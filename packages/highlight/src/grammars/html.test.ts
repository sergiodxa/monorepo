/**
 * Tests the markup grammar: tags and their attributes, the declarations a
 * document opens with, and the two bodies written in another language.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer";

import { html } from "./html";

describe("html", () => {
	test("covers a document exactly", () => {
		let code =
			'<form method="POST" action="/users/123">\n  <input type="hidden" name="_method" value="DELETE" />\n</form>\n';
		let tokens = scan(code, html);

		expect(tokens.map((token) => token.value).join("")).toBe(code);

		expect(tokens).toEqual([
			{ type: "punctuation", value: "<" },
			{ type: "tag", value: "form" },
			{ type: "plain", value: " " },
			{ type: "attr-name", value: "method" },
			{ type: "operator", value: "=" },
			{ type: "attr-value", value: '"POST"' },
			{ type: "plain", value: " " },
			{ type: "attr-name", value: "action" },
			{ type: "operator", value: "=" },
			{ type: "attr-value", value: '"/users/123"' },
			{ type: "punctuation", value: ">" },
			{ type: "plain", value: "\n  " },
			{ type: "punctuation", value: "<" },
			{ type: "tag", value: "input" },
			{ type: "plain", value: " " },
			{ type: "attr-name", value: "type" },
			{ type: "operator", value: "=" },
			{ type: "attr-value", value: '"hidden"' },
			{ type: "plain", value: " " },
			{ type: "attr-name", value: "name" },
			{ type: "operator", value: "=" },
			{ type: "attr-value", value: '"_method"' },
			{ type: "plain", value: " " },
			{ type: "attr-name", value: "value" },
			{ type: "operator", value: "=" },
			{ type: "attr-value", value: '"DELETE"' },
			{ type: "plain", value: " " },
			{ type: "punctuation", value: "/>" },
			{ type: "plain", value: "\n" },
			{ type: "punctuation", value: "</" },
			{ type: "tag", value: "form" },
			{ type: "punctuation", value: ">" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("paints a tag whose element no list could name", () => {
		let tokens = scan("<my-element data-n=3></my-element>", html);

		expect(tokens.filter((token) => token.type === "tag")).toEqual([
			{ type: "tag", value: "my-element" },
			{ type: "tag", value: "my-element" },
		]);

		expect(tokens).toContainEqual({ type: "attr-name", value: "data-n" });
		expect(tokens).toContainEqual({ type: "attr-value", value: "3" });
	});

	test("paints a doctype, a comment, and an entity", () => {
		let tokens = scan("<!DOCTYPE html>\n<!-- a -- b -->\n<p>Blog &amp; more &#169;</p>\n", html);

		expect(tokens).toContainEqual({ type: "keyword", value: "<!DOCTYPE html>" });
		expect(tokens).toContainEqual({ type: "comment", value: "<!-- a -- b -->" });
		expect(tokens).toContainEqual({ type: "constant", value: "&amp;" });
		expect(tokens).toContainEqual({ type: "constant", value: "&#169;" });
	});

	test("paints an XML prolog, a namespaced name, and a CDATA section", () => {
		let code =
			'<?xml version="1.0"?>\n<rss:channel xml:lang="en">\n\t<![CDATA[<p>hi</p>]]>\n</rss:channel>\n';
		let tokens = scan(code, html);

		expect(tokens.map((token) => token.value).join("")).toBe(code);

		expect(tokens).toContainEqual({ type: "keyword", value: '<?xml version="1.0"?>' });
		expect(tokens).toContainEqual({ type: "tag", value: "rss:channel" });
		expect(tokens).toContainEqual({ type: "attr-name", value: "xml:lang" });
		expect(tokens).toContainEqual({ type: "comment", value: "<![CDATA[<p>hi</p>]]>" });
	});

	test("highlights a style body as CSS, and returns to markup after it", () => {
		let code = '<style>\n\t.a {\n\t\tcolor: var(--brand);\n\t}\n</style>\n<div class="a"></div>\n';
		let tokens = scan(code, html);

		expect(tokens.map((token) => token.value).join("")).toBe(code);

		expect(tokens).toContainEqual({ type: "tag", value: ".a" });
		expect(tokens).toContainEqual({ type: "property", value: "color" });
		expect(tokens).toContainEqual({ type: "property", value: "--brand" });

		expect(tokens.slice(-10)).toEqual([
			{ type: "punctuation", value: "<" },
			{ type: "tag", value: "div" },
			{ type: "plain", value: " " },
			{ type: "attr-name", value: "class" },
			{ type: "operator", value: "=" },
			{ type: "attr-value", value: '"a"' },
			{ type: "punctuation", value: "></" },
			{ type: "tag", value: "div" },
			{ type: "punctuation", value: ">" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("highlights a script body as JavaScript, and returns to markup after it", () => {
		let code = '<script type="module">\n\tlet x = `a${b}`;\n</script>\n<p>after</p>\n';
		let tokens = scan(code, html);

		expect(tokens.map((token) => token.value).join("")).toBe(code);

		expect(tokens).toContainEqual({ type: "attr-value", value: '"module"' });
		expect(tokens).toContainEqual({ type: "keyword", value: "let" });
		expect(tokens).toContainEqual({ type: "punctuation", value: "${" });

		expect(tokens.slice(-8)).toEqual([
			{ type: "punctuation", value: "<" },
			{ type: "tag", value: "p" },
			{ type: "punctuation", value: ">" },
			{ type: "plain", value: "after" },
			{ type: "punctuation", value: "</" },
			{ type: "tag", value: "p" },
			{ type: "punctuation", value: ">" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("leaves a style element that has no body in markup", () => {
		let tokens = scan("<style/><p>plain</p>", html);

		expect(tokens.filter((token) => token.type === "tag")).toEqual([
			{ type: "tag", value: "style" },
			{ type: "tag", value: "p" },
			{ type: "tag", value: "p" },
		]);
	});

	test("paints an attribute list written across several lines", () => {
		let tokens = scan('<link\n\trel="alternate"\n\ttype="application/rss+xml"\n/>\n', html);

		expect(tokens).toContainEqual({ type: "attr-name", value: "rel" });
		expect(tokens).toContainEqual({ type: "attr-value", value: '"application/rss+xml"' });
		expect(tokens).toContainEqual({ type: "punctuation", value: "/>" });
	});
});
