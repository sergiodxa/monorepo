/**
 * Checks the visitor that fills a document's variables: text holes and attribute
 * values alike, the schema check a variable deferred at parse time, and the two ways
 * a caller may treat a name it has no value for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { Markdown as MarkdownTypes } from "../index.js";

import { Markdown, MarkdownParseError } from "../index.js";

import { variables } from "./variables.js";

/** Tags whose schemas the deferred check runs, one of them coercing what it reads. */
const OPTIONS = {
	tags: {
		video: { content: "none", attributes: s.object({ src: s.string() }) },
		stat: { content: "inline", attributes: s.object({ value: coerce.number() }) },
		chart: { content: "none" },
	},
} satisfies MarkdownTypes.Options;

/**
 * @param source - The markdown to read
 * @returns The parsed document, failing the test when the parser rejected it
 */
function parse(source: string): MarkdownTypes.Document {
	return unwrap(Markdown.parse(source, OPTIONS)).document;
}

describe("variables", () => {
	test("fills a text hole with the value's text", () => {
		let result = Markdown.walk(
			parse("Hello {% $name %}, {% $count %} {% $ok %}"),
			variables({
				name: "Ada",
				count: 3,
				ok: true,
			}),
		);

		expect(unwrap(result).children[0]).toMatchObject({
			children: [
				{ type: "text", value: "Hello " },
				{ type: "text", value: "Ada" },
				{ type: "text", value: ", " },
				{ type: "text", value: "3" },
				{ type: "text", value: " " },
				{ type: "text", value: "true" },
			],
		});
	});

	test("fills variables in a tag's attributes, nested ones included", () => {
		let document = parse("<chart data={[1, $two, { n: $three }]} title={$title} />");
		let result = Markdown.walk(document, variables({ two: 2, three: [3], title: "Sales" }));

		expect(unwrap(result).children[0]).toMatchObject({
			attributes: { data: [1, 2, { n: [3] }], title: "Sales" },
		});
	});

	test("fills variables in an annotation", () => {
		let result = Markdown.walk(parse("## Plans {% plan={$plan} %}"), variables({ plan: "pro" }));

		expect(unwrap(result).children[0]).toMatchObject({ attributes: { plan: "pro" } });
	});

	test("runs the schema a variable deferred, keeping what it coerced", () => {
		let document = parse("<stat value={$count}>Monitors</stat>");
		let result = Markdown.walk(document, variables({ count: "12" }, OPTIONS));

		expect(unwrap(result).children[0]).toMatchObject({
			type: "tag",
			attributes: { value: 12 },
			children: [{ type: "text", value: "Monitors" }],
		});
	});

	test("fails at the tag when a filled-in value breaks its schema", () => {
		let result = Markdown.walk(
			parse("Intro\n\n<video src={$cdn} />"),
			variables({ cdn: 42 }, OPTIONS),
		);

		if (!isFailure(result)) throw new Error("Expected the walk to fail");
		expect(result.error.position?.start.line).toBe(3);
		expect(result.error.cause).toBeInstanceOf(MarkdownParseError);
		expect((result.error.cause as MarkdownParseError).message).toBe(
			"Invalid attributes for <video>",
		);
		expect((result.error.cause as MarkdownParseError).issues.length).toBeGreaterThan(0);
	});

	test("leaves a tag whose schema it was not given as filled in", () => {
		let result = Markdown.walk(parse("<video src={$cdn} />"), variables({ cdn: 42 }));

		expect(unwrap(result).children[0]).toMatchObject({ attributes: { src: 42 } });
	});

	test("fails at the variable a value is missing for", () => {
		let result = Markdown.walk(parse("Text\n\nHi {% $who %}"), variables({}));

		if (!isFailure(result)) throw new Error("Expected the walk to fail");
		expect(result.error.position?.start).toEqual({ line: 3, column: 4, offset: 9 });
		expect((result.error.cause as Error).message).toBe("No value for $who");
	});

	test("fails at an attribute's variable a value is missing for", () => {
		let result = Markdown.walk(parse("<chart data={[$missing]} />"), variables({}));

		if (!isFailure(result)) throw new Error("Expected the walk to fail");
		expect((result.error.cause as Error).message).toBe("No value for $missing");
	});

	test("keeps a missing variable in place when asked to", () => {
		let document = parse("Hi {% $who %}\n\n<chart data={$rows} />");
		let result = unwrap(Markdown.walk(document, variables({}, { missing: "keep" })));

		expect(result.children[0]).toMatchObject({ children: [{}, { type: "variable", name: "who" }] });
		expect(result.children[1]).toMatchObject({
			attributes: { data: { type: "variable", name: "rows" } },
		});
	});

	test("fails when a text hole's value has no text form", () => {
		let result = Markdown.walk(parse("Rows: {% $rows %}"), variables({ rows: [1, 2] }));

		if (!isFailure(result)) throw new Error("Expected the walk to fail");
		expect((result.error.cause as Error).message).toBe(
			"$rows holds a list, and only a string, number or boolean can stand in text",
		);
	});

	test("fills a dotted path by walking objects and indexing arrays", () => {
		let document = parse(
			"Plan {% $plan.name %} costs {% $plan.price %}\n\n<chart data={[$items.1.n, $plan.tags]} />",
		);
		let result = unwrap(
			Markdown.walk(
				document,
				variables({
					plan: { name: "Pro", price: 12, tags: ["a"] },
					items: [{ n: 1 }, { n: 2 }],
				}),
			),
		);

		expect(result.children[0]).toMatchObject({
			children: [
				{ type: "text", value: "Plan " },
				{ type: "text", value: "Pro" },
				{ type: "text", value: " costs " },
				{ type: "text", value: "12" },
			],
		});
		expect(result.children[1]).toMatchObject({ attributes: { data: [2, ["a"]] } });
	});

	test("fails naming the full path when a segment is missing", () => {
		let result = Markdown.walk(parse("x {% $plan.price %}"), variables({ plan: { name: "Pro" } }));

		if (!isFailure(result)) throw new Error("Expected the walk to fail");
		expect((result.error.cause as Error).message).toBe("No value for $plan.price");
	});

	test("reads only own properties and array indexes along a path", () => {
		let cases: [string, Record<string, MarkdownTypes.AttributeValue>, string][] = [
			["x {% $plan.toString %}", { plan: {} }, "No value for $plan.toString"],
			["x {% $plan.__proto__ %}", { plan: {} }, "No value for $plan.__proto__"],
			["x {% $items.length %}", { items: [1] }, "No value for $items.length"],
			["x {% $items.3 %}", { items: [1] }, "No value for $items.3"],
			["x {% $name.0 %}", { name: "Ada" }, "No value for $name.0"],
			["x {% $none.x %}", { none: null }, "No value for $none.x"],
		];

		for (let [source, values, message] of cases) {
			let result = Markdown.walk(parse(source), variables(values));
			if (!isFailure(result)) throw new Error(`Expected ${source} to fail`);
			expect((result.error.cause as Error).message).toBe(message);
		}
	});

	test("keeps a dotted variable whose path is missing when asked to", () => {
		let document = parse("x {% $plan.price %}");
		let result = unwrap(Markdown.walk(document, variables({ plan: {} }, { missing: "keep" })));

		expect(result.children[0]).toMatchObject({
			children: [{}, { type: "variable", name: "plan.price" }],
		});
	});

	test("fails when a dotted text hole ends on a value with no text form", () => {
		let result = Markdown.walk(parse("x {% $plan.tags %}"), variables({ plan: { tags: [] } }));

		if (!isFailure(result)) throw new Error("Expected the walk to fail");
		expect((result.error.cause as Error).message).toBe(
			"$plan.tags holds a list, and only a string, number or boolean can stand in text",
		);
	});

	test("hands back the node itself when it holds no variable", () => {
		let document = parse("# Plain\n\n<chart data={[1]} />");
		let result = unwrap(Markdown.walk(document, variables({})));

		expect(result.children[0]).toBe(document.children[0]);
		expect(result.children[1]).toBe(document.children[1]);
	});

	test("walks synchronously", () => {
		let result = Markdown.walk(parse("x"), variables({}));

		expectTypeOf(result).not.toExtend<Promise<unknown>>();
	});
});
