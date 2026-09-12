/**
 * Tests the block writer: the spelling each construct is normalized to, the fence
 * a code block sizes to its own content, the spacing and markers a list draws, the
 * padding a table takes, and where an annotation lands on each of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Markdown } from "../../index.js";

import { stringifyBlocks } from "./block.js";

/** A dummy span, since the writer reads a node's fields and never its coordinates. */
function position(): Markdown.Position {
	let point = { line: 1, column: 1, offset: 0 };
	return { start: point, end: point };
}

/** The leaf almost every case in this file is built from. */
function text(value: string): Markdown.Text {
	return { type: "text", value, position: position() };
}

/** A paragraph of plain words, which is the cheapest block to put somewhere. */
function paragraph(value: string, attributes: Markdown.Attributes = {}): Markdown.Paragraph {
	return { type: "paragraph", attributes, children: [text(value)], position: position() };
}

/** One list item over the blocks it holds, checked only where a case is about a task box. */
function item(children: Markdown.Block[], checked?: boolean): Markdown.ListItem {
	return { type: "listItem", checked, attributes: {}, children, position: position() };
}

/** A cell of plain words, which is all a table case needs to measure a column by. */
function cell(value: string): Markdown.TableCell {
	return { type: "tableCell", attributes: {}, children: [text(value)], position: position() };
}

/** A row of plain cells, marked as the header where the delimiter row would put one. */
function row(header: boolean, ...values: string[]): Markdown.TableRow {
	return {
		type: "tableRow",
		header,
		attributes: {},
		children: values.map(cell),
		position: position(),
	};
}

/** Writes a run of blocks the way a document does. */
function write(...nodes: Markdown.Block[]): string {
	return stringifyBlocks(nodes);
}

describe("stringifyBlocks", () => {
	test("writes an empty run as an empty string", () => {
		expect(write()).toBe("");
	});

	test("separates two blocks with one blank line", () => {
		expect(write(paragraph("One."), paragraph("Two."))).toBe("One.\n\nTwo.");
	});

	test("separates blocks with whatever a caller asked for instead", () => {
		expect(stringifyBlocks([paragraph("One."), paragraph("Two.")], "\n")).toBe("One.\nTwo.");
	});

	test("drops a block that writes nothing rather than leaving a gap for it", () => {
		expect(
			write(paragraph("One."), { type: "html", value: "", attributes: {}, position: position() }),
		).toBe("One.");
	});

	describe("headings", () => {
		test("writes a heading as one hash per level", () => {
			expect(
				write({
					type: "heading",
					level: 4,
					attributes: {},
					children: [text("Setup")],
					position: position(),
				}),
			).toBe("#### Setup");
		});

		test("folds a heading that spans two lines onto one", () => {
			expect(
				write({
					type: "heading",
					level: 1,
					attributes: {},
					children: [text("One"), { type: "softBreak", position: position() }, text("Two")],
					position: position(),
				}),
			).toBe("# One Two");
		});

		test("treats a heading's text as mid-line, since no block opens inside one", () => {
			expect(
				write({
					type: "heading",
					level: 2,
					attributes: {},
					children: [text("- not a bullet")],
					position: position(),
				}),
			).toBe("## - not a bullet");
		});

		test("puts a heading's annotation after its text, on the same line", () => {
			expect(
				write({
					type: "heading",
					level: 2,
					attributes: { id: "setup" },
					children: [text("Setup")],
					position: position(),
				}),
			).toBe("## Setup {% #setup %}");
		});
	});

	describe("paragraphs", () => {
		test("writes a paragraph as the inline run it holds", () => {
			expect(write(paragraph("Plain words."))).toBe("Plain words.");
		});

		test("treats a paragraph's first node as the opener of a line", () => {
			expect(write(paragraph("# not a heading"))).toBe("\\# not a heading");
		});

		test("puts a paragraph's annotation on the line above it", () => {
			expect(write(paragraph("Plain words.", { class: "lead" }))).toBe("{% .lead %}\nPlain words.");
		});
	});

	describe("code blocks", () => {
		test("writes a fence of backticks around the content, with the language as its info", () => {
			expect(
				write({
					type: "code",
					language: "ts",
					content: "let a = 1;\n",
					attributes: {},
					position: position(),
				}),
			).toBe("```ts\nlet a = 1;\n```");
		});

		test("absorbs the newline the content already ends on", () => {
			expect(write({ type: "code", content: "a\n", attributes: {}, position: position() })).toBe(
				"```\na\n```",
			);

			expect(write({ type: "code", content: "a", attributes: {}, position: position() })).toBe(
				"```\na\n```",
			);
		});

		test("keeps a blank line the content ends on, which is content of its own", () => {
			expect(write({ type: "code", content: "a\n\n", attributes: {}, position: position() })).toBe(
				"```\na\n\n```",
			);
		});

		test("writes an empty code block as two fences", () => {
			expect(write({ type: "code", content: "", attributes: {}, position: position() })).toBe(
				"```\n```",
			);
		});

		test("keeps backticks while the content's longest run stays under the fence", () => {
			expect(write({ type: "code", content: "a `` b", attributes: {}, position: position() })).toBe(
				"```\na `` b\n```",
			);
		});

		test("switches to tildes once the content holds a fence-length backtick run", () => {
			expect(
				write({
					type: "code",
					language: "md",
					content: "```js\nlet a = 1;\n```\n",
					attributes: {},
					position: position(),
				}),
			).toBe("~~~md\n```js\nlet a = 1;\n```\n~~~");
		});

		test("outgrows the longest tilde run once it has switched to tildes", () => {
			expect(
				write({
					type: "code",
					content: "```\n~~~~\n",
					attributes: {},
					position: position(),
				}),
			).toBe("~~~~~\n```\n~~~~\n~~~~~");
		});

		test("switches to tildes once the info string itself carries a backtick", () => {
			expect(
				write({
					type: "code",
					content: "let a = 1;\n",
					attributes: { title: "a `b` c" },
					position: position(),
				}),
			).toBe('~~~{% title="a `b` c" %}\nlet a = 1;\n~~~');
		});

		test("writes a code block's annotation in its info string, after the language", () => {
			expect(
				write({
					type: "code",
					language: "ts",
					content: "let a = 1;\n",
					attributes: { path: "src/index.ts" },
					position: position(),
				}),
			).toBe('```ts {% path="src/index.ts" %}\nlet a = 1;\n```');
		});
	});

	describe("lists", () => {
		test("writes a bullet list with a hyphen and no blank line when it is tight", () => {
			expect(
				write({
					type: "list",
					ordered: false,
					tight: true,
					attributes: {},
					children: [item([paragraph("One")]), item([paragraph("Two")])],
					position: position(),
				}),
			).toBe("- One\n- Two");
		});

		test("separates the items of a loose list with a blank line", () => {
			expect(
				write({
					type: "list",
					ordered: false,
					tight: false,
					attributes: {},
					children: [item([paragraph("One")]), item([paragraph("Two")])],
					position: position(),
				}),
			).toBe("- One\n\n- Two");
		});

		test("numbers an ordered list from one where it names no start", () => {
			expect(
				write({
					type: "list",
					ordered: true,
					tight: true,
					attributes: {},
					children: [item([paragraph("One")]), item([paragraph("Two")])],
					position: position(),
				}),
			).toBe("1. One\n2. Two");
		});

		test("counts an ordered list up from the start it names", () => {
			expect(
				write({
					type: "list",
					ordered: true,
					start: 7,
					tight: true,
					attributes: {},
					children: [item([paragraph("Seven")]), item([paragraph("Eight")])],
					position: position(),
				}),
			).toBe("7. Seven\n8. Eight");
		});

		test("draws the box a task item carries, and none where it carries none", () => {
			expect(
				write({
					type: "list",
					ordered: false,
					tight: true,
					attributes: {},
					children: [
						item([paragraph("Done")], true),
						item([paragraph("Pending")], false),
						item([paragraph("Plain")]),
					],
					position: position(),
				}),
			).toBe("- [x] Done\n- [ ] Pending\n- Plain");
		});

		test("indents an item's later lines under the text its marker opened", () => {
			expect(
				write({
					type: "list",
					ordered: true,
					start: 9,
					tight: false,
					attributes: {},
					children: [item([paragraph("One"), paragraph("Still one")])],
					position: position(),
				}),
			).toBe("9. One\n\n   Still one");
		});

		test("writes a bare list item with the bullet a list would have given it", () => {
			expect(write(item([paragraph("Alone")]))).toBe("- Alone");
		});
	});

	describe("block quotes and alerts", () => {
		test("puts the quote marker in front of every line", () => {
			expect(
				write({
					type: "blockquote",
					attributes: {},
					children: [paragraph("One."), paragraph("Two.")],
					position: position(),
				}),
			).toBe("> One.\n>\n> Two.");
		});

		test("opens an alert with the kind it carries, in upper case", () => {
			expect(
				write({
					type: "alert",
					kind: "warning",
					attributes: {},
					children: [paragraph("Careful.")],
					position: position(),
				}),
			).toBe("> [!WARNING]\n> Careful.");
		});

		test("writes an alert that holds nothing as its marker line alone", () => {
			expect(
				write({ type: "alert", kind: "note", attributes: {}, children: [], position: position() }),
			).toBe("> [!NOTE]");
		});

		test("puts a quote's annotation on the line above the marker", () => {
			expect(
				write({
					type: "blockquote",
					attributes: { class: "aside" },
					children: [paragraph("One.")],
					position: position(),
				}),
			).toBe("{% .aside %}\n> One.");
		});
	});

	describe("tables", () => {
		test("pads every cell of a column to one width", () => {
			expect(
				write({
					type: "table",
					align: [null, null],
					attributes: {},
					children: [row(true, "language", "ext"), row(false, "ts", "tsx")],
					position: position(),
				}),
			).toBe("| language | ext |\n| -------- | --- |\n| ts       | tsx |");
		});

		test("draws a column at least as wide as its delimiter needs", () => {
			expect(
				write({
					type: "table",
					align: [null],
					attributes: {},
					children: [row(true, "a")],
					position: position(),
				}),
			).toBe("| a   |\n| --- |");
		});

		test("writes each alignment as the colons that stand for it", () => {
			expect(
				write({
					type: "table",
					align: ["left", "center", "right", null],
					attributes: {},
					children: [row(true, "a", "b", "c", "d")],
					position: position(),
				}),
			).toBe("| a   | b   | c   | d   |\n| :-- | :-: | --: | --- |");
		});

		test("pads a row that runs short of the column count", () => {
			expect(
				write({
					type: "table",
					align: [null, null],
					attributes: {},
					children: [row(true, "a", "b"), row(false, "c")],
					position: position(),
				}),
			).toBe("| a   | b   |\n| --- | --- |\n| c   |     |");
		});

		test("escapes a pipe a cell holds, so it never ends the cell early", () => {
			expect(
				write({
					type: "table",
					align: [null],
					attributes: {},
					children: [row(true, "a | b")],
					position: position(),
				}),
			).toBe("| a \\| b |\n| ------ |");
		});

		test("puts a table's annotation on the line above it", () => {
			expect(
				write({
					type: "table",
					align: [null],
					attributes: { class: "wide" },
					children: [row(true, "a")],
					position: position(),
				}),
			).toBe("{% .wide %}\n| a   |\n| --- |");
		});

		test("writes a bare row on its own, sized to the cells it holds", () => {
			expect(write(row(false, "one", "b"))).toBe("| one | b   |");
		});

		test("writes a bare cell as the inline run it holds", () => {
			expect(write(cell("one"))).toBe("one");
		});
	});

	describe("leaves", () => {
		test("writes a thematic break as three hyphens", () => {
			expect(write({ type: "thematicBreak", attributes: {}, position: position() })).toBe("---");
		});

		test("writes an html block verbatim, escaping nothing inside it", () => {
			expect(
				write({
					type: "html",
					value: "<div class='x'>\n\ttext\n</div>",
					attributes: {},
					position: position(),
				}),
			).toBe("<div class='x'>\n\ttext\n</div>");
		});

		test("puts a thematic break's annotation on the line above it", () => {
			expect(
				write({ type: "thematicBreak", attributes: { id: "split" }, position: position() }),
			).toBe("{% #split %}\n---");
		});
	});

	describe("footnote definitions", () => {
		test("writes the body on the label's own line", () => {
			expect(
				write({
					type: "footnoteDefinition",
					identifier: "note",
					attributes: {},
					children: [paragraph("The body.")],
					position: position(),
				}),
			).toBe("[^note]: The body.");
		});

		test("indents the continuation lines four spaces, so they stay with the label", () => {
			expect(
				write({
					type: "footnoteDefinition",
					identifier: "note",
					attributes: {},
					children: [paragraph("First."), paragraph("Second.")],
					position: position(),
				}),
			).toBe("[^note]: First.\n\n    Second.");
		});

		test("writes a definition that holds nothing as the label alone", () => {
			expect(
				write({
					type: "footnoteDefinition",
					identifier: "note",
					attributes: {},
					children: [],
					position: position(),
				}),
			).toBe("[^note]:");
		});
	});

	describe("tags", () => {
		test("writes a block tag around the blocks it holds, on their own lines", () => {
			expect(
				write({
					type: "tag",
					name: "Callout",
					attributes: {},
					children: [paragraph("One."), paragraph("Two.")],
					position: position(),
				}),
			).toBe("<Callout>\nOne.\n\nTwo.\n</Callout>");
		});

		test("writes a tag that holds nothing as self-closing", () => {
			expect(
				write({ type: "tag", name: "Divider", attributes: {}, children: [], position: position() }),
			).toBe("<Divider />");
		});

		test("writes a tag whose children are inline on lines of its own", () => {
			expect(
				write({
					type: "tag",
					name: "Callout",
					attributes: {},
					children: [text("Careful.")],
					position: position(),
				}),
			).toBe("<Callout>\nCareful.\n</Callout>");
		});

		test("writes a tag's attributes as pairs, since a tag takes no shorthands", () => {
			expect(
				write({
					type: "tag",
					name: "Callout",
					attributes: { id: "first", kind: "tip", wrap: true },
					children: [paragraph("One.")],
					position: position(),
				}),
			).toBe('<Callout id="first" kind="tip" wrap>\nOne.\n</Callout>');
		});
	});
});
