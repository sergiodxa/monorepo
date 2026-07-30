/**
 * Tests for the blog's markdown utilities, pinning the plain-text contract that
 * feeds word counts and the search index: markdown syntax is removed while code
 * blocks, inline code, and image alternative text survive, because a post's code
 * identifiers are exactly what a reader searches the site for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { Markdown } from "./markdown";

describe("Markdown.plain", () => {
	test("keeps heading and paragraph prose, separating blocks by a blank line", () => {
		let source = "# Hello World\n\nA paragraph of prose.";

		expect(Markdown.plain(source)).toBe("Hello World\n\nA paragraph of prose.");
	});

	test("keeps a link label and drops its target and title", () => {
		let source = 'See [the spec](https://example.com "Living Standard") for details.';

		expect(Markdown.plain(source)).toBe("See the spec for details.");
	});

	test("drops a reference definition while keeping the reference label", () => {
		let source = "See [the spec][spec].\n\n[spec]: https://example.com";

		expect(Markdown.plain(source)).toBe("See the spec.");
	});

	test("keeps inline code verbatim, even when it holds tag syntax", () => {
		let source = "You render `<UserModal id={userId} />` inside the route.";

		expect(Markdown.plain(source)).toBe("You render <UserModal id={userId} /> inside the route.");
	});

	test("keeps fenced code, which the word count and search index both need", () => {
		let source = "Before.\n\n```ts\nlet parsed = parse(source);\n```\n\nAfter.";

		expect(Markdown.plain(source)).toBe("Before.\n\nlet parsed = parse(source);\n\nAfter.");
	});

	test("drops fenced code when a caller asks for excerpt-shaped text", () => {
		let source = "Before.\n\n```ts\nlet parsed = parse(source);\n```\n\nAfter.";

		expect(Markdown.plain(source, { fences: false })).toBe("Before.\n\nAfter.");
	});

	test("keeps image alternative text", () => {
		expect(Markdown.plain("Before ![a request flow](/flow.png) after.")).toBe(
			"Before a request flow after.",
		);
	});

	test("removes raw HTML tags without leaving their blank lines behind", () => {
		let source = 'Template:\n\n<div class="card">\n  <slot name="title"></slot>\n</div>\n\nAfter.';

		expect(Markdown.plain(source)).toBe("Template:\n\nAfter.");
	});

	test("removes an HTML comment entirely", () => {
		expect(Markdown.plain("Visible.\n\n<!-- hidden -->\n\nAlso visible.")).toBe(
			"Visible.\n\nAlso visible.",
		);
	});

	test("keeps an autolink's URL as text", () => {
		expect(Markdown.plain("Read <https://example.com> now.")).toBe("Read https://example.com now.");
	});

	test("flattens a table row into one block instead of leaving pipe syntax", () => {
		let source = "| Name | Role |\n| ---- | ---- |\n| Ada | Author |";

		expect(Markdown.plain(source)).toBe("Name Role\n\nAda Author");
	});

	test("drops frontmatter, which is metadata rather than prose", () => {
		let source = "---\ntitle: Hello\n---\n\nBody text.";

		expect(Markdown.plain(source)).toBe("Body text.");
	});

	test("returns an empty string for empty source", () => {
		expect(Markdown.plain("")).toBe("");
	});
});
