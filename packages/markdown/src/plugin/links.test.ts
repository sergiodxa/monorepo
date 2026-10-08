/**
 * Checks the visitor that rewrites the URLs a document points at: relative ones
 * resolved against a base, absolute and fragment-only ones kept as written, a
 * caller's own mapping run last, and every untouched node shared.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Markdown as MarkdownTypes } from "../index.js";

import { Markdown } from "../index.js";

import { links } from "./links.js";

/** The base a README's relative links resolve against. */
const BASE = "https://github.com/sergiodxa/monorepo/blob/main/packages/markdown/";

/** Elements whose URL attributes the visitor rewrites. */
const OPTIONS = {
	html: { a: ["href", "title"], img: ["src", "alt"] },
} satisfies MarkdownTypes.Options;

/**
 * @param source - The markdown to read
 * @returns The parsed document, failing the test when the parser rejected it
 */
function parse(source: string): MarkdownTypes.Document {
	return unwrap(Markdown.parse(source, OPTIONS)).document;
}

/**
 * @param source - A single paragraph holding one link
 * @param options - The visitor's options
 * @returns The href the link ends up with
 */
function hrefOf(source: string, options: Parameters<typeof links>[0]): string {
	let document = unwrap(Markdown.walk(parse(source), links(options)));
	let paragraph = document.children[0] as MarkdownTypes.Paragraph;
	return (paragraph.children[0] as MarkdownTypes.Link).href;
}

describe("links", () => {
	test("resolves a relative path against the base", () => {
		expect(hrefOf("[x](./README.md)", { base: BASE })).toBe(`${BASE}README.md`);
		expect(hrefOf("[x](src/index.ts)", { base: BASE })).toBe(`${BASE}src/index.ts`);
	});

	test("resolves a parent path against the base", () => {
		expect(hrefOf("[x](../result/README.md)", { base: BASE })).toBe(
			"https://github.com/sergiodxa/monorepo/blob/main/packages/result/README.md",
		);
	});

	test("resolves a root-relative path against the base's origin", () => {
		expect(hrefOf("[x](/docs/adr)", { base: new URL(BASE) })).toBe("https://github.com/docs/adr");
	});

	test("keeps the query and the fragment of a resolved URL", () => {
		expect(hrefOf("[x](guide.md?tab=api#usage)", { base: BASE })).toBe(
			`${BASE}guide.md?tab=api#usage`,
		);
	});

	test("leaves absolute URLs, mailto and tel links as written", () => {
		expect(hrefOf("[x](https://example.com/a)", { base: BASE })).toBe("https://example.com/a");
		expect(hrefOf("[x](mailto:a@b.com)", { base: BASE })).toBe("mailto:a@b.com");
		expect(hrefOf("[x](tel:+15550100)", { base: BASE })).toBe("tel:+15550100");
	});

	test("leaves a fragment-only link pointing inside the page", () => {
		expect(hrefOf("[x](#install)", { base: BASE })).toBe("#install");
	});

	test("runs the rewrite hook on the resolved URL", () => {
		let seen: string[] = [];
		let href = hrefOf("[x](./guide.md)", {
			base: BASE,
			rewrite(url, node) {
				seen.push(node.type);
				return url.endsWith(".md") ? url.replace(/\.md$/, "") : undefined;
			},
		});

		expect(href).toBe(`${BASE}guide`);
		expect(seen).toEqual(["link"]);
	});

	test("runs the rewrite hook on URLs the base leaves alone, and keeps one it declines", () => {
		let rewrite = (url: string) =>
			url.startsWith("https://www.npmjs.com/package/") ? "/packages/result" : undefined;

		expect(hrefOf("[x](https://www.npmjs.com/package/@sdxc/result)", { rewrite })).toBe(
			"/packages/result",
		);
		expect(hrefOf("[x](./guide.md)", { rewrite })).toBe("./guide.md");
	});

	test("rewrites an image's source", () => {
		let document = unwrap(Markdown.walk(parse("![logo](./logo.png)"), links({ base: BASE })));
		let paragraph = document.children[0] as MarkdownTypes.Paragraph;

		expect(paragraph.children[0]).toMatchObject({ type: "image", src: `${BASE}logo.png` });
	});

	test("rewrites the href and src attributes of allowlisted elements", () => {
		let document = unwrap(
			Markdown.walk(
				parse('<a href="./guide.md" title="./kept">g</a> <img src="logo.png" alt="L">'),
				links({ base: BASE }),
			),
		);
		let paragraph = document.children[0] as MarkdownTypes.Paragraph;

		expect(paragraph.children[0]).toMatchObject({
			type: "element",
			attributes: { href: `${BASE}guide.md`, title: "./kept" },
		});
		expect(paragraph.children[2]).toMatchObject({
			type: "element",
			attributes: { src: `${BASE}logo.png`, alt: "L" },
		});
	});

	test("leaves an element attribute that holds a variable alone", () => {
		let document = parse("<a href={$url}>docs</a>");
		let walked = unwrap(Markdown.walk(document, links({ base: BASE })));

		expect(walked).toBe(document);
	});

	test("shares every node it leaves unchanged", () => {
		let document = parse("# Title\n\n[a](https://example.com) and [b](#top)\n\n[c](./c.md)");
		let walked = unwrap(Markdown.walk(document, links({ base: BASE })));

		expect(walked).not.toBe(document);
		expect(walked.children[0]).toBe(document.children[0]);
		expect(walked.children[1]).toBe(document.children[1]);
		expect(walked.children[2]).not.toBe(document.children[2]);
	});

	test("hands back the same document when nothing points anywhere relative", () => {
		let document = parse("[a](https://example.com) ![b](https://example.com/b.png)");

		expect(unwrap(Markdown.walk(document, links({ base: BASE })))).toBe(document);
	});

	test("fails the walk at the link when the base is no absolute URL", () => {
		let result = Markdown.walk(parse("text\n\n[x](./a.md)"), links({ base: "/docs/" }));

		expect(isFailure(result) && result.error.position?.start.line).toBe(3);
	});
});
