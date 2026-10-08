/**
 * Checks visitor composition: handlers for one node type run in the order their
 * visitors were given, each seeing what the one before produced, and the walk stays
 * synchronous unless a handler is asynchronous.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, expectTypeOf, test } from "vitest";

import { Markdown } from "../index.js";
import { headings } from "../plugin/headings.js";
import { variables } from "../plugin/variables.js";

/**
 * @param source - The markdown to read
 * @returns The parsed document, failing the test when the parser rejected it
 */
function parse(source: string): Markdown.Document {
	return unwrap(Markdown.parse(source)).document;
}

describe("Markdown.compose", () => {
	test("runs every handler for a type, each on the node the one before returned", () => {
		let calls: string[] = [];
		let visitor = Markdown.compose(
			{
				heading(node) {
					calls.push("first");
					return { ...node, attributes: { ...node.attributes, a: 1 } };
				},
			},
			{
				heading(node) {
					calls.push(`second saw ${JSON.stringify(node.attributes.a)}`);
					return { ...node, attributes: { ...node.attributes, b: 2 } };
				},
			},
		);

		let result = unwrap(Markdown.walk(parse("# Title"), visitor));

		expect(calls).toEqual(["first", "second saw 1"]);
		expect(result.children[0]).toMatchObject({ attributes: { a: 1, b: 2 } });
	});

	test("hands the original node on when a handler leaves it alone", () => {
		let document = parse("# Title\n\nText");
		let result = unwrap(
			Markdown.walk(document, Markdown.compose({ heading: () => undefined }, { code: () => null })),
		);

		expect(result.children[0]).toBe(document.children[0]);
	});

	test("stops at a handler that removes the node, splices it, or changes its type", () => {
		let after: string[] = [];
		let later = { paragraph: () => void after.push("ran") };

		let removed = unwrap(
			Markdown.walk(parse("Text"), Markdown.compose({ paragraph: () => null }, later)),
		);
		let spliced = unwrap(
			Markdown.walk(parse("Text"), Markdown.compose({ paragraph: (node) => [node, node] }, later)),
		);
		let retyped = unwrap(
			Markdown.walk(
				parse("Text"),
				Markdown.compose(
					{
						paragraph: (node) => ({
							type: "heading" as const,
							level: 2 as const,
							attributes: {},
							children: node.children,
							position: node.position,
						}),
					},
					later,
				),
			),
		);

		expect(removed.children).toEqual([]);
		expect(spliced.children).toHaveLength(2);
		expect(retyped.children[0]?.type).toBe("heading");
		expect(after).toEqual([]);
	});

	test("lets visitors that claim the same type work together", () => {
		let visitor = Markdown.compose(variables({ plan: "pro" }), headings());
		let result = unwrap(Markdown.walk(parse("## Pricing {% data={$plan} %}"), visitor));

		expect(result.children[0]).toMatchObject({ attributes: { data: "pro", id: "pricing" } });
	});

	test("keeps a walk of synchronous visitors synchronous", () => {
		let result = Markdown.walk(parse("x"), Markdown.compose(headings(), variables({})));

		expectTypeOf(result).not.toExtend<Promise<unknown>>();
		expect(result).not.toBeInstanceOf(Promise);
	});

	test("turns asynchronous when any handler is, still running the rest in order", async () => {
		let visitor = Markdown.compose(
			{
				async heading(node) {
					return { ...node, attributes: { ...node.attributes, a: 1 } };
				},
			},
			{
				heading: (node) => ({
					...node,
					attributes: { ...node.attributes, b: node.attributes.a ?? null },
				}),
			},
		);

		let walked = Markdown.walk(parse("# Title"), visitor);
		expectTypeOf(walked).toExtend<Promise<unknown>>();

		let result = await walked;
		if (isFailure(result)) throw result.error;
		expect(result.data.children[0]).toMatchObject({ attributes: { a: 1, b: 1 } });
	});

	test("reports a handler that throws at the node it was on", () => {
		let result = Markdown.walk(
			parse("Intro\n\n# Title"),
			Markdown.compose(
				{ heading: () => undefined },
				{
					heading() {
						throw new Error("nope");
					},
				},
			),
		);

		if (!isFailure(result)) throw new Error("Expected the walk to fail");
		expect(result.error.position?.start.line).toBe(3);
	});
});
