/**
 * Checks the attribute values beyond a literal through the whole pipeline: a tag or an
 * annotation holding a variable, an array or an object, the schema check a variable
 * defers, and the writers that turn those values back into source and into markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { toHTML } from "../html/index.js";
import { Markdown } from "../index.js";

/** A tag whose schema a literal attribute is checked against at parse time. */
const OPTIONS = {
	tags: {
		video: { content: "none", attributes: s.object({ src: s.string() }) },
		chart: { content: "none" },
		kbd: { content: "inline", attributes: s.object({ title: s.string() }) },
	},
} satisfies Markdown.Options;

/**
 * @param source - The markdown to read
 * @returns The parsed document, failing the test when the parser rejected it
 */
function parse(source: string): Markdown.Document {
	return unwrap(Markdown.parse(source, OPTIONS)).document;
}

describe("parsing", () => {
	test("a block tag's variable attribute is a variable node located in the source", () => {
		let [, tag] = parse("Intro\n\n<video src={$cdn} />").children;

		expect(tag).toMatchObject({
			type: "tag",
			name: "video",
			attributes: {
				src: {
					type: "variable",
					name: "cdn",
					position: {
						start: { line: 3, column: 13, offset: 19 },
						end: { line: 3, column: 17, offset: 23 },
					},
				},
			},
		});
	});

	test("an inline tag's variable attribute is located in the source", () => {
		let [paragraph] = parse("Press <kbd title={$label}>K</kbd>").children;

		expect(paragraph).toMatchObject({
			children: [
				{ type: "text" },
				{
					type: "tag",
					attributes: {
						title: {
							type: "variable",
							name: "label",
							position: { start: { line: 1, column: 19, offset: 18 } },
						},
					},
				},
			],
		});
	});

	test("arrays and objects reach a tag's attributes as structured values", () => {
		let [tag] = parse(
			'<chart data={[1, 2, 3]} options={{ stacked: true, label: "x" }} />',
		).children;

		expect(tag).toMatchObject({
			attributes: { data: [1, 2, 3], options: { stacked: true, label: "x" } },
		});
	});

	test("an annotation holds a variable on its own line and after a heading", () => {
		let [paragraph, heading] = parse(
			"{% plan={$plan} %}\nText\n\n## Pricing {% plan={$plan} %}",
		).children;

		expect(paragraph).toMatchObject({
			attributes: { plan: { type: "variable", name: "plan" } },
		});
		expect(heading).toMatchObject({
			attributes: {
				plan: {
					type: "variable",
					name: "plan",
					position: { start: { line: 4, column: 21, offset: 45 } },
				},
			},
		});
	});

	test("a fence's annotation holds a variable", () => {
		let [code] = parse("```ts {% version={$version} %}\nlet x;\n```").children;

		expect(code).toMatchObject({
			language: "ts",
			attributes: {
				version: {
					type: "variable",
					name: "version",
					position: { start: { line: 1, column: 19, offset: 18 } },
				},
			},
		});
	});

	test("a literal attribute is still checked against the schema at parse time", () => {
		let result = Markdown.parse("<video src={42} />", OPTIONS);

		expect(isFailure(result) && result.error.message).toBe("Invalid attributes for <video>");
	});

	test("an attribute holding a variable defers the schema check", () => {
		let [tag] = parse("<video src={$cdn} />").children;

		expect(tag).toMatchObject({ attributes: { src: { type: "variable", name: "cdn" } } });
	});

	test("a variable nested in an array defers the schema check too", () => {
		let [tag] = parse("<video src={[$cdn]} />").children;

		expect(tag).toMatchObject({ attributes: { src: [{ type: "variable", name: "cdn" }] } });
	});
});

describe("stringify", () => {
	test("writes variables, arrays and objects back as they were spelled", () => {
		let source =
			'<chart data={[1, "two", $three]} options={{ stacked: true, "max-width": $width }} />\n';

		expect(unwrap(Markdown.stringify(parse(source)))).toBe(source);
	});

	test("writes an annotation's variable back", () => {
		let source = "## Pricing {% plan={$plan} %}\n";

		expect(unwrap(Markdown.stringify(parse(source)))).toBe(source);
	});

	test("writes null, an empty array and an empty object", () => {
		let source = "<chart a={null} b={[]} c={{}} />\n";

		expect(unwrap(Markdown.stringify(parse(source)))).toBe(source);
	});
});

describe("toHTML", () => {
	test("writes a structured annotation value as JSON in its data attribute", () => {
		let html = toHTML(parse('{% config={{ a: [1, "x"] }} %}\nText'));

		expect(html).toBe('<p data-config="{&quot;a&quot;:[1,&quot;x&quot;]}">Text</p>');
	});

	test("writes an unresolved variable as the spelling the source used", () => {
		let html = toHTML(parse("{% plan={$plan} %}\nText"));

		expect(html).toBe('<p data-plan="{$plan}">Text</p>');
	});

	test("hands a tag renderer the structured values", () => {
		let html = toHTML(parse("<chart data={[1, 2]} />"), {
			tags: { chart: ({ attributes }) => `<canvas>${JSON.stringify(attributes.data)}</canvas>` },
		});

		expect(html).toBe("<canvas>[1,2]</canvas>");
	});
});
