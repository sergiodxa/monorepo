/**
 * Tests the Markdoc node: what it puts on the tag, how it resolves the language
 * a fence names, and that a fence carrying markup stays data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Tag } from "@markdoc/markdoc";

import Markdoc from "@markdoc/markdoc";
import { describe, expect, test } from "vitest";

import { fence } from "./markdoc";

/**
 * Transforms a markdown source's first fence the way a configured parser does.
 *
 * @param source - Markdown holding a single fenced block
 * @returns The `Fence` tag a renderer receives
 */
function transformFence(source: string): Tag {
	let [node] = Markdoc.parse(source).children;
	if (!node) throw new Error(`Parsed no block out of ${JSON.stringify(source)}`);
	return fence.transform(node) as Tag;
}

describe("fence", () => {
	test("carries the tokens, not markup", () => {
		let tag = transformFence("```ts\nlet x = 1;\n```\n");

		expect(tag.name).toBe("Fence");
		expect(tag.attributes.tokens).toEqual([
			{ type: "keyword", value: "let" },
			{ type: "plain", value: " x " },
			{ type: "operator", value: "=" },
			{ type: "plain", value: " " },
			{ type: "number", value: "1" },
			{ type: "punctuation", value: ";" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("resolves the language it reports to the one it highlighted with", () => {
		expect(transformFence("```ts\nx\n```\n").attributes.language).toBe("typescript");
		expect(transformFence("```JSONC\nx\n```\n").attributes.language).toBe("json");
	});

	test("defaults to plain when the fence names no language", () => {
		let tag = transformFence("```\nx\n```\n");

		expect(tag.attributes.language).toBe("plain");
		expect(tag.attributes.tokens).toEqual([{ type: "plain", value: "x\n" }]);
	});

	/**
	 * The language with no grammar is the case that used to reach a renderer as a
	 * raw string of markup. As a token it is data, whatever it holds.
	 */
	test("tokenizes a language it has no grammar for", () => {
		let tag = transformFence("```hcl\n<img src=x onerror=alert(1)>\n```\n");

		expect(tag.attributes.language).toBe("hcl");
		expect(tag.attributes.tokens).toEqual([
			{ type: "plain", value: "<img src=x onerror=alert(1)>\n" },
		]);
	});

	test("passes through the path and title a fence annotates itself with", () => {
		let tag = transformFence('```ts {% path="app/x.ts" title="Routes" %}\nlet x = 1;\n```\n');

		expect(tag.attributes.path).toBe("app/x.ts");
		expect(tag.attributes.title).toBe("Routes");
	});

	test("leaves out a path and title the fence did not name", () => {
		let tag = transformFence("```ts\nlet x = 1;\n```\n");

		expect(tag.attributes.path).toBeUndefined();
		expect(tag.attributes.title).toBeUndefined();
	});

	test("registers as the fence node of a Markdoc config", () => {
		let tree = Markdoc.transform(Markdoc.parse("```ts\nlet x = 1;\n```\n"), {
			nodes: { fence },
		});

		expect(JSON.stringify(tree)).toContain('"name":"Fence"');
	});
});
