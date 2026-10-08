/**
 * Checks the heading plugin: the ids the visitor gives headings, author ids kept and
 * reserved wherever they stand, de-duplication, the level filter and a custom slug,
 * and the table of contents read back from a walked document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Markdown as MarkdownTypes } from "../index.js";

import { Markdown } from "../index.js";

import { headings, tableOfContents } from "./headings.js";

/**
 * @param source - The markdown to read
 * @returns The parsed document, failing the test when the parser rejected it
 */
function parse(source: string): MarkdownTypes.Document {
	return unwrap(Markdown.parse(source)).document;
}

/**
 * @param document - The document to walk
 * @param options - The options for the visitor
 * @returns The `id` of every top-level heading, in document order
 */
function ids(
	document: MarkdownTypes.Document,
	options?: Parameters<typeof headings>[0],
): unknown[] {
	let walked = unwrap(Markdown.walk(document, headings(options)));
	return walked.children.flatMap((block) =>
		block.type === "heading" ? [block.attributes.id] : [],
	);
}

describe("headings", () => {
	test("gives every heading a GitHub slug of its text", () => {
		expect(ids(parse("# Hello, World!\n\n## Getting Started\n\n###### Café au lait"))).toEqual([
			"hello-world",
			"getting-started",
			"café-au-lait",
		]);
	});

	test("numbers repeated headings the way GitHub does", () => {
		expect(ids(parse("## Props\n\n## Props\n\n## Props"))).toEqual(["props", "props-1", "props-2"]);
	});

	test("slugs from the plain text of inline markup", () => {
		expect(ids(parse("## The `walk` *visitor* and [links](https://example.com) **here**"))).toEqual(
			["the-walk-visitor-and-links-here"],
		);
	});

	test("keeps an author-written id", () => {
		expect(ids(parse("## Install {% #setup %}\n\n## Usage"))).toEqual(["setup", "usage"]);
	});

	test("reserves an author id written before the heading it would collide with", () => {
		expect(ids(parse("## Intro {% #usage %}\n\n## Usage"))).toEqual(["usage", "usage-1"]);
	});

	test("reserves an author id written after the heading it would collide with", () => {
		expect(ids(parse("## Usage\n\n## Intro {% #usage %}"))).toEqual(["usage-1", "usage"]);
	});

	test("reserves an id an annotation wrote on a block that is not a heading", () => {
		expect(ids(parse("{% #install %}\nRun the installer.\n\n## Install"))).toEqual(["install-1"]);
	});

	test("reserves author ids on headings nested in other blocks", () => {
		let walked = unwrap(Markdown.walk(parse("## Usage\n\n> ## Quoted {% #usage %}"), headings()));
		let [first, quote] = walked.children;

		expect(first).toMatchObject({ attributes: { id: "usage-1" } });
		expect(quote).toMatchObject({ children: [{ type: "heading", attributes: { id: "usage" } }] });
	});

	test("gives only the chosen levels an id, while reserving author ids at every level", () => {
		expect(ids(parse("# Title\n\n## Usage\n\n#### Deep {% #usage %}"), { levels: [2, 3] })).toEqual(
			[undefined, "usage-1", "usage"],
		);
	});

	test("de-duplicates the slugs a custom slug function writes", () => {
		let slug = (text: string) => `Section.${text.length}`;
		expect(ids(parse("## abc\n\n## xyz\n\n## Hello"), { slug })).toEqual([
			"Section.3",
			"Section.3-1",
			"Section.5",
		]);
	});

	test("leaves a heading whose text slugs to nothing without an id", () => {
		expect(ids(parse("## !!!\n\n## Done"))).toEqual([undefined, "done"]);
	});

	test("hands back untouched nodes as the same object", () => {
		let document = parse("Some *text*.\n\n- a\n- b\n\n## Title {% #kept %}");
		let walked = unwrap(Markdown.walk(document, headings()));

		expect(walked.children[0]).toBe(document.children[0]);
		expect(walked.children[1]).toBe(document.children[1]);
		expect(walked.children[2]).toBe(document.children[2]);
	});

	test("starts each document walk with no ids taken", () => {
		let visitor = headings();
		let document = parse("## Usage");

		expect(unwrap(Markdown.walk(document, visitor)).children[0]).toMatchObject({
			attributes: { id: "usage" },
		});
		expect(unwrap(Markdown.walk(document, visitor)).children[0]).toMatchObject({
			attributes: { id: "usage" },
		});
	});
});

describe("tableOfContents", () => {
	/**
	 * @param source - The markdown to read
	 * @returns The document after the heading visitor gave its headings ids
	 */
	function walked(source: string): MarkdownTypes.Document {
		return unwrap(Markdown.walk(parse(source), headings()));
	}

	test("nests level-3 headings under the level-2 heading before them", () => {
		let toc = tableOfContents(
			walked("# Title\n\n## Install\n\n### npm\n\n### Bun\n\n## Usage `walk`\n\n#### Deep"),
		);

		expect(toc).toEqual([
			{
				id: "install",
				text: "Install",
				level: 2,
				children: [
					{ id: "npm", text: "npm", level: 3, children: [] },
					{ id: "bun", text: "Bun", level: 3, children: [] },
				],
			},
			{ id: "usage-walk", text: "Usage walk", level: 2, children: [] },
		]);
	});

	test("nests a heading under the nearest shallower one when a level is skipped", () => {
		let toc = tableOfContents(walked("## A\n\n#### B\n\n### C\n\n## D"), { levels: [2, 3, 4] });

		expect(toc).toEqual([
			{
				id: "a",
				text: "A",
				level: 2,
				children: [
					{ id: "b", text: "B", level: 4, children: [] },
					{ id: "c", text: "C", level: 3, children: [] },
				],
			},
			{ id: "d", text: "D", level: 2, children: [] },
		]);
	});

	test("starts at the top level when the first heading is deeper than the ones after", () => {
		let toc = tableOfContents(walked("### Lead\n\n## A\n\n### B"));

		expect(toc).toEqual([
			{ id: "lead", text: "Lead", level: 3, children: [] },
			{
				id: "a",
				text: "A",
				level: 2,
				children: [{ id: "b", text: "B", level: 3, children: [] }],
			},
		]);
	});

	test("reads author ids and skips headings with no id", () => {
		let toc = tableOfContents(parse("## Install {% #setup %}\n\n## Usage"));

		expect(toc).toEqual([{ id: "setup", text: "Install", level: 2, children: [] }]);
	});
});
