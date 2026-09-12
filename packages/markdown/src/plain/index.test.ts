/**
 * Tests for plain-text extraction, covering what each node type contributes to
 * a sentence and where a block ends. Trees are built by hand so a case states
 * the exact shape it is about, independent of how a parser reached it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Markdown } from "../index.js";

import { toPlainText } from "./index.js";

/** A position every node can share, since plain text reads content alone. */
function position(): Markdown.Position {
	return { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
}

function text(value: string): Markdown.Text {
	return { type: "text", value, position: position() };
}

function inlineCode(value: string): Markdown.InlineCode {
	return { type: "inlineCode", value, position: position() };
}

function emphasis(...children: Markdown.Inline[]): Markdown.Emphasis {
	return { type: "emphasis", children, position: position() };
}

function strong(...children: Markdown.Inline[]): Markdown.Strong {
	return { type: "strong", children, position: position() };
}

function strikethrough(...children: Markdown.Inline[]): Markdown.Strikethrough {
	return { type: "strikethrough", children, position: position() };
}

function link(
	href: string,
	title: string | undefined,
	...children: Markdown.Inline[]
): Markdown.Link {
	return { type: "link", href, title, children, position: position() };
}

/** `children` hold the alternative text, which is what the `images` option decides on. */
function image(src: string, ...children: Markdown.Inline[]): Markdown.Image {
	return { type: "image", src, children, position: position() };
}

function softBreak(): Markdown.SoftBreak {
	return { type: "softBreak", position: position() };
}

function hardBreak(): Markdown.HardBreak {
	return { type: "hardBreak", position: position() };
}

function inlineHtml(value: string): Markdown.InlineHtml {
	return { type: "inlineHtml", value, position: position() };
}

function html(value: string): Markdown.Html {
	return { type: "html", value, attributes: {}, position: position() };
}

function footnoteReference(identifier: string): Markdown.FootnoteReference {
	return { type: "footnoteReference", identifier, position: position() };
}

function footnoteDefinition(
	identifier: string,
	...children: Markdown.Block[]
): Markdown.FootnoteDefinition {
	return {
		type: "footnoteDefinition",
		identifier,
		attributes: {},
		children,
		position: position(),
	};
}

function variable(name: string): Markdown.Variable {
	return { type: "variable", name, position: position() };
}

function paragraph(...children: Markdown.Inline[]): Markdown.Paragraph {
	return { type: "paragraph", attributes: {}, children, position: position() };
}

function heading(level: 1 | 2 | 3 | 4 | 5 | 6, ...children: Markdown.Inline[]): Markdown.Heading {
	return { type: "heading", level, attributes: {}, children, position: position() };
}

function code(content: string, language?: string): Markdown.Code {
	return { type: "code", language, content, attributes: {}, position: position() };
}

function list(ordered: boolean, ...children: Markdown.ListItem[]): Markdown.List {
	return { type: "list", ordered, tight: true, attributes: {}, children, position: position() };
}

function listItem(...children: Markdown.Block[]): Markdown.ListItem {
	return { type: "listItem", attributes: {}, children, position: position() };
}

function blockquote(...children: Markdown.Block[]): Markdown.Blockquote {
	return { type: "blockquote", attributes: {}, children, position: position() };
}

function alert(kind: Markdown.Alert["kind"], ...children: Markdown.Block[]): Markdown.Alert {
	return { type: "alert", kind, attributes: {}, children, position: position() };
}

function table(...children: Markdown.TableRow[]): Markdown.Table {
	return { type: "table", align: [], attributes: {}, children, position: position() };
}

function tableRow(header: boolean, ...children: Markdown.TableCell[]): Markdown.TableRow {
	return { type: "tableRow", header, attributes: {}, children, position: position() };
}

function tableCell(...children: Markdown.Inline[]): Markdown.TableCell {
	return { type: "tableCell", attributes: {}, children, position: position() };
}

function thematicBreak(): Markdown.ThematicBreak {
	return { type: "thematicBreak", attributes: {}, position: position() };
}

/** Takes its children as an array, since a tag holds either blocks or inline content. */
function tag(name: string, children: Markdown.Block[] | Markdown.Inline[]): Markdown.Tag {
	return { type: "tag", name, attributes: {}, children, position: position() };
}

function document(...children: Markdown.Block[]): Markdown.Document {
	return { type: "document", children, position: position() };
}

describe("toPlainText", () => {
	test("returns an empty string when there is nothing to read", () => {
		expect(toPlainText(document())).toBe("");
		expect(toPlainText(document(paragraph()))).toBe("");
		expect(toPlainText(document(paragraph(text("   \n  "))))).toBe("");
	});

	test("keeps paragraph text and reads a heading as its own block", () => {
		let node = document(heading(1, text("Hello World")), paragraph(text("A paragraph.")));

		expect(toPlainText(node)).toBe("Hello World\n\nA paragraph.");
	});

	test("drops emphasis, strong, and strikethrough markers", () => {
		let node = paragraph(
			text("A "),
			emphasis(text("little")),
			text(" "),
			strong(text("bold")),
			text(" and "),
			strikethrough(text("gone")),
			text("."),
		);

		expect(toPlainText(node)).toBe("A little bold and gone.");
	});

	test("keeps a link's label and drops its target and title", () => {
		let node = paragraph(
			text("Read "),
			link("https://example.com", "Docs", text("the docs")),
			text("."),
		);

		expect(toPlainText(node)).toBe("Read the docs.");
	});

	test("keeps the label of a link a reference resolved to", () => {
		let node = paragraph(
			text("Read "),
			link("https://example.com", "Docs", emphasis(text("the")), text(" docs")),
			text("."),
		);

		expect(toPlainText(node)).toBe("Read the docs.");
	});

	test("keeps inline code content because it is part of the sentence", () => {
		let node = paragraph(text("Call "), inlineCode("toPlainText()"), text(" first."));

		expect(toPlainText(node)).toBe("Call toPlainText() first.");
	});

	test("drops a code block by default", () => {
		let node = document(
			paragraph(text("Before.")),
			code("let x = 1;", "ts"),
			paragraph(text("After.")),
		);

		expect(toPlainText(node)).toBe("Before.\n\nAfter.");
	});

	test("keeps a code block when asked", () => {
		let node = document(
			paragraph(text("Before.")),
			code("let x = 1;", "ts"),
			paragraph(text("After.")),
		);

		expect(toPlainText(node, { code: true })).toBe("Before.\n\nlet x = 1;\n\nAfter.");
	});

	test("drops image alternative text by default and keeps it when asked", () => {
		let node = paragraph(text("A "), image("/a.png", text("diagram")), text(" here."));

		expect(toPlainText(node)).toBe("A  here.");
		expect(toPlainText(node, { images: true })).toBe("A diagram here.");
	});

	test("drops an HTML block and keeps the prose it wraps", () => {
		let node = document(html(`<div class="note">`), paragraph(text("Inside.")), html("</div>"));

		expect(toPlainText(node)).toBe("Inside.");
	});

	test("drops inline HTML and keeps the words between it", () => {
		let node = paragraph(
			text("A "),
			inlineHtml("<strong>"),
			text("bold"),
			inlineHtml("</strong>"),
			text(" claim."),
		);

		expect(toPlainText(node)).toBe("A bold claim.");
	});

	test("drops an HTML comment", () => {
		let node = document(paragraph(text("Visible.")), html("<!-- hidden -->"));

		expect(toPlainText(node)).toBe("Visible.");
	});

	test("keeps text that only looks like a tag", () => {
		let node = paragraph(text("Keep it if a < b and c > d."));

		expect(toPlainText(node)).toBe("Keep it if a < b and c > d.");
	});

	test("turns each list item into its own block", () => {
		let node = document(
			list(
				false,
				listItem(paragraph(text("first"))),
				listItem(paragraph(text("second"))),
				listItem(paragraph(text("third"))),
			),
		);

		expect(toPlainText(node)).toBe("first\n\nsecond\n\nthird");
	});

	test("keeps ordered list content without the markers", () => {
		let node = document(
			list(true, listItem(paragraph(text("first"))), listItem(paragraph(text("second")))),
		);

		expect(toPlainText(node)).toBe("first\n\nsecond");
	});

	test("unwraps a block quote", () => {
		let node = document(blockquote(paragraph(text("Quoted line."))));

		expect(toPlainText(node)).toBe("Quoted line.");
	});

	test("unwraps an alert, whose kind is not prose", () => {
		let node = document(alert("warning", paragraph(text("Deleting a monitor is permanent."))));

		expect(toPlainText(node)).toBe("Deleting a monitor is permanent.");
	});

	test("collapses a table row into one block", () => {
		let node = document(
			table(
				tableRow(true, tableCell(text("a")), tableCell(text("b"))),
				tableRow(false, tableCell(text("1")), tableCell(text("2"))),
			),
		);

		expect(toPlainText(node)).toBe("a b\n\n1 2");
	});

	test("drops a thematic break", () => {
		let node = document(paragraph(text("Above.")), thematicBreak(), paragraph(text("Below.")));

		expect(toPlainText(node)).toBe("Above.\n\nBelow.");
	});

	test("joins the two halves of a soft break with a space", () => {
		let node = paragraph(text("Line one"), softBreak(), text("Line two"));

		expect(toPlainText(node)).toBe("Line one Line two");
	});

	test("joins the two halves of a hard break with a space", () => {
		let node = paragraph(text("Line one"), hardBreak(), text("Line two"));

		expect(toPlainText(node)).toBe("Line one Line two");
	});

	test("keeps the content of a block tag and drops its syntax", () => {
		let node = document(tag("callout", [paragraph(text("Pay attention"))]));

		expect(toPlainText(node)).toBe("Pay attention");
	});

	test("keeps an inline tag's children inside the sentence", () => {
		let node = paragraph(text("Press "), tag("kbd", [text("Cmd")]), text(" then K."));

		expect(toPlainText(node)).toBe("Press Cmd then K.");
		expect(toPlainText(tag("kbd", [text("Cmd")]))).toBe("Cmd");
	});

	test("drops a footnote reference and keeps the definition's prose", () => {
		let node = document(
			paragraph(text("A claim"), footnoteReference("1"), text(".")),
			footnoteDefinition("1", paragraph(text("The source."))),
		);

		expect(toPlainText(node)).toBe("A claim.\n\nThe source.");
	});

	test("drops a variable, whose value is unknown here", () => {
		let node = paragraph(text("Hello "), variable("name"), text("!"));

		expect(toPlainText(node)).toBe("Hello !");
	});

	test("reads a single heading, for a visitor building a table of contents", () => {
		let node = heading(2, text("Getting "), inlineCode("started"));

		expect(toPlainText(node)).toBe("Getting started");
	});

	test("reads a single inline node", () => {
		expect(toPlainText(text("Just words"))).toBe("Just words");
		expect(toPlainText(emphasis(text("Emphatic")))).toBe("Emphatic");
	});

	test("composes into a one-line summary when whitespace is collapsed", () => {
		let node = document(
			heading(1, text("Title")),
			paragraph(text("First paragraph.")),
			paragraph(text("Second paragraph.")),
		);

		expect(toPlainText(node).replace(/\s+/g, " ")).toBe("Title First paragraph. Second paragraph.");
	});
});
