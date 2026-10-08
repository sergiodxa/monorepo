/**
 * Checks the raw HTML allowlist end to end: which elements and attributes a document
 * may opt into, where an allowlisted element reads as a block and where as inline
 * content, the URLs it refuses, and how every writer turns one back out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { toHTML } from "../html/index.js";
import { Markdown } from "../index.js";
import { toPlainText } from "../plain/index.js";
import { variables } from "../plugin/variables.js";
import { toRemix } from "../remix/index.js";

/** The allowlist most cases parse with: a disclosure, phrasing marks, a link, and two voids. */
const OPTIONS = {
	html: {
		details: ["open"],
		summary: [],
		div: ["class"],
		sup: [],
		kbd: [],
		a: ["href", "title"],
		br: [],
		img: ["src", "alt", "width"],
		hr: [],
	},
} satisfies Markdown.Options;

/**
 * @param source - The markdown to read
 * @param options - The allowlist to read it with
 * @returns The parsed document, failing the test when the parser rejected it
 */
function parse(source: string, options: Markdown.Options = OPTIONS): Markdown.Document {
	return unwrap(Markdown.parse(source, options)).document;
}

/**
 * @param source - The markdown the parser is expected to reject
 * @returns The failure it reported
 */
function failure(source: string): Markdown.ParseError {
	let result = Markdown.parse(source, OPTIONS);
	if (!isFailure(result)) throw new Error(`Expected ${JSON.stringify(source)} to fail`);
	return result.error;
}

describe("parsing", () => {
	test("an element left off the allowlist stays raw HTML", () => {
		let [html] = parse("<section>\n\nText\n\n</section>").children;

		expect(html).toMatchObject({ type: "html" });
	});

	test("with no allowlist every element stays raw HTML", () => {
		let [paragraph] = parse("x<sup>2</sup>", {}).children;

		expect(paragraph).toMatchObject({
			children: [
				{ type: "text" },
				{ type: "inlineHtml" },
				{ type: "text" },
				{ type: "inlineHtml" },
			],
		});
	});

	test("a block element holds markdown blocks, a one-line child included", () => {
		let [details] = parse(
			"<details open>\n<summary>More **info**</summary>\n\nBody _here_.\n</details>",
		).children;

		expect(details).toMatchObject({
			type: "element",
			name: "details",
			attributes: { open: true },
			children: [
				{
					type: "element",
					name: "summary",
					children: [{ type: "text", value: "More " }, { type: "strong" }],
				},
				{ type: "paragraph", children: [{ type: "text" }, { type: "emphasis" }, { type: "text" }] },
			],
		});
	});

	test("a block element written on one line holds its text as inline content", () => {
		let [div] = parse('<div class="lead">Hello *there*</div>').children;

		expect(div).toMatchObject({
			type: "element",
			name: "div",
			attributes: { class: "lead" },
			children: [{ type: "text", value: "Hello " }, { type: "emphasis" }],
		});
	});

	test("a phrasing element is inline, even when it opens a line", () => {
		let [first, second] = parse("x<sup>2</sup> and more\n\n<kbd>Cmd</kbd> opens search").children;

		expect(first).toMatchObject({
			type: "paragraph",
			children: [
				{ type: "text", value: "x" },
				{ type: "element", name: "sup", children: [{ type: "text", value: "2" }] },
				{ type: "text", value: " and more" },
			],
		});
		expect(second).toMatchObject({
			type: "paragraph",
			children: [{ type: "element", name: "kbd" }, { type: "text" }],
		});
	});

	test("a void element needs no closing slash", () => {
		let [paragraph, rule] = parse('line<br>next <img src="/a.png" alt="A">\n\n<hr>').children;

		expect(paragraph).toMatchObject({
			children: [
				{ type: "text", value: "line" },
				{ type: "element", name: "br", children: [] },
				{ type: "text", value: "next " },
				{ type: "element", name: "img", attributes: { src: "/a.png", alt: "A" } },
			],
		});
		expect(rule).toMatchObject({ type: "element", name: "hr", children: [] });
	});

	test("a void element written alone on a line is still inline", () => {
		let [paragraph] = parse("<br>").children;

		expect(paragraph).toMatchObject({
			type: "paragraph",
			children: [{ type: "element", name: "br" }],
		});
	});

	test("an attribute left off the element's allowlist is a failure at the opening tag", () => {
		let error = failure('Text\n\n<details style="color: red">\nBody\n</details>');

		expect(error.message).toBe('<details> does not allow the "style" attribute');
		expect(error.position?.start.line).toBe(3);
	});

	test("an event handler attribute is refused even when allowlisted", () => {
		let result = Markdown.parse('<a href="/x" onclick="steal()">x</a>', {
			html: { a: ["href", "onclick"] },
		});

		expect(isFailure(result) && result.error.message).toBe(
			'<a> does not allow the "onclick" attribute',
		);
	});

	test("a URL attribute refuses a script scheme", () => {
		let error = failure('<a href="javascript:alert(1)">x</a>');

		expect(error.message).toBe('<a> refuses "javascript:alert(1)" as its href');
	});

	test("a URL attribute takes relative, http, https, mailto and tel URLs", () => {
		let [paragraph] = parse(
			'<a href="/docs">a</a><a href="https://x.com">b</a><a href="mailto:a@b.com">c</a><a href="#top">d</a>',
		).children;

		expect(paragraph).toMatchObject({
			children: [
				{ type: "element" },
				{ type: "element" },
				{ type: "element" },
				{ type: "element" },
			],
		});
	});

	test("an element's attribute may hold a variable", () => {
		let [paragraph] = parse('<a href={$url} title="Docs">docs</a>').children;

		expect(paragraph).toMatchObject({
			children: [{ type: "element", attributes: { href: { type: "variable", name: "url" } } }],
		});
	});

	test("a registered tag of the same name wins over the allowlist", () => {
		let [tag] = parse("<kbd>K</kbd>", {
			tags: { kbd: { content: "inline" } },
			html: { kbd: [] },
		}).children;

		expect(tag).toMatchObject({ type: "tag", name: "kbd" });
	});
});

describe("the variables plugin", () => {
	test("fills an element's attribute and checks the URL it was filled with", () => {
		let document = parse('<a href={$url} title="Docs">docs</a>');

		let filled = Markdown.walk(document, variables({ url: "/docs" }, OPTIONS));
		expect(unwrap(filled).children[0]).toMatchObject({
			children: [{ type: "element", attributes: { href: "/docs" } }],
		});

		let refused = Markdown.walk(document, variables({ url: "javascript:alert(1)" }, OPTIONS));
		if (!isFailure(refused)) throw new Error("Expected the walk to fail");
		expect((refused.error.cause as Error).message).toBe(
			'<a> refuses "javascript:alert(1)" as its href',
		);
	});
});

describe("writing", () => {
	test("stringify writes elements back in the same places", () => {
		let source =
			'<details open>\n<summary>More</summary>\n\nBody.\n</details>\n\nx<sup>2</sup> line<br /> <a href="/d">d</a>\n\n<hr />\n';

		expect(unwrap(Markdown.stringify(parse(source)))).toBe(source);
	});

	test("toHTML renders allowlisted elements as elements", () => {
		let html = toHTML(
			parse(
				'<details open>\n<summary>More</summary>\n\nBody.\n</details>\n\nx<sup>2</sup><br><a href="/d" title="D">d</a>',
			),
		);

		expect(html).toBe(
			'<details open><summary>More</summary>\n<p>Body.</p></details>\n<p>x<sup>2</sup><br /><a href="/d" title="D">d</a></p>',
		);
	});

	test("toHTML writes XHTML booleans in the XHTML syntax", () => {
		let html = toHTML(parse("<details open>\nBody.\n</details>"), { syntax: "xhtml" });

		expect(html).toBe('<details open="open"><p>Body.</p></details>');
	});

	test("toHTML drops a script URL a hand-built tree carries", () => {
		let position = parse("x").position;
		let html = toHTML({
			type: "element",
			name: "a",
			attributes: { href: "javascript:alert(1)" },
			children: [{ type: "text", value: "x", position }],
			position,
		});

		expect(html).toBe("<a>x</a>");
	});

	test("toRemix renders allowlisted elements as elements", async () => {
		let html = await renderToString(toRemix(parse('x<sup>2</sup> <a href="/d">d</a>')));

		expect(html).toContain("x<sup>2</sup>");
		expect(html).toContain('<a href="/d">d</a>');
	});

	test("toPlainText reads an element's text", () => {
		expect(toPlainText(parse("x<sup>2</sup>"))).toBe("x2");
	});
});
