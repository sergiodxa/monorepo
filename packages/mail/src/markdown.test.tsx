/**
 * Tests markdown as an email body against the two things that make it different from
 * markdown on a page: every element has to come out with its styles inline, and the
 * plain-text half has to stay readable through the same conversion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Markdown as Ast } from "@sdxc/markdown";

import { describe, expect, test } from "vitest";

import { CodeBlock, Markdown } from "./markdown.js";

import { render } from "./index.js";

/** Every node needs one, and nothing here asserts on it, so one value serves the whole file. */
function position(): Ast.Position {
	return { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
}

/** Inline text, which is what most of the trees below are made of. */
function text(value: string): Ast.Text {
	return { type: "text", value, position: position() };
}

/** Wraps blocks in the root the component takes. */
function document(...blocks: Ast.Block[]): Ast.Document {
	return { type: "document", children: blocks, position: position() };
}

/** A paragraph of plain words, which is the cheapest block to put somewhere. */
function paragraph(...inline: Ast.Inline[]): Ast.Paragraph {
	return { type: "paragraph", attributes: {}, children: inline, position: position() };
}

/** One cell of the table below, which is always a single run of words. */
function cell(value: string): Ast.TableCell {
	return { type: "tableCell", attributes: {}, children: [text(value)], position: position() };
}

/** A row of the table below, marked as the header or as body. */
function row(header: boolean, ...values: string[]): Ast.TableRow {
	return {
		type: "tableRow",
		header,
		attributes: {},
		children: values.map(cell),
		position: position(),
	};
}

/** One list item holding a single paragraph, which is how a loose list is parsed. */
function item(...blocks: Ast.Block[]): Ast.ListItem {
	return { type: "listItem", attributes: {}, children: blocks, position: position() };
}

describe("Markdown", () => {
	test("renders every block with the kit's own inline styles, never a class alone", async () => {
		let heading: Ast.Heading = {
			type: "heading",
			level: 1,
			attributes: {},
			children: [text("Title")],
			position: position(),
		};

		let { html } = await render(
			<Markdown document={document(heading, paragraph(text("Copy.")))} />,
		);

		expect(html).toContain("<h1 style=");
		expect(html).toContain("font-size:24px");
		expect(html).toContain("<p style=");
		expect(html).toContain("line-height:1.6");
	});

	test("gives up its heading levels at three, which is as many as a card holds", async () => {
		let heading: Ast.Heading = {
			type: "heading",
			level: 6,
			attributes: {},
			children: [text("Deep")],
			position: position(),
		};

		let { html } = await render(<Markdown document={document(heading)} />);

		expect(html).toMatch(/^<h3/);
	});

	test("renders the second heading level at its own size", async () => {
		let heading: Ast.Heading = {
			type: "heading",
			level: 2,
			attributes: {},
			children: [text("Section")],
			position: position(),
		};

		let { html } = await render(<Markdown document={document(heading)} />);

		expect(html).toMatch(/^<h2/);
		expect(html).toContain("font-size:20px");
	});

	test("keeps inline emphasis, code, and links, with the target in the text part", async () => {
		let body = paragraph(
			text("Set "),
			{ type: "inlineCode", value: "DEBUG=1", position: position() },
			text(" for "),
			{ type: "strong", children: [text("more")], position: position() },
			text(", or read the "),
			{
				type: "link",
				href: "https://example.com",
				children: [text("docs")],
				position: position(),
			},
			text("."),
		);

		let { html, text: plain } = await render(<Markdown document={document(body)} />);

		expect(html).toContain("<code");
		expect(html).toContain("<strong");
		expect(html).toContain('href="https://example.com"');
		expect(plain).toBe("Set DEBUG=1 for more, or read the docs (https://example.com).");
	});

	test("renders emphasis and strikethrough with the styles a stripped client still reads", async () => {
		let body = paragraph(
			{ type: "emphasis", children: [text("soft")], position: position() },
			{ type: "strikethrough", children: [text("gone")], position: position() },
		);

		let { html } = await render(<Markdown document={document(body)} />);

		expect(html).toContain('<em style="font-style:italic;">soft</em>');
		expect(html).toContain('<s style="text-decoration:line-through;">gone</s>');
	});

	test("numbers an ordered list and bullets an unordered one, in both parts", async () => {
		let ordered: Ast.List = {
			type: "list",
			ordered: true,
			tight: true,
			attributes: {},
			children: [item(paragraph(text("One"))), item(paragraph(text("Two")))],
			position: position(),
		};

		let unordered: Ast.List = {
			type: "list",
			ordered: false,
			tight: true,
			attributes: {},
			children: [item(paragraph(text("Loose")))],
			position: position(),
		};

		let { html, text: plain } = await render(<Markdown document={document(ordered, unordered)} />);

		expect(html).toContain("<ol");
		expect(html).toContain("<ul");
		expect(plain).toContain("1. One");
		expect(plain).toContain("2. Two");
		expect(plain).toContain("- Loose");
	});

	test("starts an ordered list at the number the source asked for", async () => {
		let list: Ast.List = {
			type: "list",
			ordered: true,
			start: 4,
			tight: true,
			attributes: {},
			children: [item(paragraph(text("Four")))],
			position: position(),
		};

		let { html } = await render(<Markdown document={document(list)} />);

		expect(html).toContain('start="4"');
	});

	test("drops the paragraph markdown wraps a loose list item in", async () => {
		let list: Ast.List = {
			type: "list",
			ordered: false,
			tight: false,
			attributes: {},
			children: [item(paragraph(text("One")))],
			position: position(),
		};

		let { html } = await render(<Markdown document={document(list)} />);

		expect(html).toContain("<li");
		expect(html).not.toContain(
			'<li style="margin:0 0 6px;font-family:inherit;line-height:1.6;"><p',
		);
	});

	test("renders a quote as an indented rule that dark mode recolours", async () => {
		let quote: Ast.Blockquote = {
			type: "blockquote",
			attributes: {},
			children: [paragraph(text("Quoted."))],
			position: position(),
		};

		let { html } = await render(<Markdown document={document(quote)} />);

		expect(html).toMatch(/^<blockquote/);
		expect(html).toContain('class="mail-rule"');
		expect(html).toContain("border-left:3px solid #e4e4e7");
		expect(html).toContain("Quoted.");
	});

	test("names an alert's kind, which is the only thing separating it from a quote", async () => {
		let alert: Ast.Alert = {
			type: "alert",
			kind: "warning",
			attributes: {},
			children: [paragraph(text("Tokens expire."))],
			position: position(),
		};

		let { html, text: plain } = await render(<Markdown document={document(alert)} />);

		expect(html).toMatch(/^<blockquote/);
		expect(plain).toContain("WARNING");
		expect(plain).toContain("Tokens expire.");
	});

	test("lays a table out as a real table, with the header cells and column alignment", async () => {
		let table: Ast.Table = {
			type: "table",
			align: ["left", "right"],
			attributes: {},
			children: [row(true, "Monitor", "Uptime"), row(false, "Landing", "99.9%")],
			position: position(),
		};

		let { html, text: plain } = await render(<Markdown document={document(table)} />);

		expect(html).toMatch(/^<table/);
		expect(html).toContain("<th");
		expect(html).toContain("<td");
		expect(html).toContain("text-align:right");
		expect(html).toContain("border-collapse:collapse");
		expect(plain).toContain("Monitor");
		expect(plain).toContain("99.9%");
	});

	test("renders a row and a cell on their own, for a fragment handed over without its table", async () => {
		let table: Ast.Table = {
			type: "table",
			align: [],
			attributes: {},
			children: [row(false, "Alone")],
			position: position(),
		};

		let { html } = await render(<Markdown document={document(table)} />);

		expect(html).toContain("<tr");
		expect(html).toContain("Alone");
	});

	test("draws a thematic break as the kit's rule rather than the native groove", async () => {
		let { html } = await render(
			<Markdown
				document={document({ type: "thematicBreak", attributes: {}, position: position() })}
			/>,
		);

		expect(html).toMatch(/^<hr/);
		expect(html).toContain("border-top:1px solid");
	});

	test("delivers raw HTML as text the reader sees, never as markup the inbox runs", async () => {
		let block: Ast.Html = {
			type: "html",
			value: "<script>alert(1)</script>",
			attributes: {},
			position: position(),
		};

		let inline = paragraph(
			text("before "),
			{ type: "inlineHtml", value: "<b>", position: position() },
			text(" after"),
		);

		let { html, text: plain } = await render(<Markdown document={document(block, inline)} />);

		expect(html).not.toContain("<script>");
		expect(html).not.toContain("<b>");
		expect(html).toContain("&lt;script&gt;");
		expect(html).toContain("&lt;b&gt;");
		expect(plain).toContain("<script>alert(1)</script>");
	});

	test("keeps a footnote's mark beside the prose and its body as a labelled block", async () => {
		let body = paragraph(
			text("Rates apply"),
			{ type: "footnoteReference", identifier: "1", position: position() },
			text("."),
		);

		let definition: Ast.FootnoteDefinition = {
			type: "footnoteDefinition",
			identifier: "1",
			attributes: {},
			children: [paragraph(text("Per region."))],
			position: position(),
		};

		let { html, text: plain } = await render(<Markdown document={document(body, definition)} />);

		expect(html).toContain("<sup");
		expect(plain).toContain("[1]");
		expect(plain).toContain("Per region.");
	});

	test("turns a soft break into whitespace and a hard break into a line of its own", async () => {
		let body = paragraph(
			text("one"),
			{ type: "softBreak", position: position() },
			text("two"),
			{ type: "hardBreak", position: position() },
			text("three"),
		);

		let { html } = await render(<Markdown document={document(body)} />);

		expect(html).toContain("<br");
		expect(html).toContain("one\ntwo");
	});

	test("shows an unresolved hole as the annotation the author wrote", async () => {
		let body = paragraph(text("Hi "), { type: "variable", name: "name", position: position() });

		let { text: plain } = await render(<Markdown document={document(body)} />);

		expect(plain).toBe("Hi {% $name %}");
	});

	test("renders a tag's content, since an inbox has no components to hand it to", async () => {
		let tag: Ast.Tag = {
			type: "tag",
			name: "callout",
			attributes: { kind: "note" },
			children: [paragraph(text("Inside the tag."))],
			position: position(),
		};

		let { html, text: plain } = await render(<Markdown document={document(tag)} />);

		expect(html).toContain("<p");
		expect(plain).toBe("Inside the tag.");
	});

	test("renders an image with the alternative text its inline content spells out", async () => {
		let body = paragraph({
			type: "image",
			src: "https://example.com/chart.png",
			children: [
				text("Latency "),
				{ type: "emphasis", children: [text("chart")], position: position() },
			],
			position: position(),
		});

		let { html } = await render(<Markdown document={document(body)} />);

		expect(html).toContain('src="https://example.com/chart.png"');
		expect(html).toContain('alt="Latency chart"');
	});

	test("paints a code block the caller already highlighted with the runs it carries", async () => {
		let code: Ast.Code = {
			type: "code",
			language: "typescript",
			content: 'let x = "y";',
			attributes: {},
			tokens: [
				{ type: "keyword", value: "let" },
				{ type: "plain", value: " x = " },
				{ type: "string", value: '"y"' },
			],
			position: position(),
		};

		let { html } = await render(<Markdown document={document(code)} />);

		expect(html).toContain('class="mail-tok-keyword"');
		expect(html).toContain('class="mail-tok-string"');
		expect(html).toContain("color:#d73a49");
	});

	test("paints an unpainted code block itself, from the language it names", async () => {
		let code: Ast.Code = {
			type: "code",
			language: "bash",
			content: "# deploy it\nbun run deploy",
			attributes: {},
			position: position(),
		};

		let { html } = await render(<Markdown document={document(code)} />);

		expect(html).toContain('class="mail-tok-comment"');
	});

	test("renders an empty document as an empty body rather than failing", async () => {
		let { html } = await render(<Markdown document={document()} />);

		expect(html).toBe("");
	});
});

describe("CodeBlock", () => {
	test("highlights a known language into spans that carry their own color", async () => {
		let { html } = await render(<CodeBlock language="typescript" code={'let x = "y";'} />);

		expect(html).toContain('class="mail-tok-keyword"');
		expect(html).toContain("color:#d73a49");
		expect(html).toContain('class="mail-tok-string"');
	});

	/**
	 * A TSX fence highlights with the TypeScript half of the grammar, which the
	 * grammar states as an import rather than leaving to a load order.
	 */
	test("paints tsx with the TypeScript half of the grammar", async () => {
		let { html } = await render(<CodeBlock language="tsx" code="type Id = string;" />);

		expect(html).toContain('class="mail-tok-keyword"');
	});

	test("renders an unknown language unpainted rather than failing", async () => {
		let { html, text } = await render(<CodeBlock language="brainfuck" code="++[.]" />);

		expect(html).not.toContain("mail-tok-");
		expect(text).toBe("++[.]");
	});

	test("wraps long lines, since an inbox has no horizontal scrollbar to offer", async () => {
		let { html } = await render(<CodeBlock code="x" />);

		expect(html).toContain("white-space:pre-wrap");
		expect(html).toContain("word-break:break-word");
	});

	test("takes its fill from a table cell, which Outlook paints to the full width", async () => {
		let { html } = await render(<CodeBlock code="x" />);

		expect(html).toMatch(/^<table/);
		expect(html).toContain('class="mail-code"');
	});
});
