/**
 * Tests for plain-text extraction, concentrating on the constructs an AST walk
 * gets right and a pass of regular expressions does not: reference definitions,
 * link titles, fenced code, raw HTML, and Markdoc tags.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { toPlainText } from "./plain-text";

describe("toPlainText", () => {
	test("returns an empty string for empty input", () => {
		expect(toPlainText("")).toBe("");
		expect(toPlainText("\n\n")).toBe("");
	});

	test("keeps paragraph text and drops the heading markers", () => {
		expect(toPlainText("# Hello World\n\nA paragraph.")).toBe("Hello World\n\nA paragraph.");
	});

	test("drops emphasis, strong, and strikethrough markers", () => {
		expect(toPlainText("A *little* **bold** and ~~gone~~.")).toBe("A little bold and gone.");
	});

	test("keeps a link's label and drops its target and title", () => {
		expect(toPlainText(`Read [the docs](https://example.com "Docs").`)).toBe("Read the docs.");
	});

	test("drops a reference definition and keeps the reference's label", () => {
		let markdown = ["Read [the docs][docs].", "", `[docs]: https://example.com "Docs"`].join("\n");

		expect(toPlainText(markdown)).toBe("Read the docs.");
	});

	test("keeps inline code content because it is part of the sentence", () => {
		expect(toPlainText("Call `toPlainText()` first.")).toBe("Call toPlainText() first.");
	});

	test("drops fenced code by default", () => {
		let markdown = ["Before.", "", "```ts", "let x = 1;", "```", "", "After."].join("\n");

		expect(toPlainText(markdown)).toBe("Before.\n\nAfter.");
	});

	test("keeps fenced code when asked", () => {
		let markdown = ["Before.", "", "```ts", "let x = 1;", "```"].join("\n");

		expect(toPlainText(markdown, { fences: true })).toBe("Before.\n\nlet x = 1;");
	});

	test("drops image alternative text by default and keeps it when asked", () => {
		let markdown = `A ![diagram](/a.png "Caption") here.`;

		expect(toPlainText(markdown)).toBe("A  here.");
		expect(toPlainText(markdown, { images: true })).toBe("A diagram here.");
	});

	test("drops frontmatter", () => {
		let markdown = ["---", "title: Hello", "---", "", "Body text."].join("\n");

		expect(toPlainText(markdown)).toBe("Body text.");
	});

	test("drops raw HTML tags and keeps the words between them", () => {
		expect(toPlainText("A <strong>bold</strong> claim.")).toBe("A bold claim.");
		expect(toPlainText('<div class="note">\n\nInside.\n\n</div>')).toBe("Inside.");
	});

	test("keeps a comparison that only looks like a tag", () => {
		expect(toPlainText("Keep it if a < b and c > d.")).toBe("Keep it if a < b and c > d.");
	});

	test("turns each list item into its own block", () => {
		let markdown = ["- first", "- second", "- third"].join("\n");

		expect(toPlainText(markdown)).toBe("first\n\nsecond\n\nthird");
	});

	test("keeps ordered list content without the markers", () => {
		expect(toPlainText("1. first\n2. second")).toBe("first\n\nsecond");
	});

	test("unwraps a block quote", () => {
		expect(toPlainText("> Quoted line.\n")).toBe("Quoted line.");
	});

	test("collapses a table row into one block", () => {
		let markdown = ["| a | b |", "| - | - |", "| 1 | 2 |"].join("\n");

		expect(toPlainText(markdown)).toBe("a b\n\n1 2");
	});

	test("drops a horizontal rule", () => {
		expect(toPlainText("Above.\n\n---\n\nBelow.")).toBe("Above.\n\nBelow.");
	});

	test("joins the two halves of a soft break with a space", () => {
		expect(toPlainText("Line one\nLine two")).toBe("Line one Line two");
	});

	test("keeps the content of a Markdoc tag and drops its syntax", () => {
		expect(toPlainText("{% callout %}Pay attention{% /callout %}")).toBe("Pay attention");
	});

	test("drops a markdown comment", () => {
		expect(toPlainText("Visible.\n\n<!-- hidden -->\n")).toBe("Visible.");
	});

	test("composes into a one-line summary when whitespace is collapsed", () => {
		let markdown = ["# Title", "", "First paragraph.", "", "Second paragraph."].join("\n");
		let summary = toPlainText(markdown).replace(/\s+/g, " ");

		expect(summary).toBe("Title First paragraph. Second paragraph.");
	});
});
