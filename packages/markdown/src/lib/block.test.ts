/**
 * The block phase over the whole dialect: CommonMark's containers and leaves,
 * GitHub's tables, tasks, alerts and footnotes, and this dialect's annotations
 * and block tags. Every assertion is block structure, which is what this phase owns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import type { Markdown } from "../index.js";

import { parseBlocks } from "./block.js";
import { resolveOptions } from "./options.js";

/** Where every fixture's body begins, since none of them carries frontmatter. */
const START: Markdown.Point = { line: 1, column: 1, offset: 0 };

/** The tags the dialect fixtures register, covering all three kinds of content. */
const TAGS: NonNullable<Markdown.Options["tags"]> = {
	callout: { attributes: s.object({ type: s.union([s.literal("info"), s.literal("warn")]) }) },
	note: {},
	kbd: { content: "inline" },
	video: { content: "none", attributes: s.object({ src: s.string() }) },
};

/**
 * @param source - The body to parse
 * @param tags - The tags the document may use
 * @returns The parse result, failure included
 */
function read(source: string, tags: Markdown.Options["tags"] = {}) {
	return parseBlocks(source, START, resolveOptions({ tags }));
}

/**
 * @param source - The body to parse
 * @param tags - The tags the document may use
 * @returns The document, throwing whatever the parser rejected
 */
function parse(source: string, tags: Markdown.Options["tags"] = {}): Markdown.Document {
	return unwrap(read(source, tags));
}

/**
 * Reaches a nested block by index, which keeps the structural assertions below
 * to one line each.
 *
 * @param node - Where to start descending
 * @param path - The child index to take at each level
 * @returns The node at that path
 */
function at(node: Markdown.Node, ...path: number[]): Markdown.Node {
	let current = node;

	for (let index of path) {
		let children = (current as { children?: Markdown.Node[] }).children ?? [];
		current = children[index] as Markdown.Node;
	}

	return current;
}

/**
 * @param node - Any parent node
 * @returns The `type` of each of its children, in order
 */
function types(node: Markdown.Node): string[] {
	let children = (node as { children?: Markdown.Node[] }).children ?? [];

	return children.map((child) => child.type);
}

describe("headings", () => {
	test("reads an ATX heading at every level", () => {
		let document = parse("# one\n\n###### six\n");

		expect(types(document)).toEqual(["heading", "heading"]);
		expect(at(document, 0)).toMatchObject({ type: "heading", level: 1, attributes: {} });
		expect(at(document, 1)).toMatchObject({ type: "heading", level: 6 });
	});

	test("drops an ATX closing sequence", () => {
		let document = parse("## two ##\n");

		expect(at(document, 0)).toMatchObject({ type: "heading", level: 2 });
		expect(at(document, 0, 0)).toMatchObject({ type: "text", value: "two" });
	});

	test("reads a setext heading from the paragraph above its underline", () => {
		let document = parse("Title\n===\n\nOther\n---\n");

		expect(types(document)).toEqual(["heading", "heading"]);
		expect(at(document, 0)).toMatchObject({ type: "heading", level: 1 });
		expect(at(document, 1)).toMatchObject({ type: "heading", level: 2 });
	});

	test("leaves seven hashes as a paragraph", () => {
		expect(types(parse("####### seven\n"))).toEqual(["paragraph"]);
	});
});

describe("code blocks", () => {
	test("reads a fenced block's language and content", () => {
		let document = parse("```ts\nlet a = 1;\n```\n");

		expect(at(document, 0)).toMatchObject({
			type: "code",
			language: "ts",
			content: "let a = 1;\n",
			attributes: {},
		});
	});

	test("resolves the escapes an info string carries", () => {
		let document = parse("``` foo\\+bar\nfoo\n```\n");

		expect(at(document, 0)).toMatchObject({ type: "code", language: "foo+bar" });
	});

	test("resolves the character references an info string carries", () => {
		let document = parse("``` f&ouml;&ouml;\nfoo\n```\n");

		expect(at(document, 0)).toMatchObject({ type: "code", language: "föö" });
	});

	test("keeps every word of an info string, since a renderer chooses what names a language", () => {
		let document = parse("``` ruby startline=3\nfoo\n```\n");

		expect(at(document, 0)).toMatchObject({ type: "code", language: "ruby startline=3" });
	});

	test("reads a tilde fence, so a backtick line inside it stays content", () => {
		let document = parse("~~~\n```\n~~~\n");

		expect(at(document, 0)).toMatchObject({ type: "code", content: "```\n" });
		expect(at(document, 0)).not.toHaveProperty("language");
	});

	test("strips the fence's own indentation from its content", () => {
		let document = parse("  ```\n   two\n  one\n  ```\n");

		expect(at(document, 0)).toMatchObject({ type: "code", content: " two\none\n" });
	});

	test("reads an indented block with no language", () => {
		let document = parse("    one\n    two\n");

		expect(at(document, 0)).toMatchObject({ type: "code", content: "one\ntwo\n", attributes: {} });
		expect(at(document, 0)).not.toHaveProperty("language");
	});

	test("keeps an unclosed fence, ending it at the file", () => {
		let document = parse("```\nbody\n");

		expect(at(document, 0)).toMatchObject({ type: "code", content: "body\n" });
	});
});

describe("lists", () => {
	test("reads a bullet list with no blank lines as tight", () => {
		let document = parse("- a\n- b\n");

		expect(at(document, 0)).toMatchObject({ type: "list", ordered: false, tight: true });
		expect(types(at(document, 0))).toEqual(["listItem", "listItem"]);
		expect(at(document, 0)).not.toHaveProperty("start");
	});

	test("reads a blank line between items as loose", () => {
		expect(at(parse("- a\n\n- b\n"), 0)).toMatchObject({ type: "list", tight: false });
	});

	test("keeps an ordered list's start number", () => {
		let document = parse("5. five\n6. six\n");

		expect(at(document, 0)).toMatchObject({ type: "list", ordered: true, start: 5, tight: true });
	});

	test("starts a new list when the marker changes", () => {
		let document = parse("- a\n* b\n");

		expect(types(document)).toEqual(["list", "list"]);
	});

	test("nests a list inside the item that indents it", () => {
		let document = parse("- a\n  - b\n");

		expect(types(at(document, 0, 0))).toEqual(["paragraph", "list"]);
		expect(at(document, 0, 0, 1, 0)).toMatchObject({ type: "listItem" });
	});

	test("reads a task list item's box and drops the marker", () => {
		let document = parse("- [x] done\n- [ ] todo\n- plain\n");

		expect(at(document, 0, 0)).toMatchObject({ type: "listItem", checked: true });
		expect(at(document, 0, 1)).toMatchObject({ type: "listItem", checked: false });
		expect(at(document, 0, 2)).not.toHaveProperty("checked");
		expect(at(document, 0, 0, 0, 0)).toMatchObject({ type: "text", value: "done" });
	});
});

describe("block quotes and alerts", () => {
	test("reads a quote and its lazy continuation", () => {
		let document = parse("> a\nb\n");

		expect(types(document)).toEqual(["blockquote"]);
		expect(types(at(document, 0))).toEqual(["paragraph"]);
	});

	test("reads a quote whose first line is an alert marker as an alert", () => {
		let document = parse("> [!WARNING]\n> careful\n");

		expect(at(document, 0)).toMatchObject({ type: "alert", kind: "warning" });
		expect(types(at(document, 0))).toEqual(["paragraph"]);
		expect(at(document, 0, 0, 0)).toMatchObject({ type: "text", value: "careful" });
	});

	test("reads every alert kind, however the marker is cased", () => {
		for (let [marker, kind] of [
			["[!NOTE]", "note"],
			["[!tip]", "tip"],
			["[!Important]", "important"],
			["[!CAUTION]", "caution"],
		]) {
			expect(at(parse(`> ${marker}\n> body\n`), 0)).toMatchObject({ type: "alert", kind });
		}
	});

	test("leaves a quote without a marker a block quote", () => {
		expect(at(parse("> plain\n"), 0)).toMatchObject({ type: "blockquote" });
	});

	test("nests a quote inside a quote", () => {
		let document = parse("> > deep\n");

		expect(types(at(document, 0))).toEqual(["blockquote"]);
	});
});

describe("thematic breaks and HTML", () => {
	test("reads each thematic break marker", () => {
		let document = parse("***\n\n---\n\n___\n");

		expect(types(document)).toEqual(["thematicBreak", "thematicBreak", "thematicBreak"]);
		expect(at(document, 0)).toMatchObject({ type: "thematicBreak", attributes: {} });
	});

	test("reads a block-level element as raw HTML", () => {
		let document = parse("<div>\nraw\n</div>\n\nafter\n");

		expect(types(document)).toEqual(["html", "paragraph"]);
		expect(at(document, 0)).toMatchObject({ type: "html", value: "<div>\nraw\n</div>\n" });
	});

	test("ends a script block on its closing marker rather than a blank line", () => {
		let document = parse("<pre>\n\nx\n</pre>\nafter\n");

		expect(types(document)).toEqual(["html", "paragraph"]);
		expect(at(document, 0)).toMatchObject({ type: "html", value: "<pre>\n\nx\n</pre>\n" });
	});

	test("reads a comment as its own block", () => {
		expect(at(parse("<!-- hi -->\n"), 0)).toMatchObject({ type: "html" });
	});
});

describe("tables", () => {
	test("reads a header row, a delimiter row and body rows", () => {
		let document = parse("| a | b |\n| - | - |\n| 1 | 2 |\n");

		expect(at(document, 0)).toMatchObject({ type: "table", align: [null, null] });
		expect(types(at(document, 0))).toEqual(["tableRow", "tableRow"]);
		expect(at(document, 0, 0)).toMatchObject({ type: "tableRow", header: true });
		expect(at(document, 0, 1)).toMatchObject({ type: "tableRow", header: false });
		expect(types(at(document, 0, 1))).toEqual(["tableCell", "tableCell"]);
	});

	test("reads one alignment per column", () => {
		let document = parse("| a | b | c | d |\n| :- | -: | :-: | - |\n");

		expect(at(document, 0)).toMatchObject({ align: ["left", "right", "center", null] });
	});

	test("pads a short row and cuts a long one to the header's width", () => {
		let document = parse("| a | b |\n| - | - |\n| 1 |\n| 1 | 2 | 3 |\n");

		expect(types(at(document, 0, 1))).toEqual(["tableCell", "tableCell"]);
		expect(types(at(document, 0, 2))).toEqual(["tableCell", "tableCell"]);
		expect(types(at(document, 0, 1, 1))).toEqual([]);
	});

	test("reads an escaped pipe as cell content", () => {
		let document = parse("| a |\n| - |\n| x \\| y |\n");

		expect(types(at(document, 0, 1))).toEqual(["tableCell"]);
		expect(at(document, 0, 1, 0, 0)).toMatchObject({ type: "text", value: "x | y" });
	});

	test("leaves a delimiter row whose width disagrees a paragraph", () => {
		expect(types(parse("| a | b |\n| - |\n"))).toEqual(["paragraph"]);
	});

	test("ends the table where another block begins", () => {
		let document = parse("| a |\n| - |\n| 1 |\n> quoted\n");

		expect(types(document)).toEqual(["table", "blockquote"]);
	});
});

describe("link reference definitions", () => {
	test("takes a definition out of the tree", () => {
		let document = parse('[ref]: /target "Title"\n\ntext\n');

		expect(types(document)).toEqual(["paragraph"]);
		expect(at(document, 0, 0)).toMatchObject({ type: "text", value: "text" });
	});

	test("takes several definitions off the front of one paragraph", () => {
		let document = parse("[a]: /a\n[b]: /b\nprose\n");

		expect(types(document)).toEqual(["paragraph"]);
		expect(at(document, 0).position.start.line).toBe(3);
	});

	test("resolves a reference defined below the link that uses it", () => {
		let document = parse("[text][ref]\n\n[ref]: /target\n");

		expect(types(document)).toEqual(["paragraph"]);
		expect(at(document, 0, 0)).toMatchObject({ type: "link", href: "/target" });
	});

	test("resolves the character references a destination and a title carry", () => {
		let document = parse('[foo]\n\n[foo]: /f&ouml;&ouml; "f&ouml;&ouml;"\n');

		expect(at(document, 0, 0)).toMatchObject({ type: "link", href: "/föö", title: "föö" });
	});

	test("resolves the escapes a destination and a title carry", () => {
		let document = parse('[foo]\n\n[foo]: /foo\\+bar "a \\"quote\\""\n');

		expect(at(document, 0, 0)).toMatchObject({
			type: "link",
			href: "/foo+bar",
			title: 'a "quote"',
		});
	});

	test("keeps the first definition of a repeated label", () => {
		let document = parse("[ref]: /first\n[ref]: /second\n\n[text][ref]\n");

		expect(at(document, 0, 0)).toMatchObject({ type: "link", href: "/first" });
	});
});

describe("footnote definitions", () => {
	test("opens a container whose identifier is the normalized label", () => {
		let document = parse("[^Note]: body\n");

		expect(at(document, 0)).toMatchObject({ type: "footnoteDefinition", identifier: "note" });
		expect(types(at(document, 0))).toEqual(["paragraph"]);
	});

	test("takes an indented continuation as another block of the definition", () => {
		let document = parse("[^a]: one\n\n    two\n\nafter\n");

		expect(types(document)).toEqual(["footnoteDefinition", "paragraph"]);
		expect(types(at(document, 0))).toEqual(["paragraph", "paragraph"]);
	});
});

describe("annotations", () => {
	test("reads an annotation written after a heading's text", () => {
		let document = parse("## Installing {% #install .lead %}\n");

		expect(at(document, 0)).toMatchObject({
			type: "heading",
			level: 2,
			attributes: { id: "install", class: "lead" },
		});
		expect(at(document, 0, 0)).toMatchObject({ type: "text", value: "Installing" });
	});

	test("reads an annotation written after a fence's info string", () => {
		let document = parse('```tsx {% path="a.tsx" title="A" %}\nlet a = 1;\n```\n');

		expect(at(document, 0)).toMatchObject({
			type: "code",
			language: "tsx",
			content: "let a = 1;\n",
			attributes: { path: "a.tsx", title: "A" },
		});
	});

	test("reads an annotation written on the line above a block", () => {
		let document = parse("{% .wide %}\n| a |\n| - |\n");

		expect(at(document, 0)).toMatchObject({ type: "table", attributes: { class: "wide" } });
	});

	test("crosses the blank line the formatter inserts", () => {
		let document = parse("{% .wide %}\n\n| a |\n| - |\n");

		expect(at(document, 0)).toMatchObject({ type: "table", attributes: { class: "wide" } });
	});

	test("merges two annotations, the lower one winning a repeated key", () => {
		let document = parse('{% #first kind="a" %}\n{% #second %}\n\n# Title\n');

		expect(at(document, 0)).toMatchObject({
			type: "heading",
			attributes: { id: "second", kind: "a" },
		});
	});

	test("reads literal attribute values", () => {
		let document = parse("{% count={42} wide open={false} %}\n\n# Title\n");

		expect(at(document, 0)).toMatchObject({
			attributes: { count: 42, wide: true, open: false },
		});
	});

	test("gives an unannotated block empty attributes", () => {
		expect(at(parse("# Title\n"), 0)).toMatchObject({ attributes: {} });
	});

	test("reads a variable on its own line as a paragraph", () => {
		let document = parse("{% $name %}\n");

		expect(types(document)).toEqual(["paragraph"]);
		expect(at(document, 0, 0)).toMatchObject({ type: "variable", name: "name" });
	});

	test("fails on an annotation with no block after it", () => {
		let result = read("text\n\n{% .wide %}\n");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.message).toMatch(/annotation/i);
		expect(result.error.position?.start.line).toBe(3);
	});

	test("fails on a dangling annotation inside a container", () => {
		let result = read("> text\n>\n> {% .wide %}\n");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.position?.start.line).toBe(3);
	});
});

describe("block tags", () => {
	test("opens a container whose children are blocks", () => {
		let document = parse('<callout type="info">\nA paragraph.\n\n- and a list\n</callout>\n', TAGS);

		expect(at(document, 0)).toMatchObject({
			type: "tag",
			name: "callout",
			attributes: { type: "info" },
		});
		expect(types(at(document, 0))).toEqual(["paragraph", "list"]);
	});

	test("nests by name, so the inner tag claims the first closer", () => {
		let document = parse("<note>\n<note>\ninner\n</note>\nouter\n</note>\n", TAGS);

		expect(types(at(document, 0))).toEqual(["tag", "paragraph"]);
		expect(types(at(document, 0, 0))).toEqual(["paragraph"]);
	});

	test("takes part inside a block quote, prefix and all", () => {
		let document = parse("> <note>\n> Quoted.\n> </note>\n", TAGS);

		expect(types(document)).toEqual(["blockquote"]);
		expect(at(document, 0, 0)).toMatchObject({ type: "tag", name: "note" });
		expect(types(at(document, 0, 0))).toEqual(["paragraph"]);
	});

	test("keeps a fenced code block inside it opaque", () => {
		let document = parse("<note>\n```\n</note>\n```\n</note>\n", TAGS);

		expect(types(at(document, 0))).toEqual(["code"]);
		expect(at(document, 0, 0)).toMatchObject({ type: "code", content: "</note>\n" });
	});

	test("yields a tag with no children when written self-closing", () => {
		let document = parse("<note />\n", TAGS);

		expect(at(document, 0)).toMatchObject({ type: "tag", name: "note" });
		expect(types(at(document, 0))).toEqual([]);
	});

	test("reads a void tag and its validated attributes", () => {
		let document = parse('<video src="/demo.mp4" />\n', TAGS);

		expect(at(document, 0)).toMatchObject({
			type: "tag",
			name: "video",
			attributes: { src: "/demo.mp4" },
		});
		expect(types(at(document, 0))).toEqual([]);
	});

	test("reads an inline-content tag alone on a line without a paragraph around it", () => {
		let document = parse("<kbd>Cmd</kbd>\n", TAGS);

		expect(types(document)).toEqual(["tag"]);
		expect(at(document, 0)).toMatchObject({ type: "tag", name: "kbd" });
		expect(at(document, 0, 0)).toMatchObject({ type: "text", value: "Cmd" });
	});

	test("leaves a tag with content around it to the paragraph", () => {
		let document = parse("Press <kbd>Cmd</kbd> to search.\n", TAGS);

		expect(types(document)).toEqual(["paragraph"]);
	});

	test("leaves an unregistered name a CommonMark HTML block", () => {
		let document = parse("<div>\nraw\n</div>\n", TAGS);

		expect(types(document)).toEqual(["html"]);
	});

	test("carries an annotation written above it", () => {
		let document = parse("{% #top %}\n\n<note>\nbody\n</note>\n", TAGS);

		expect(at(document, 0)).toMatchObject({ type: "tag", attributes: { id: "top" } });
	});

	test("fails at the opener when a block tag is never closed", () => {
		let result = read("intro\n\n<note>\nbody\n", TAGS);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.message).toBe("Unclosed tag <note>");
		expect(result.error.position?.start.line).toBe(3);
	});

	test("fails at the inner opener when a closer names an outer tag", () => {
		let result = read('<note>\n<callout type="info">\n</note>\n', TAGS);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.message).toBe("Unclosed tag <callout>");
		expect(result.error.position?.start.line).toBe(2);
	});

	test("fails at the opener when a void tag is given a closing tag", () => {
		let result = read('<video src="/a.mp4" />\n\n</video>\n', TAGS);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.message).toMatch(/self-closing/);
		expect(result.error.position?.start.line).toBe(1);
	});

	test("fails at the opener when the attribute schema rejects", () => {
		let result = read('<callout type="nope">\nbody\n</callout>\n', TAGS);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.message).toBe("Invalid attributes for <callout>");
		expect(result.error.position?.start.line).toBe(1);
		expect(result.error.issues.length).toBeGreaterThan(0);
	});
});

describe("positions", () => {
	test("spans a heading from its marker to the end of its line", () => {
		let document = parse("# Title\n");

		expect(at(document, 0).position).toEqual({
			start: { line: 1, column: 1, offset: 0 },
			end: { line: 1, column: 8, offset: 7 },
		});
	});

	test("spans a fenced block from its opening fence to its closing one", () => {
		let document = parse("```\nbody\n```\n");

		expect(at(document, 0).position).toEqual({
			start: { line: 1, column: 1, offset: 0 },
			end: { line: 3, column: 4, offset: 12 },
		});
	});

	test("spans a quote across every line it holds", () => {
		let document = parse("> one\n> two\n");

		expect(at(document, 0).position).toEqual({
			start: { line: 1, column: 1, offset: 0 },
			end: { line: 2, column: 6, offset: 11 },
		});
	});

	test("starts a nested item at its own marker", () => {
		let document = parse("- a\n  - b\n");

		expect(at(document, 0, 0, 1).position.start).toEqual({ line: 2, column: 3, offset: 6 });
	});

	test("indexes the file as written when the body begins past a frontmatter block", () => {
		let source = "---\ntitle: x\n---\n# Title\n";
		let document = unwrap(
			parseBlocks(source, { line: 4, column: 1, offset: 17 }, resolveOptions({})),
		);

		expect(at(document, 0).position.start).toEqual({ line: 4, column: 1, offset: 17 });
	});
});
