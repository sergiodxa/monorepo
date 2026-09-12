/**
 * Tests for markdown serialization: the spelling each construct is normalized to,
 * the escapes that keep a hand-built `text` node from opening a construct, and the
 * frontmatter branch that is the only way writing a document fails.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Markdown } from "../index.js";

import { MarkdownStringifyError } from "./errors.js";
import { parseDocument } from "./parse.js";
import { stringifyDocument } from "./stringify.js";

/** A dummy span, since the serializer reads a node's fields and never its coordinates. */
function position(): Markdown.Position {
	let point = { line: 1, column: 1, offset: 0 };
	return { start: point, end: point };
}

/** A text node, which is the leaf almost every case in this file is built from. */
function text(value: string): Markdown.Text {
	return { type: "text", value, position: position() };
}

/** A paragraph over inline children, the block a case reaches for when it wants prose. */
function paragraph(...children: Markdown.Inline[]): Markdown.Paragraph {
	return { type: "paragraph", attributes: {}, children, position: position() };
}

/** A document over the blocks a case is about. */
function document(...children: Markdown.Block[]): Markdown.Document {
	return { type: "document", children, position: position() };
}

/**
 * Writes a document, failing the test when the frontmatter branch declines it.
 *
 * @param node - The document to write
 * @param options - Frontmatter to prepend
 * @returns The markdown source
 */
function write(node: Markdown.Document, options: Markdown.StringifyOptions = {}): string {
	let result = stringifyDocument(node, options);
	if (isFailure(result)) throw result.error;
	return result.data;
}

/** Writes one paragraph's inline children, which is where every inline case is checked. */
function inline(...children: Markdown.Inline[]): string {
	return write(document(paragraph(...children)));
}

/**
 * Writes a hand-built text node and reads the output back, which is the property the
 * escaper exists for rather than the particular backslashes it reaches for.
 *
 * @param value - The text a visitor could have left in the node
 * @returns The inline nodes a second parse of the output stands on
 */
function reread(value: string): Markdown.Inline[] {
	let parsed = parseDocument(inline(text(value)), {});
	if (isFailure(parsed)) throw parsed.error;

	let block = parsed.data.document.children[0];
	return block?.type === "paragraph" ? block.children : [];
}

describe("stringifyDocument", () => {
	describe("blocks", () => {
		test("writes an empty document as an empty string", () => {
			expect(write(document())).toBe("");
		});

		test("writes headings as ATX, one hash per level", () => {
			expect(
				write(
					document(
						{
							type: "heading",
							level: 1,
							attributes: {},
							children: [text("One")],
							position: position(),
						},
						{
							type: "heading",
							level: 3,
							attributes: {},
							children: [text("Three")],
							position: position(),
						},
					),
				),
			).toBe("# One\n\n### Three\n");
		});

		test("separates blocks with one blank line", () => {
			expect(write(document(paragraph(text("One")), paragraph(text("Two"))))).toBe("One\n\nTwo\n");
		});

		test("writes a fenced code block with its language as the info string", () => {
			expect(
				write(
					document({
						type: "code",
						language: "ts",
						content: "let a = 1;\n",
						attributes: {},
						position: position(),
					}),
				),
			).toBe("```ts\nlet a = 1;\n```\n");
		});

		test("writes a code block with no language and no content", () => {
			expect(
				write(document({ type: "code", content: "", attributes: {}, position: position() })),
			).toBe("```\n```\n");
		});

		test("switches a fence to tildes when the content holds a backtick run", () => {
			expect(
				write(
					document({
						type: "code",
						language: "md",
						content: "```js\nlet a = 1;\n```\n",
						attributes: {},
						position: position(),
					}),
				),
			).toBe("~~~md\n```js\nlet a = 1;\n```\n~~~\n");
		});

		test("writes a thematic break as three hyphens", () => {
			expect(write(document({ type: "thematicBreak", attributes: {}, position: position() }))).toBe(
				"---\n",
			);
		});

		test("writes an html block verbatim", () => {
			expect(
				write(
					document({
						type: "html",
						value: '<div class="x">\n  raw\n</div>',
						attributes: {},
						position: position(),
					}),
				),
			).toBe('<div class="x">\n  raw\n</div>\n');
		});

		test("prefixes every line of a block quote", () => {
			expect(
				write(
					document({
						type: "blockquote",
						attributes: {},
						children: [paragraph(text("One")), paragraph(text("Two"))],
						position: position(),
					}),
				),
			).toBe("> One\n>\n> Two\n");
		});

		test("opens an alert with its kind", () => {
			expect(
				write(
					document({
						type: "alert",
						kind: "warning",
						attributes: {},
						children: [paragraph(text("Careful"))],
						position: position(),
					}),
				),
			).toBe("> [!WARNING]\n> Careful\n");
		});

		test("writes a footnote definition with four-space continuation lines", () => {
			expect(
				write(
					document(
						paragraph(text("See"), {
							type: "footnoteReference",
							identifier: "1",
							position: position(),
						}),
						{
							type: "footnoteDefinition",
							identifier: "1",
							attributes: {},
							children: [paragraph(text("One")), paragraph(text("Two"))],
							position: position(),
						},
					),
				),
			).toBe("See[^1]\n\n[^1]: One\n\n    Two\n");
		});
	});

	describe("lists", () => {
		/** One list item over a single paragraph, which is what every list case is built from. */
		function item(value: string, checked?: boolean): Markdown.ListItem {
			return {
				type: "listItem",
				...(checked === undefined ? {} : { checked }),
				attributes: {},
				children: [paragraph(text(value))],
				position: position(),
			};
		}

		test("writes bullets with a hyphen and no blank line when tight", () => {
			expect(
				write(
					document({
						type: "list",
						ordered: false,
						tight: true,
						attributes: {},
						children: [item("One"), item("Two")],
						position: position(),
					}),
				),
			).toBe("- One\n- Two\n");
		});

		test("separates the items of a loose list with a blank line", () => {
			expect(
				write(
					document({
						type: "list",
						ordered: false,
						tight: false,
						attributes: {},
						children: [item("One"), item("Two")],
						position: position(),
					}),
				),
			).toBe("- One\n\n- Two\n");
		});

		test("numbers an ordered list from start", () => {
			expect(
				write(
					document({
						type: "list",
						ordered: true,
						start: 3,
						tight: true,
						attributes: {},
						children: [item("One"), item("Two")],
						position: position(),
					}),
				),
			).toBe("3. One\n4. Two\n");
		});

		test("draws the box a task list item carries", () => {
			expect(
				write(
					document({
						type: "list",
						ordered: false,
						tight: true,
						attributes: {},
						children: [item("Done", true), item("Todo", false)],
						position: position(),
					}),
				),
			).toBe("- [x] Done\n- [ ] Todo\n");
		});

		test("indents a nested list under the text its marker opened", () => {
			expect(
				write(
					document({
						type: "list",
						ordered: false,
						tight: true,
						attributes: {},
						children: [
							{
								type: "listItem",
								attributes: {},
								children: [
									paragraph(text("One")),
									{
										type: "list",
										ordered: false,
										tight: true,
										attributes: {},
										children: [item("Nested")],
										position: position(),
									},
								],
								position: position(),
							},
						],
						position: position(),
					}),
				),
			).toBe("- One\n  - Nested\n");
		});
	});

	describe("tables", () => {
		/** A cell over one text node, so a case reads as the grid it is describing. */
		function cell(value: string): Markdown.TableCell {
			return { type: "tableCell", attributes: {}, children: [text(value)], position: position() };
		}

		/** A row of cells, marked as the header when it is the one above the delimiter. */
		function row(header: boolean, ...values: string[]): Markdown.TableRow {
			return {
				type: "tableRow",
				header,
				attributes: {},
				children: values.map(cell),
				position: position(),
			};
		}

		test("pads cells to a common width per column", () => {
			expect(
				write(
					document({
						type: "table",
						align: [null, null],
						attributes: {},
						children: [row(true, "Plan", "Monitors"), row(false, "Free", "5")],
						position: position(),
					}),
				),
			).toBe("| Plan | Monitors |\n| ---- | -------- |\n| Free | 5        |\n");
		});

		test("writes each alignment in the delimiter row", () => {
			expect(
				write(
					document({
						type: "table",
						align: ["left", "center", "right"],
						attributes: {},
						children: [row(true, "Plan", "Monitors", "Price"), row(false, "Free", "5", "0")],
						position: position(),
					}),
				),
			).toBe(
				"| Plan | Monitors | Price |\n| :--- | :------: | ----: |\n| Free | 5        | 0     |\n",
			);
		});

		test("escapes a pipe inside a cell", () => {
			expect(
				write(
					document({
						type: "table",
						align: [null],
						attributes: {},
						children: [row(true, "a | b")],
						position: position(),
					}),
				),
			).toBe("| a \\| b |\n| ------ |\n");
		});
	});

	describe("inline", () => {
		test("writes emphasis, strong and strikethrough in one spelling each", () => {
			expect(
				inline(
					{ type: "emphasis", children: [text("a")], position: position() },
					text(" "),
					{ type: "strong", children: [text("b")], position: position() },
					text(" "),
					{ type: "strikethrough", children: [text("c")], position: position() },
				),
			).toBe("_a_ **b** ~~c~~\n");
		});

		test("writes emphasis with asterisks where an underscore would sit inside a word", () => {
			expect(
				inline(
					text("x"),
					{ type: "emphasis", children: [text("a")], position: position() },
					text("x"),
				),
			).toBe("x*a*x\n");
		});

		test("fences a code span longer than any backtick run inside it", () => {
			expect(inline({ type: "inlineCode", value: "a ` b", position: position() })).toBe(
				"``a ` b``\n",
			);
		});

		test("pads a code span that opens or closes on a backtick", () => {
			expect(inline({ type: "inlineCode", value: "`x`", position: position() })).toBe(
				"`` `x` ``\n",
			);
		});

		test("writes a link whose text is its destination as an autolink", () => {
			expect(
				inline({
					type: "link",
					href: "https://example.com",
					children: [text("https://example.com")],
					position: position(),
				}),
			).toBe("<https://example.com>\n");
		});

		test("writes a link with a title in the bracketed form", () => {
			expect(
				inline({
					type: "link",
					href: "/docs",
					title: "Docs",
					children: [text("Read")],
					position: position(),
				}),
			).toBe('[Read](/docs "Docs")\n');
		});

		test("angle-wraps a destination holding a space", () => {
			expect(
				inline({ type: "link", href: "/a b", children: [text("x")], position: position() }),
			).toBe("[x](</a b>)\n");
		});

		test("writes an image with its alternative text", () => {
			expect(
				inline({
					type: "image",
					src: "/i.png",
					title: "Shot",
					children: [text("Alt")],
					position: position(),
				}),
			).toBe('![Alt](/i.png "Shot")\n');
		});

		test("writes a variable back as the hole it came from", () => {
			expect(inline(text("Hello "), { type: "variable", name: "team", position: position() })).toBe(
				"Hello {% $team %}\n",
			);
		});

		test("writes inline html verbatim", () => {
			expect(inline({ type: "inlineHtml", value: "<br>", position: position() })).toBe("<br>\n");
		});

		test("writes a soft break as a newline and a hard break as a backslash", () => {
			expect(inline(text("a"), { type: "softBreak", position: position() }, text("b"))).toBe(
				"a\nb\n",
			);
			expect(inline(text("a"), { type: "hardBreak", position: position() }, text("b"))).toBe(
				"a\\\nb\n",
			);
		});
	});

	describe("escaping", () => {
		test("escapes the characters CommonMark reads anywhere", () => {
			expect(inline(text("a*b_c`d[e]f\\g"))).toBe("a\\*b\\_c\\`d\\[e\\]f\\\\g\n");
		});

		test("escapes a line-leading block marker", () => {
			expect(inline(text("# not a heading"))).toBe("\\# not a heading\n");
			expect(inline(text("> not a quote"))).toBe("\\> not a quote\n");
			expect(inline(text("+ not a bullet"))).toBe("\\+ not a bullet\n");
			expect(inline(text("- not a bullet"))).toBe("\\- not a bullet\n");
			expect(inline(text("= not a heading"))).toBe("\\= not a heading\n");
		});

		test("escapes a line-leading ordered marker on its delimiter", () => {
			expect(inline(text("1. not a list"))).toBe("1\\. not a list\n");
			expect(inline(text("12) not a list"))).toBe("12\\) not a list\n");
		});

		test("leaves a block marker alone once a line is underway", () => {
			expect(inline(text("a"), { type: "softBreak", position: position() }, text("b - c"))).toBe(
				"a\nb - c\n",
			);
		});

		test("escapes the annotation opener, which covers variables too", () => {
			expect(inline(text("{% $9 %}"))).toBe("\\{% $9 %}\n");
		});

		test("escapes a less-than sign without knowing which tags are registered", () => {
			expect(inline(text("<callout>"))).toBe("\\<callout>\n");
		});

		test("leaves a pipe alone outside a table", () => {
			expect(inline(text("a | b"))).toBe("a | b\n");
		});
	});

	describe("annotations", () => {
		test("writes a heading's annotation after its text", () => {
			expect(
				write(
					document({
						type: "heading",
						level: 2,
						attributes: { id: "install", class: "lead wide" },
						children: [text("Installing")],
						position: position(),
					}),
				),
			).toBe("## Installing {% #install .lead .wide %}\n");
		});

		test("writes a fence's annotation in its info string", () => {
			expect(
				write(
					document({
						type: "code",
						language: "tsx",
						content: "let a = 1;\n",
						attributes: { path: "app.tsx", lines: 4, wide: true },
						position: position(),
					}),
				),
			).toBe('```tsx {% path="app.tsx" lines={4} wide %}\nlet a = 1;\n```\n');
		});

		test("writes a table's annotation on the line above it", () => {
			expect(
				write(
					document({
						type: "table",
						align: [null],
						attributes: { class: "wide" },
						children: [
							{
								type: "tableRow",
								header: true,
								attributes: {},
								children: [
									{
										type: "tableCell",
										attributes: {},
										children: [text("Plan")],
										position: position(),
									},
								],
								position: position(),
							},
						],
						position: position(),
					}),
				),
			).toBe("{% .wide %}\n| Plan |\n| ---- |\n");
		});

		test("writes a paragraph's annotation on the line above it", () => {
			expect(
				write(
					document({
						type: "paragraph",
						attributes: { class: "lead" },
						children: [text("Lead")],
						position: position(),
					}),
				),
			).toBe("{% .lead %}\nLead\n");
		});

		test("writes an attribute that cannot take a shorthand as a pair", () => {
			expect(
				write(
					document({
						type: "paragraph",
						attributes: { id: 4, class: "a.b" },
						children: [text("x")],
						position: position(),
					}),
				),
			).toBe('{% id={4} class="a.b" %}\nx\n');
		});
	});

	describe("tags", () => {
		test("writes a block tag as an element around its blocks", () => {
			expect(
				write(
					document({
						type: "tag",
						name: "callout",
						attributes: { type: "warning" },
						children: [paragraph(text("Heads up"))],
						position: position(),
					}),
				),
			).toBe('<callout type="warning">\nHeads up\n</callout>\n');
		});

		test("writes a tag with no children self-closing", () => {
			expect(
				write(
					document({
						type: "tag",
						name: "video",
						attributes: { src: "/demo.mp4", autoplay: true },
						children: [],
						position: position(),
					}),
				),
			).toBe('<video src="/demo.mp4" autoplay />\n');
		});

		test("writes an inline tag inside the line it sits on", () => {
			expect(
				inline(text("Press "), {
					type: "tag",
					name: "kbd",
					attributes: {},
					children: [text("Cmd")],
					position: position(),
				}),
			).toBe("Press <kbd>Cmd</kbd>\n");
		});

		test("writes a block-level tag whose children are inline on its own lines", () => {
			expect(
				write(
					document({
						type: "tag",
						name: "kbd",
						attributes: {},
						children: [text("Cmd")],
						position: position(),
					}),
				),
			).toBe("<kbd>\nCmd\n</kbd>\n");
		});
	});

	describe("the text a visitor leaves behind", () => {
		test("reads a strikethrough spelling back as the text it was", () => {
			expect(reread("~~gone~~")).toEqual([
				expect.objectContaining({ type: "text", value: "~~gone~~" }),
			]);
		});

		test("reads a bare URL back as the text it was", () => {
			expect(reread("https://example.com")).toEqual([
				expect.objectContaining({ type: "text", value: "https://example.com" }),
			]);
		});

		test("reads a bare host back as the text it was", () => {
			expect(reread("www.example.com")).toEqual([
				expect.objectContaining({ type: "text", value: "www.example.com" }),
			]);
		});

		test("reads a bare address back as the text it was", () => {
			expect(reread("a@b.com")).toEqual([
				expect.objectContaining({ type: "text", value: "a@b.com" }),
			]);
		});

		test("reads a sentence back with the punctuation it was written with", () => {
			expect(inline(text("Plans start at $5/month."))).toBe("Plans start at $5/month.\n");
			expect(inline(text("See section 3.2."))).toBe("See section 3.2.\n");
			expect(reread("See section 3.2.")).toEqual([
				expect.objectContaining({ type: "text", value: "See section 3.2." }),
			]);
		});
	});

	describe("frontmatter", () => {
		test("prepends the block ahead of the body", () => {
			expect(
				write(
					document({
						type: "heading",
						level: 1,
						attributes: {},
						children: [text("Hi")],
						position: position(),
					}),
					{ frontmatter: { title: "Hello" } },
				),
			).toBe("---\ntitle: Hello\n---\n\n# Hi\n");
		});

		test("writes the block alone when the document is empty", () => {
			expect(write(document(), { frontmatter: { title: "Hello" } })).toBe(
				"---\ntitle: Hello\n---\n",
			);
		});

		test("writes the body alone when no frontmatter is given", () => {
			expect(write(document(paragraph(text("Body"))))).toBe("Body\n");
		});

		test("fails on a value YAML cannot write", () => {
			let result = stringifyDocument(document(), { frontmatter: { count: 1n } });

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) return;
			expect(result.error).toBeInstanceOf(MarkdownStringifyError);
			expect(result.error.cause).toBeDefined();
		});
	});
});
