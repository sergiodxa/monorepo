/**
 * Specifies the markdown visitor: which code and inline code it claims as math,
 * the tag nodes it leaves in their place, how it reports a formula that does not
 * convert, and the HTML tag renderer that turns those nodes into MathML.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, expectTypeOf, test } from "vitest";

import { createMathVisitor, math, renderMath } from "./markdown.js";

import { MathError } from "./index.js";

/**
 * @param source - Markdown to parse
 * @returns The document it holds
 */
function parse(source: string): Markdown.Document {
	let parsed = Markdown.parse(source);
	if (isFailure(parsed)) throw parsed.error;
	return parsed.data.document;
}

/**
 * @param document - The document to walk with the default visitor
 * @returns The walked document
 */
function walk(document: Markdown.Document): Markdown.Document {
	let walked = Markdown.walk(document, math);
	if (isFailure(walked)) throw walked.error;
	return walked.data;
}

/**
 * Drops positions so a test states the tree it expects without restating
 * offsets that only the position tests care about.
 *
 * @param value - A node or a list of them
 * @returns The same tree without `position` fields
 */
function shape(value: unknown): unknown {
	return JSON.parse(
		JSON.stringify(value, (key, field) => (key === "position" ? undefined : field)),
	);
}

/**
 * @param document - A walked document
 * @returns The children of its first block, which every inline test writes as a paragraph
 */
function inline(document: Markdown.Document): Markdown.Inline[] {
	let [block] = document.children;
	if (block?.type !== "paragraph") throw new Error("Expected a paragraph first");
	return block.children;
}

describe("math visitor", () => {
	test("turns a math fence into a display math tag", () => {
		let walked = walk(parse("```math\n\\frac{a}{b}\n```\n"));

		expect(shape(walked.children)).toEqual([
			{
				type: "tag",
				name: "math",
				attributes: { tex: "\\frac{a}{b}", display: true },
				children: [],
			},
		]);
	});

	test("keeps the fence's position on the tag", () => {
		let document = parse("```math\nx\n```\n");
		let walked = walk(document);

		expect(walked.children[0]?.position).toEqual(document.children[0]?.position);
	});

	test("leaves every other code block as the same node", () => {
		let document = parse("```ts\nlet x = 1;\n```\n");

		expect(walk(document)).toBe(document);
	});

	test("turns GitHub's dollar-backtick form into an inline math tag", () => {
		let walked = walk(parse("Euler: $`e^{i\\pi}`$ holds."));

		expect(shape(inline(walked))).toEqual([
			{ type: "text", value: "Euler: " },
			{ type: "tag", name: "math", attributes: { tex: "e^{i\\pi}", display: false }, children: [] },
			{ type: "text", value: " holds." },
		]);
	});

	test("drops a neighbouring text node the dollar signs were all of", () => {
		let walked = walk(parse("$`x`$"));

		expect(shape(inline(walked))).toEqual([
			{ type: "tag", name: "math", attributes: { tex: "x", display: false }, children: [] },
		]);
	});

	test("reads two formulas that share the dollar signs between them", () => {
		let walked = walk(parse("$`a`$$`b`$"));

		expect(shape(inline(walked))).toEqual([
			{ type: "tag", name: "math", attributes: { tex: "a", display: false }, children: [] },
			{ type: "tag", name: "math", attributes: { tex: "b", display: false }, children: [] },
		]);
	});

	test("finds inline math inside emphasis", () => {
		let walked = walk(parse("*see $`x`$*"));
		let [emphasis] = inline(walked);

		expect(shape(emphasis)).toEqual({
			type: "emphasis",
			children: [
				{ type: "text", value: "see " },
				{ type: "tag", name: "math", attributes: { tex: "x", display: false }, children: [] },
			],
		});
	});

	test("spans the tag from one dollar sign to the other and trims the text around it", () => {
		let walked = walk(parse("a $`x`$ b"));
		let [before, tag, after] = inline(walked);

		expect(before?.position.end.offset).toBe(2);
		expect(tag?.position.start.offset).toBe(2);
		expect(tag?.position.end.offset).toBe(7);
		expect(after?.position.start.offset).toBe(7);
	});

	test("leaves inline code without a dollar sign on both sides", () => {
		let document = parse("cost $`x` and `y`$");

		expect(walk(document)).toBe(document);
	});

	test("fails the walk on a formula that does not convert", () => {
		let walked = Markdown.walk(parse("```math\n\\foo\n```\n"), math);

		expect(isFailure(walked)).toBe(true);
		if (isSuccess(walked)) return;
		expect(walked.error.cause).toBeInstanceOf(MathError);
		expect(walked.error.message).toContain("Unknown command \\foo");
	});

	test("keeps the original nodes of a formula that does not convert when asked to", () => {
		let document = parse("```math\n\\foo\n```\n\n$`\\bar{`$\n");
		let walked = Markdown.walk(document, createMathVisitor({ invalid: "keep" }));

		expect(walked).toEqual({ status: "success", data: document });
	});

	test("walks synchronously", () => {
		let walked = Markdown.walk(parse("x"), math);

		expectTypeOf(walked).toEqualTypeOf<Result<Markdown.Document, Markdown.WalkError>>();
	});
});

describe("renderMath", () => {
	test("renders a math tag as MathML through toHTML", () => {
		let html = toHTML(walk(parse("```math\nx^2\n```\n\nSo $`y`$.")), {
			tags: { math: renderMath },
		});

		expect(html).toContain(
			'<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><semantics><msup>',
		);
		expect(html).toContain(
			'<p>So <math xmlns="http://www.w3.org/1998/Math/MathML" display="inline">',
		);
	});

	test("renders TeX that does not convert as escaped code", () => {
		let html = renderMath({
			name: "math",
			attributes: { tex: "<\\foo>", display: false },
			children: "",
		});

		expect(html).toBe("<code>&lt;\\foo&gt;</code>");
	});
});
