/**
 * Checks `{/* … *\/}` comments end to end: where the parser reads one as a block
 * and where as inline content, that every renderer leaves it out, and that writing
 * a document back keeps the author's notes in place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { toHTML } from "../html/index.js";
import { Markdown } from "../index.js";
import { toPlainText } from "../plain/index.js";

/**
 * @param source - The markdown to read
 * @returns The parsed document, failing the test when the parser rejected it
 */
function parse(source: string): Markdown.Document {
	return unwrap(Markdown.parse(source)).document;
}

/**
 * @param source - The markdown to read
 * @returns The message of the failure the parser reported
 */
function failure(source: string): Markdown.ParseError {
	let result = Markdown.parse(source);
	if (!isFailure(result)) throw new Error(`Expected ${JSON.stringify(source)} to fail`);
	return result.error;
}

/**
 * @param source - The markdown to read
 * @returns The source written back after a parse
 */
function roundTrip(source: string): string {
	return unwrap(Markdown.stringify(parse(source)));
}

describe("block comments", () => {
	test("a comment on its own line is a block", () => {
		let [comment, paragraph] = parse("{/* a note */}\n\nText").children;

		expect(comment).toEqual({
			type: "comment",
			value: " a note ",
			position: {
				start: { line: 1, column: 1, offset: 0 },
				end: { line: 1, column: 15, offset: 14 },
			},
		});
		expect(paragraph?.type).toBe("paragraph");
	});

	test("a comment spans lines, blank lines included", () => {
		let [comment, paragraph] = parse("{/*\nfirst\n\nsecond\n*/}\nText").children;

		expect(comment).toMatchObject({ type: "comment", value: "\nfirst\n\nsecond\n" });
		expect(paragraph).toMatchObject({ type: "paragraph" });
	});

	test("markdown inside a comment is never parsed", () => {
		let [comment] = parse("{/*\n# Heading\n<callout>\n*/}").children;

		expect(comment).toMatchObject({ type: "comment", value: "\n# Heading\n<callout>\n" });
	});

	test("a comment closes inside a block quote", () => {
		let [quote] = parse("> {/* a\n> b */}\n> Text").children;

		expect(quote).toMatchObject({
			type: "blockquote",
			children: [{ type: "comment", value: " a\nb " }, { type: "paragraph" }],
		});
	});

	test("an annotation above a comment decorates the block after it", () => {
		let [comment, paragraph] = parse("{% .lead %}\n{/* why */}\nText").children;

		expect(comment).toMatchObject({ type: "comment", value: " why " });
		expect(paragraph).toMatchObject({ type: "paragraph", attributes: { class: "lead" } });
	});

	test("an unclosed comment is a failure at the line it opened on", () => {
		let error = failure("Intro\n\n{/* never\nclosed");

		expect(error.message).toBe("A comment opened here is never closed");
		expect(error.position?.start.line).toBe(3);
	});

	test("text after the close of a multi-line comment is a failure", () => {
		let error = failure("{/* a\nb */} trailing");

		expect(error.message).toBe("A comment ends its line, so text after `*/}` goes on the next one");
		expect(error.position?.start.line).toBe(2);
	});

	test("a comment does not interrupt a paragraph", () => {
		let [paragraph] = parse("Text\n{/* note */}").children;

		expect(paragraph).toMatchObject({
			type: "paragraph",
			children: [{ type: "text" }, { type: "softBreak" }, { type: "comment", value: " note " }],
		});
	});

	test("an indented comment is code", () => {
		let [code] = parse("    {/* code */}").children;

		expect(code).toMatchObject({ type: "code", content: "{/* code */}\n" });
	});

	test("a fence keeps a comment as code", () => {
		let [code] = parse("```\n{/* code */}\n```").children;

		expect(code).toMatchObject({ type: "code", content: "{/* code */}\n" });
	});
});

describe("inline comments", () => {
	test("a comment inside a line sits between the text around it", () => {
		let [paragraph] = parse("Before {/* note */} after").children;

		expect(paragraph).toMatchObject({
			children: [
				{ type: "text", value: "Before " },
				{
					type: "comment",
					value: " note ",
					position: { start: { column: 8, offset: 7 }, end: { column: 20, offset: 19 } },
				},
				{ type: "text", value: " after" },
			],
		});
	});

	test("a comment opening a line with text after it is inline", () => {
		let [paragraph] = parse("{/* note */} after").children;

		expect(paragraph).toMatchObject({
			type: "paragraph",
			children: [{ type: "comment" }, { type: "text", value: " after" }],
		});
	});

	test("a comment inside a heading leaves the heading's text", () => {
		let [heading] = parse("## Title {/* draft */}").children;

		expect(heading).toMatchObject({
			type: "heading",
			children: [
				{ type: "text", value: "Title " },
				{ type: "comment", value: " draft " },
			],
		});
	});

	test("a code span keeps a comment as code", () => {
		let [paragraph] = parse("`{/* x */}`").children;

		expect(paragraph).toMatchObject({ children: [{ type: "inlineCode", value: "{/* x */}" }] });
	});

	test("an escaped brace is text", () => {
		let [paragraph] = parse("\\{/* x */}").children;

		expect(paragraph).toMatchObject({ children: [{ type: "text", value: "{/* x */}" }] });
	});

	test("an unclosed inline comment is a failure at its opening", () => {
		let error = failure("Text {/* never");

		expect(error.message).toBe("A comment opened here is never closed");
		expect(error.position?.start).toEqual({ line: 1, column: 6, offset: 5 });
	});
});

describe("rendering", () => {
	test("toHTML leaves block and inline comments out", () => {
		let document = parse("{/* block */}\n\nBefore {/* inline */}after");

		expect(toHTML(document)).toBe("<p>Before after</p>");
	});

	test("toPlainText leaves comments out", () => {
		let document = parse("{/* block */}\n\nBefore {/* inline */}after");

		expect(toPlainText(document)).toBe("Before after");
	});
});

describe("stringify", () => {
	test("writes a block comment back", () => {
		expect(roundTrip("{/* a note */}\n\nText")).toBe("{/* a note */}\n\nText\n");
	});

	test("writes a multi-line comment back verbatim", () => {
		expect(roundTrip("{/*\nfirst\n\nsecond\n*/}")).toBe("{/*\nfirst\n\nsecond\n*/}\n");
	});

	test("writes a comment inside a block quote back under its markers", () => {
		expect(roundTrip("> {/* a\n> b */}")).toBe("> {/* a\n> b */}\n");
	});

	test("writes an inline comment back", () => {
		expect(roundTrip("Before {/* note */} after")).toBe("Before {/* note */} after\n");
	});

	test("writes a tag whose inline content opens with a comment as inline content", () => {
		let options = { tags: { kbd: { content: "inline" } } } satisfies Markdown.Options;
		let document = unwrap(Markdown.parse("<kbd>{/* x */}K</kbd>", options)).document;

		let written = unwrap(Markdown.stringify(document));

		expect(written).toBe("<kbd>\n{/* x */}K\n</kbd>\n");
		expect(unwrap(Markdown.parse(written, options)).document.children[0]).toMatchObject({
			type: "tag",
			children: [{ type: "comment" }, { type: "text", value: "K" }],
		});
	});

	test("escapes text that would open a comment", () => {
		let document: Markdown.Document = {
			type: "document",
			position: parse("").position,
			children: [
				{
					type: "paragraph",
					attributes: {},
					position: parse("").position,
					children: [{ type: "text", value: "{/* x */}", position: parse("").position }],
				},
			],
		};

		let written = unwrap(Markdown.stringify(document));

		expect(written).toBe("\\{/\\* x \\*/}\n");
		expect(parse(written).children[0]).toMatchObject({
			children: [{ type: "text", value: "{/* x */}" }],
		});
	});
});
