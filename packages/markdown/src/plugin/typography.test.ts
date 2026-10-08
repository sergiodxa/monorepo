/**
 * Checks the visitor that sets prose in typographic punctuation: curly quotes and
 * apostrophes decided across neighbouring inline nodes, dashes and ellipses, each
 * toggled on its own, and code and markup left as written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Markdown as MarkdownTypes } from "../index.js";

import { Markdown } from "../index.js";
import { toPlainText } from "../plain/index.js";

import { typography } from "./typography.js";

/** Allows the code-like and prose elements the element tests write. */
const OPTIONS = {
	html: { kbd: [], abbr: ["title"] },
} satisfies MarkdownTypes.Options;

/**
 * @param source - The markdown to read
 * @returns The parsed document, failing the test when the parser rejected it
 */
function parse(source: string): MarkdownTypes.Document {
	return unwrap(Markdown.parse(source, OPTIONS)).document;
}

/**
 * @param source - The markdown to set
 * @param options - The visitor's options
 * @returns The prose of the walked document
 */
function set(source: string, options?: Parameters<typeof typography>[0]): string {
	return toPlainText(unwrap(Markdown.walk(parse(source), typography(options))));
}

describe("typography", () => {
	test("curls double and single quotes", () => {
		expect(set(`She said "hi" and 'bye'.`)).toBe("She said “hi” and ‘bye’.");
	});

	test("nests single quotes inside double quotes", () => {
		expect(set(`"She said 'hi' to me."`)).toBe("“She said ‘hi’ to me.”");
		expect(set(`"'Quoted,' he said"`)).toBe("“‘Quoted,’ he said”");
	});

	test("turns apostrophes in contractions, possessives and years into ’", () => {
		expect(set("don't stop, it's Sergio's and the students' book from the '90s")).toBe(
			"don’t stop, it’s Sergio’s and the students’ book from the ’90s",
		);
	});

	test("opens a quote after an opening bracket or a dash and closes one before punctuation", () => {
		expect(set(`("a") —"b", "c"!`)).toBe("(“a”) —“b”, “c”!");
	});

	test("decides a quote by the characters of neighbouring inline nodes", () => {
		expect(set(`"**bold**" and "[link](/a)" and *"inside"*`)).toBe(
			"“bold” and “link” and “inside”",
		);
		expect(set("a `code`'s value")).toBe("a code’s value");
	});

	test("turns double and triple hyphens into dashes and three dots into an ellipsis", () => {
		expect(set("pages 1--9 --- and then... nothing")).toBe("pages 1–9 — and then… nothing");
	});

	test("leaves code, inline code, raw HTML and code-like elements as written", () => {
		let document = parse(
			'`"a" -- b...`\n\n```\n"a" -- b...\n```\n\n<kbd>"Ctrl"--x</kbd>\n\n<div>"x"</div>',
		);
		let walked = unwrap(Markdown.walk(document, typography()));

		expect(walked).toBe(document);
	});

	test("sets the text inside an allowlisted prose element", () => {
		expect(set(`<abbr title="'t'">"GFM"</abbr>`)).toBe("“GFM”");
		let walked = unwrap(Markdown.walk(parse(`<abbr title="'t'">x</abbr>`), typography()));
		let paragraph = walked.children[0] as MarkdownTypes.Paragraph;

		expect(paragraph.children[0]).toMatchObject({ attributes: { title: "'t'" } });
	});

	test("sets headings, table cells and list items", () => {
		expect(set(`# "A"\n\n| "b" |\n| - |\n| c... |\n\n- d--e`)).toBe("“A”\n\n“b”\n\nc…\n\nd–e");
	});

	test("turns each rule off on its own", () => {
		let source = `"don't" -- wait...`;

		expect(set(source, { quotes: false })).toBe(`"don't" – wait…`);
		expect(set(source, { dashes: false })).toBe("“don’t” -- wait…");
		expect(set(source, { ellipses: false })).toBe("“don’t” – wait...");
	});

	test("uses a locale's quotes, keeping the apostrophe", () => {
		let options = { quotes: { double: ["«", "»"], single: ["‹", "›"] } } as const;

		expect(set(`"l'eau 'froide'"`, options)).toBe("«l’eau ‹froide›»");
	});

	test("returns a text node with nothing to change as the same object", () => {
		let document = parse('Plain words.\n\nA "quote" here and *plain* there.');
		let walked = unwrap(Markdown.walk(document, typography()));
		let before = document.children[1] as MarkdownTypes.Paragraph;
		let after = walked.children[1] as MarkdownTypes.Paragraph;

		expect(walked.children[0]).toBe(document.children[0]);
		expect(after).not.toBe(before);
		expect(after.children[0]).not.toBe(before.children[0]);
		expect(after.children[1]).toBe(before.children[1]);
		expect(after.children[2]).toBe(before.children[2]);
	});
});
