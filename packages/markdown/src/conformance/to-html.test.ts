/**
 * The printer checked against trees built by hand, so the conformance suites
 * measure the parser rather than the device they compare through. Every case
 * states the HTML the specifications show beside the construct it covers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Markdown } from "../index.js";

import { toHTML } from "./to-html.js";

/** One position for every node, since the printer reads content and never a location. */
const POSITION: Markdown.Position = {
	start: { line: 1, column: 1, offset: 0 },
	end: { line: 1, column: 1, offset: 0 },
};

/** Wraps blocks as the root, which is what a parsed document hands the printer. */
function doc(...children: Markdown.Block[]): Markdown.Document {
	return { type: "document", children, position: POSITION };
}

function paragraph(...children: Markdown.Inline[]): Markdown.Paragraph {
	return { type: "paragraph", attributes: {}, children, position: POSITION };
}

function text(value: string): Markdown.Text {
	return { type: "text", value, position: POSITION };
}

function item(...children: Markdown.Block[]): Markdown.ListItem {
	return { type: "listItem", attributes: {}, children, position: POSITION };
}

/** A cell holding one run of text, which is all a table case needs to read. */
function cell(value: string): Markdown.TableCell {
	return { type: "tableCell", attributes: {}, children: [text(value)], position: POSITION };
}

function row(header: boolean, ...values: string[]): Markdown.TableRow {
	return {
		type: "tableRow",
		header,
		attributes: {},
		children: values.map(cell),
		position: POSITION,
	};
}

describe("text", () => {
	test("escapes the four characters HTML gives meaning to", () => {
		expect(toHTML(doc(paragraph(text(`a & b < c > d "e" f'g`))))).toBe(
			`<p>a &amp; b &lt; c &gt; d &quot;e&quot; f'g</p>\n`,
		);
	});

	test("prints a paragraph per block, each on its own line", () => {
		expect(toHTML(doc(paragraph(text("a")), paragraph(text("b"))))).toBe("<p>a</p>\n<p>b</p>\n");
	});

	test("prints a soft break as a newline and a hard break as a tag", () => {
		let soft = paragraph(text("a"), { type: "softBreak", position: POSITION }, text("b"));
		let hard = paragraph(text("a"), { type: "hardBreak", position: POSITION }, text("b"));

		expect(toHTML(doc(soft))).toBe("<p>a\nb</p>\n");
		expect(toHTML(doc(hard))).toBe("<p>a<br />\nb</p>\n");
	});
});

describe("blocks", () => {
	test("prints a heading at the level the source wrote", () => {
		let heading: Markdown.Heading = {
			type: "heading",
			level: 3,
			attributes: {},
			children: [text("Title")],
			position: POSITION,
		};

		expect(toHTML(doc(heading))).toBe("<h3>Title</h3>\n");
	});

	test("writes a block's annotation attributes, a bare key as an empty value", () => {
		let heading: Markdown.Heading = {
			type: "heading",
			level: 2,
			attributes: { id: "install", class: "lead", wide: true, level: 2, draft: false },
			children: [text("Installing")],
			position: POSITION,
		};

		expect(toHTML(doc(heading))).toBe(
			`<h2 id="install" class="lead" wide="" level="2">Installing</h2>\n`,
		);
	});

	test("opens a block quote on its own line", () => {
		let quote: Markdown.Blockquote = {
			type: "blockquote",
			attributes: {},
			children: [paragraph(text("quoted"))],
			position: POSITION,
		};

		expect(toHTML(doc(quote))).toBe("<blockquote>\n<p>quoted</p>\n</blockquote>\n");
	});

	test("names a fence's language as a class and escapes its content", () => {
		let code: Markdown.Code = {
			type: "code",
			language: "ts",
			content: 'let a = "<b>";\n',
			attributes: {},
			position: POSITION,
		};

		expect(toHTML(doc(code))).toBe(
			`<pre><code class="language-ts">let a = &quot;&lt;b&gt;&quot;;\n</code></pre>\n`,
		);
	});

	test("prints indented code, which carries no language, without a class", () => {
		let code: Markdown.Code = { type: "code", content: "a\n", attributes: {}, position: POSITION };

		expect(toHTML(doc(code))).toBe("<pre><code>a\n</code></pre>\n");
	});

	test("takes the first word of an info string as the class", () => {
		let code: Markdown.Code = {
			type: "code",
			language: "ruby startline=3",
			content: "a\n",
			attributes: {},
			position: POSITION,
		};

		expect(toHTML(doc(code))).toBe(`<pre><code class="language-ruby">a\n</code></pre>\n`);
	});

	test("closes a thematic break in the same tag", () => {
		expect(toHTML(doc({ type: "thematicBreak", attributes: {}, position: POSITION }))).toBe(
			"<hr />\n",
		);
	});

	test("prints a raw HTML block verbatim, as the specifications expect", () => {
		let html: Markdown.Html = {
			type: "html",
			value: "<div>\n<b>&raw</b>\n</div>",
			attributes: {},
			position: POSITION,
		};

		expect(toHTML(doc(html))).toBe("<div>\n<b>&raw</b>\n</div>\n");
	});

	test("prints inline raw HTML verbatim inside its paragraph", () => {
		let inline: Markdown.InlineHtml = { type: "inlineHtml", value: "<b>", position: POSITION };

		expect(toHTML(doc(paragraph(text("a"), inline, text("b"))))).toBe("<p>a<b>b</p>\n");
	});
});

describe("lists", () => {
	test("unwraps the paragraphs of a tight list", () => {
		let list: Markdown.List = {
			type: "list",
			ordered: false,
			tight: true,
			attributes: {},
			children: [item(paragraph(text("a"))), item(paragraph(text("b")))],
			position: POSITION,
		};

		expect(toHTML(doc(list))).toBe("<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n");
	});

	test("keeps the paragraphs of a loose list", () => {
		let list: Markdown.List = {
			type: "list",
			ordered: false,
			tight: false,
			attributes: {},
			children: [item(paragraph(text("a")))],
			position: POSITION,
		};

		expect(toHTML(doc(list))).toBe("<ul>\n<li>\n<p>a</p>\n</li>\n</ul>\n");
	});

	test("wraps the paragraphs of a block quote nested in a tight item", () => {
		let quote: Markdown.Blockquote = {
			type: "blockquote",
			attributes: {},
			children: [paragraph(text("b"))],
			position: POSITION,
		};
		let list: Markdown.List = {
			type: "list",
			ordered: false,
			tight: true,
			attributes: {},
			children: [item(paragraph(text("a")), quote)],
			position: POSITION,
		};

		expect(toHTML(doc(list))).toBe(
			"<ul>\n<li>a\n<blockquote>\n<p>b</p>\n</blockquote>\n</li>\n</ul>\n",
		);
	});

	test("writes an ordered list's start only when it is not one", () => {
		let numbered = (start: number): Markdown.List => ({
			type: "list",
			ordered: true,
			start,
			tight: true,
			attributes: {},
			children: [item(paragraph(text("a")))],
			position: POSITION,
		});

		expect(toHTML(doc(numbered(3)))).toBe(`<ol start="3">\n<li>a</li>\n</ol>\n`);
		expect(toHTML(doc(numbered(1)))).toBe("<ol>\n<li>a</li>\n</ol>\n");
	});

	test("draws a task list item as a disabled checkbox", () => {
		let list: Markdown.List = {
			type: "list",
			ordered: false,
			tight: true,
			attributes: {},
			children: [
				{ ...item(paragraph(text("foo"))), checked: false },
				{ ...item(paragraph(text("bar"))), checked: true },
			],
			position: POSITION,
		};

		expect(toHTML(doc(list))).toBe(
			'<ul>\n<li><input disabled="" type="checkbox"> foo</li>\n' +
				'<li><input checked="" disabled="" type="checkbox"> bar</li>\n</ul>\n',
		);
	});

	test("draws a loose task list item's checkbox inside the paragraph", () => {
		let list: Markdown.List = {
			type: "list",
			ordered: false,
			tight: false,
			attributes: {},
			children: [{ ...item(paragraph(text("foo"))), checked: true }],
			position: POSITION,
		};

		expect(toHTML(doc(list))).toBe(
			'<ul>\n<li>\n<p><input checked="" disabled="" type="checkbox"> foo</p>\n</li>\n</ul>\n',
		);
	});
});

describe("inlines", () => {
	test("prints each emphasis kind as the element it stands for", () => {
		let emphasis: Markdown.Emphasis = {
			type: "emphasis",
			children: [text("a")],
			position: POSITION,
		};
		let strong: Markdown.Strong = { type: "strong", children: [text("b")], position: POSITION };
		let struck: Markdown.Strikethrough = {
			type: "strikethrough",
			children: [text("c")],
			position: POSITION,
		};

		expect(toHTML(doc(paragraph(emphasis, strong, struck)))).toBe(
			"<p><em>a</em><strong>b</strong><del>c</del></p>\n",
		);
	});

	test("escapes a code span's content", () => {
		let code: Markdown.InlineCode = { type: "inlineCode", value: "a < b", position: POSITION };

		expect(toHTML(doc(paragraph(code)))).toBe("<p><code>a &lt; b</code></p>\n");
	});

	test("writes a link's title only when it carries one", () => {
		let link = (title?: string): Markdown.Link => ({
			type: "link",
			href: "/url",
			title,
			children: [text("x")],
			position: POSITION,
		});

		expect(toHTML(doc(paragraph(link("t"))))).toBe(`<p><a href="/url" title="t">x</a></p>\n`);
		expect(toHTML(doc(paragraph(link())))).toBe(`<p><a href="/url">x</a></p>\n`);
		expect(toHTML(doc(paragraph(link(""))))).toBe(`<p><a href="/url">x</a></p>\n`);
	});

	test("percent-encodes a destination, leaving an escape the source wrote alone", () => {
		let link = (href: string): Markdown.Link => ({
			type: "link",
			href,
			children: [text("x")],
			position: POSITION,
		});

		expect(toHTML(doc(paragraph(link("/my uri"))))).toContain(`href="/my%20uri"`);
		expect(toHTML(doc(paragraph(link("/my%20uri"))))).toContain(`href="/my%20uri"`);
		expect(toHTML(doc(paragraph(link("foo bä"))))).toContain(`href="foo%20b%C3%A4"`);
		expect(toHTML(doc(paragraph(link("a&b"))))).toContain(`href="a&amp;b"`);
		expect(toHTML(doc(paragraph(link("it's"))))).toContain(`href="it&#x27;s"`);
		expect(toHTML(doc(paragraph(link(`"q"`))))).toContain(`href="%22q%22"`);
		expect(toHTML(doc(paragraph(link("http://example.com/a?b=c#d"))))).toContain(
			`href="http://example.com/a?b=c#d"`,
		);
	});

	test("builds an image's alternative text from its children, without their markup", () => {
		let emphasis: Markdown.Emphasis = {
			type: "emphasis",
			children: [text("bar")],
			position: POSITION,
		};
		let image: Markdown.Image = {
			type: "image",
			src: "/u",
			title: "t",
			children: [text("foo "), emphasis],
			position: POSITION,
		};

		expect(toHTML(doc(paragraph(image)))).toBe(`<p><img src="/u" alt="foo bar" title="t" /></p>\n`);
	});

	test("keeps a nested image's alternative text and drops its tag", () => {
		let inner: Markdown.Image = {
			type: "image",
			src: "/i",
			children: [text("in")],
			position: POSITION,
		};
		let outer: Markdown.Image = {
			type: "image",
			src: "/o",
			children: [text("out "), inner],
			position: POSITION,
		};

		expect(toHTML(doc(paragraph(outer)))).toBe(`<p><img src="/o" alt="out in" /></p>\n`);
	});
});

describe("tables", () => {
	test("prints a header, a body, and each column's alignment", () => {
		let table: Markdown.Table = {
			type: "table",
			align: ["left", null, "center"],
			attributes: {},
			children: [row(true, "a", "b", "c"), row(false, "1", "2", "3")],
			position: POSITION,
		};

		expect(toHTML(doc(table))).toBe(
			"<table>\n<thead>\n<tr>\n" +
				`<th align="left">a</th>\n<th>b</th>\n<th align="center">c</th>\n` +
				"</tr>\n</thead>\n<tbody>\n<tr>\n" +
				`<td align="left">1</td>\n<td>2</td>\n<td align="center">3</td>\n` +
				"</tr>\n</tbody>\n</table>\n",
		);
	});

	test("leaves out the body when every row is the header", () => {
		let table: Markdown.Table = {
			type: "table",
			align: [null, null],
			attributes: {},
			children: [row(true, "abc", "def")],
			position: POSITION,
		};

		expect(toHTML(doc(table))).toBe(
			"<table>\n<thead>\n<tr>\n<th>abc</th>\n<th>def</th>\n</tr>\n</thead>\n</table>\n",
		);
	});
});

describe("footnotes", () => {
	test("numbers a reference by its definition and lists the definitions at the end", () => {
		let reference: Markdown.FootnoteReference = {
			type: "footnoteReference",
			identifier: "note",
			position: POSITION,
		};
		let definition: Markdown.FootnoteDefinition = {
			type: "footnoteDefinition",
			identifier: "note",
			attributes: {},
			children: [paragraph(text("The body."))],
			position: POSITION,
		};

		expect(toHTML(doc(paragraph(text("a"), reference), definition))).toBe(
			`<p>a<sup class="footnote-ref"><a href="#fn-note" id="fnref-note">1</a></sup></p>\n` +
				`<section class="footnotes">\n<ol>\n<li id="fn-note">\n<p>The body.</p>\n` +
				`<a href="#fnref-note" class="footnote-backref">↩</a>\n</li>\n</ol>\n</section>\n`,
		);
	});

	test("labels a reference with its identifier when no definition carries it", () => {
		let reference: Markdown.FootnoteReference = {
			type: "footnoteReference",
			identifier: "gone",
			position: POSITION,
		};

		expect(toHTML(doc(paragraph(reference)))).toBe(
			`<p><sup class="footnote-ref"><a href="#fn-gone" id="fnref-gone">gone</a></sup></p>\n`,
		);
	});
});

describe("dialect nodes", () => {
	test("draws an alert with its kind named in the title", () => {
		let alert: Markdown.Alert = {
			type: "alert",
			kind: "warning",
			attributes: {},
			children: [paragraph(text("Careful."))],
			position: POSITION,
		};

		expect(toHTML(doc(alert))).toBe(
			`<div class="markdown-alert markdown-alert-warning">\n` +
				`<p class="markdown-alert-title">Warning</p>\n<p>Careful.</p>\n</div>\n`,
		);
	});

	test("prints a tag as the element the source wrote, attributes and all", () => {
		let kbd: Markdown.Tag = {
			type: "tag",
			name: "kbd",
			attributes: { size: "sm" },
			children: [text("Cmd")],
			position: POSITION,
		};

		expect(toHTML(doc(paragraph(text("Press "), kbd)))).toBe(
			`<p>Press <kbd size="sm">Cmd</kbd></p>\n`,
		);
	});

	test("prints an unresolved variable as the hole the source wrote", () => {
		let variable: Markdown.Variable = { type: "variable", name: "team", position: POSITION };

		expect(toHTML(doc(paragraph(variable)))).toBe("<p>{% $team %}</p>\n");
	});
});

describe("fragments", () => {
	test("prints any node, so a subtree compares on its own", () => {
		expect(toHTML(paragraph(text("a")))).toBe("<p>a</p>\n");
		expect(toHTML(text("a"))).toBe("a");
	});

	test("prints an empty document as nothing at all", () => {
		expect(toHTML(doc())).toBe("");
	});
});
