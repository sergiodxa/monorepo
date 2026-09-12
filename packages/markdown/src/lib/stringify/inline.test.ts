/**
 * Tests the inline writer: the one spelling each mark is normalized to, the fence
 * and padding rules a code span picks, the two forms a link takes, and the line
 * tracking that tells a following text node whether it opens a line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Markdown } from "../../index.js";

import { stringifyInlines } from "./inline.js";

/** A dummy span, since the writer reads a node's fields and never its coordinates. */
function position(): Markdown.Position {
	let point = { line: 1, column: 1, offset: 0 };
	return { start: point, end: point };
}

/** The leaf almost every case in this file is built from. */
function text(value: string): Markdown.Text {
	return { type: "text", value, position: position() };
}

/** An emphasis over the children a case is about, which is the mark the delimiter rule is read through. */
function emphasis(...children: Markdown.Inline[]): Markdown.Emphasis {
	return { type: "emphasis", children, position: position() };
}

/** Writes a run mid-line and outside a table, which is where most cases sit. */
function write(...nodes: Markdown.Inline[]): string {
	return stringifyInlines(nodes, { table: false }, false);
}

/** Writes a run inside a table cell, where a pipe escapes and a break flattens. */
function writeInCell(...nodes: Markdown.Inline[]): string {
	return stringifyInlines(nodes, { table: true }, false);
}

describe("stringifyInlines", () => {
	test("writes an empty run as an empty string", () => {
		expect(write()).toBe("");
	});

	test("writes the nodes of a run in order", () => {
		expect(write(text("one "), text("two"))).toBe("one two");
	});

	test("escapes a text node for the construct it could otherwise open", () => {
		expect(write(text("a * b"))).toBe("a \\* b");
	});

	test("gives the first node the line position the caller reports", () => {
		expect(stringifyInlines([text("# heading?")], { table: false }, true)).toBe("\\# heading?");
		expect(stringifyInlines([text("# heading?")], { table: false }, false)).toBe("# heading?");
	});

	test("puts a node that follows a break back at the start of a line", () => {
		expect(write(text("prose"), { type: "softBreak", position: position() }, text("- item"))).toBe(
			"prose\n\\- item",
		);
	});

	test("writes emphasis with one underscore on each side", () => {
		expect(write(emphasis(text("soft")))).toBe("_soft_");
	});

	test("writes emphasis with asterisks where an underscore would sit inside a word", () => {
		expect(write(text("x"), emphasis(text("a")), text("x"))).toBe("x*a*x");
		expect(write(text("1"), emphasis(text("a")), text("2"))).toBe("1*a*2");
		expect(write(text("á"), emphasis(text("a")), text("á"))).toBe("á*a*á");
	});

	test("keeps the underscores where punctuation sits against the delimiter", () => {
		expect(write(text("("), emphasis(text("a")), text(")"))).toBe("(_a_)");
		expect(write(emphasis(text("a")), text(" and "), emphasis(text("b")))).toBe("_a_ and _b_");
	});

	test("switches the inner emphasis to asterisks, since two underscores would read as strong", () => {
		expect(write(emphasis(emphasis(text("a"))))).toBe("_*a*_");
	});

	test("writes strong with two asterisks on each side", () => {
		expect(write({ type: "strong", children: [text("loud")], position: position() })).toBe(
			"**loud**",
		);
	});

	test("writes strikethrough with two tildes on each side", () => {
		expect(write({ type: "strikethrough", children: [text("gone")], position: position() })).toBe(
			"~~gone~~",
		);
	});

	test("nests one mark inside another", () => {
		expect(
			write({ type: "strong", children: [emphasis(text("both"))], position: position() }),
		).toBe("**_both_**");
	});

	test("treats the inside of a mark as mid-line, since a block never opens there", () => {
		expect(write(emphasis(text("- item")))).toBe("_- item_");
	});

	test("fences a code span with one more backtick than any run inside it", () => {
		expect(write({ type: "inlineCode", value: "let a = 1", position: position() })).toBe(
			"`let a = 1`",
		);
		expect(write({ type: "inlineCode", value: "a ` b", position: position() })).toBe("``a ` b``");
		expect(write({ type: "inlineCode", value: "a ``` b", position: position() })).toBe(
			"````a ``` b````",
		);
	});

	test("pads a code span that opens or closes on a backtick", () => {
		expect(write({ type: "inlineCode", value: "`x`", position: position() })).toBe("`` `x` ``");
		expect(write({ type: "inlineCode", value: "x`", position: position() })).toBe("`` x` ``");
	});

	test("pads a code span whose own spaces would otherwise be stripped", () => {
		expect(write({ type: "inlineCode", value: " x ", position: position() })).toBe("`  x  `");
	});

	test("leaves a code span of nothing but spaces unpadded, since nothing strips it", () => {
		expect(write({ type: "inlineCode", value: " ", position: position() })).toBe("` `");
	});

	test("writes a link whose only text reads as its destination as an autolink", () => {
		expect(
			write({
				type: "link",
				href: "https://example.com",
				children: [text("https://example.com")],
				position: position(),
			}),
		).toBe("<https://example.com>");
	});

	test("writes a link in the bracketed form once its text differs from its destination", () => {
		expect(
			write({
				type: "link",
				href: "https://example.com",
				children: [text("docs")],
				position: position(),
			}),
		).toBe("[docs](https://example.com)");
	});

	test("writes a link in the bracketed form once it carries a title", () => {
		expect(
			write({
				type: "link",
				href: "https://example.com",
				title: "Home",
				children: [text("https://example.com")],
				position: position(),
			}),
		).toBe('[https\\://example.com](https://example.com "Home")');
	});

	test("escapes the quote a title holds", () => {
		expect(
			write({
				type: "link",
				href: "https://example.com",
				title: 'the "home" page',
				children: [text("docs")],
				position: position(),
			}),
		).toBe('[docs](https://example.com "the \\"home\\" page")');
	});

	test("angle-wraps a destination the bare form would break on", () => {
		expect(
			write({
				type: "link",
				href: "https://example.com/a b",
				children: [text("docs")],
				position: position(),
			}),
		).toBe("[docs](<https://example.com/a b>)");

		expect(
			write({
				type: "link",
				href: "https://example.com/a(b)",
				children: [text("docs")],
				position: position(),
			}),
		).toBe("[docs](<https://example.com/a(b)>)");
	});

	test("angle-wraps an empty destination, which has nothing to stand for it", () => {
		expect(write({ type: "link", href: "", children: [text("docs")], position: position() })).toBe(
			"[docs](<>)",
		);
	});

	test("writes an image with its alternative text and its source", () => {
		expect(
			write({ type: "image", src: "/logo.png", children: [text("Logo")], position: position() }),
		).toBe("![Logo](/logo.png)");

		expect(
			write({
				type: "image",
				src: "/logo.png",
				title: "Our logo",
				children: [text("Logo")],
				position: position(),
			}),
		).toBe('![Logo](/logo.png "Our logo")');
	});

	test("writes a soft break as a newline and a hard break as a trailing backslash", () => {
		expect(write({ type: "softBreak", position: position() })).toBe("\n");
		expect(write({ type: "hardBreak", position: position() })).toBe("\\\n");
	});

	test("flattens either break to a space inside a table cell, where a row is one line", () => {
		expect(writeInCell({ type: "softBreak", position: position() })).toBe(" ");
		expect(writeInCell({ type: "hardBreak", position: position() })).toBe(" ");
	});

	test("escapes a pipe inside a table cell and leaves it alone outside one", () => {
		expect(writeInCell(text("a | b"))).toBe("a \\| b");
		expect(write(text("a | b"))).toBe("a | b");
	});

	test("writes a variable back as the hole it came from", () => {
		expect(write({ type: "variable", name: "title", position: position() })).toBe("{% $title %}");
	});

	test("writes a footnote reference as the label that points at its body", () => {
		expect(write({ type: "footnoteReference", identifier: "note", position: position() })).toBe(
			"[^note]",
		);
	});

	test("writes inline html verbatim, escaping nothing inside it", () => {
		expect(write({ type: "inlineHtml", value: "<abbr title='x'>", position: position() })).toBe(
			"<abbr title='x'>",
		);
	});

	test("writes an inline tag with nothing inside it as self-closing", () => {
		expect(
			write({ type: "tag", name: "Icon", attributes: {}, children: [], position: position() }),
		).toBe("<Icon />");
	});

	test("writes an inline tag around the children it holds", () => {
		expect(
			write({
				type: "tag",
				name: "Note",
				attributes: {},
				children: [text("careful")],
				position: position(),
			}),
		).toBe("<Note>careful</Note>");
	});

	test("writes a tag's attributes as pairs, since a tag takes no shorthands", () => {
		expect(
			write({
				type: "tag",
				name: "Note",
				attributes: { id: "first", kind: "tip" },
				children: [text("careful")],
				position: position(),
			}),
		).toBe('<Note id="first" kind="tip">careful</Note>');

		expect(
			write({
				type: "tag",
				name: "Icon",
				attributes: { name: "star" },
				children: [],
				position: position(),
			}),
		).toBe('<Icon name="star" />');
	});
});
