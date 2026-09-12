/**
 * Tests the walk visitor: what it attaches to a code block, how it resolves the
 * language a block names, that a block naming none is painted as plain, and
 * that it merges with another visitor and stays synchronous.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Markdown } from "@sdxc/markdown";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { Token } from "./lexer.js";

import { highlight } from "./markdown.js";

const POSITION: Markdown.Position = {
	start: { line: 1, column: 1, offset: 0 },
	end: { line: 1, column: 1, offset: 0 },
};

/**
 * Builds the node the visitor paints. Documents are assembled by hand rather
 * than parsed, so a test states the tree it means.
 *
 * @param content - The body of the block
 * @param language - What the block named, which an indented block never does
 * @returns A code node a visitor or a walk can take
 */
function code(content: string, language?: string): Markdown.Code {
	return { type: "code", language, content, attributes: {}, position: POSITION };
}

/**
 * @param children - The blocks the document holds
 * @returns A document a walk can start from
 */
function document(...children: Markdown.Block[]): Markdown.Document {
	return { type: "document", children, position: POSITION };
}

/**
 * Reads the block a walk handed back, so a test asserting on it says what it
 * expected the walk to return when the walk returned something else.
 *
 * @param node - The document a walk produced
 * @returns Its first block, as a code node
 */
function firstCode(node: Markdown.Document): Markdown.Code {
	let [block] = node.children;
	if (block?.type !== "code") throw new Error(`Walked a document whose first block is not code`);
	return block;
}

describe("highlight", () => {
	test("carries the tokens, not markup", () => {
		let painted = highlight.code(code("let x = 1;", "ts"));

		expect(painted.tokens).toEqual([
			{ type: "keyword", value: "let" },
			{ type: "plain", value: " x " },
			{ type: "operator", value: "=" },
			{ type: "plain", value: " " },
			{ type: "number", value: "1" },
			{ type: "punctuation", value: ";" },
		]);
	});

	test("resolves the language it reports to the one it highlighted with", () => {
		expect(highlight.code(code("x", "ts")).language).toBe("typescript");
		expect(highlight.code(code("x", "JSONC")).language).toBe("json");
	});

	test("paints a block that names no language as plain", () => {
		let painted = highlight.code(code("\tlet x = 1;\n"));

		expect(painted.language).toBe("plain");
		expect(painted.tokens).toEqual([{ type: "plain", value: "\tlet x = 1;\n" }]);
	});

	/**
	 * The language with no grammar is the case that used to reach a renderer as a
	 * raw string of markup. As a token it is data, whatever it holds.
	 */
	test("tokenizes a language it has no grammar for", () => {
		let painted = highlight.code(code("<img src=x onerror=alert(1)>", "hcl"));

		expect(painted.language).toBe("hcl");
		expect(painted.tokens).toEqual([{ type: "plain", value: "<img src=x onerror=alert(1)>" }]);
	});

	test("keeps the content and the position, so the node still writes back", () => {
		let painted = highlight.code(code("let x = 1;", "ts"));

		expect(painted.content).toBe("let x = 1;");
		expect(painted.position).toBe(POSITION);
		expect(painted.attributes).toEqual({});
	});

	test("leaves the node it was given alone", () => {
		let node = code("let x = 1;", "ts");

		highlight.code(node);

		expect(node.tokens).toBeUndefined();
		expect(node.language).toBe("ts");
	});

	test("attaches the tokens through the field it declares on the code node", () => {
		let walked = Markdown.walk(document(code("let x = 1;", "ts")), highlight);
		if (walked.status === "failure") throw walked.error;

		expectTypeOf(firstCode(walked.data).tokens).toEqualTypeOf<Token[] | undefined>();
		expect(firstCode(walked.data).content).toBe("let x = 1;");
	});

	test("merges with another visitor and stays synchronous", () => {
		let anchors = {
			heading(node: Markdown.Heading) {
				return { ...node, attributes: { ...node.attributes, id: "anchor" } };
			},
		} satisfies Markdown.Visitor;

		let merged = { ...highlight, ...anchors };
		let walked = Markdown.walk(document(code("let x = 1;", "ts")), merged);

		expectTypeOf(walked).toHaveProperty("status");
		expectTypeOf<Awaited<typeof walked>>().toEqualTypeOf<typeof walked>();
		expect(merged.code(code("let x = 1;", "ts")).language).toBe("typescript");
	});
});
