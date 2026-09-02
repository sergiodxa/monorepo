/**
 * Tests for the fence node: that language aliases resolve to Prism grammar
 * identifiers that actually exist, and that a body reaches the client renderer
 * as source to read whether or not a grammar highlighted it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Tag } from "@markdoc/markdoc";

import Markdoc from "@markdoc/markdoc";
import Prism from "prismjs";
import { describe, expect, test } from "vitest";

import { fence, normalizeLanguage } from "./fence";

/**
 * Transforms a markdown source's first fence the way the parser does.
 *
 * @param source - Markdown holding a single fenced block
 * @returns The `Fence` tag the client renderer receives
 */
function transformFence(source: string): Tag {
	let [node] = Markdoc.parse(source).children;
	if (!node) throw new Error(`Parsed no block out of ${JSON.stringify(source)}`);
	return fence.transform(node) as Tag;
}

describe("normalizeLanguage", () => {
	test("maps typescript aliases", () => {
		expect(normalizeLanguage("ts")).toBe("typescript");
		expect(normalizeLanguage("tsx")).toBe("tsx");
		expect(normalizeLanguage("TS")).toBe("typescript");
	});

	/**
	 * A grammar must actually answer to the name an alias resolves to, or the
	 * fence silently renders as flat, unhighlighted text. This assertion
	 * catches that kind of broken mapping before it ships.
	 */
	test("maps jsonc onto a grammar that exists", () => {
		let language = normalizeLanguage("jsonc");
		expect(language).toBe("json");
		expect(Prism.languages[language]).toBeDefined();
	});
});

describe("fence", () => {
	/**
	 * The client renderer draws the content with `innerHTML`, so a language Prism
	 * registers no grammar for has to arrive escaped by the node itself.
	 */
	test("escapes a body it has no grammar to highlight", () => {
		let tag = transformFence('```hcl\n<img src=x onerror=alert(1)> & "q"\n```\n');

		expect(tag.attributes.language).toBe("hcl");
		expect(tag.attributes.content).toBe('&lt;img src=x onerror=alert(1)> &amp; "q"\n');
	});

	test("escapes that body the same way the highlighted path does", () => {
		let body = "<b>&amp;</b>\n";

		expect(transformFence(`\`\`\`hcl\n${body}\`\`\`\n`).attributes.content).toBe(
			transformFence(`\`\`\`plain\n${body}\`\`\`\n`).attributes.content,
		);
	});

	/**
	 * `prism-tsx.js` clones `Prism.languages.typescript` when it loads, so an
	 * import order that puts it first leaves `tsx` as a copy of `jsx` with no
	 * TypeScript rules and no complaint.
	 */
	test("highlights tsx with the TypeScript half of the grammar", () => {
		let tag = transformFence("```tsx\ntype Id = string;\n```\n");

		expect(tag.attributes.content).toContain('<span class="token builtin">string</span>');
	});
});
