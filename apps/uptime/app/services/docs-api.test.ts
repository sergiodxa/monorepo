/**
 * Tests the API reference layout: an endpoint section splits into a prose column and a
 * code column, its method and path become a chip, and a cURL example gains a `fetch` twin
 * only when it is one plain request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { headings } from "@sdxc/markdown/plugin/headings";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { MARKDOWN_OPTIONS } from "./docs";
import { curlToFetch, endpointSections } from "./docs-api";

/** A page as the docs controller hands it over: parsed, with ids, painted. */
function page(source: string): Markdown.Document {
	let { document } = unwrap(
		Markdown.parse(
			`---\ntitle: T\ndescription: D\nsection:\n  title: S\n  order: 1\norder: 1\n---\n\n${source}`,
			MARKDOWN_OPTIONS,
		),
	);
	return unwrap(Markdown.walk(unwrap(Markdown.walk(document, headings())), highlight));
}

/** The names of a node's tag children, for asserting a column's order. */
function names(node: Markdown.Node | undefined): string[] {
	if (!node || !("children" in node)) return [];
	return (node.children as Markdown.Node[]).map((child) =>
		child.type === "tag" ? child.name : child.type,
	);
}

const SECTION = [
	"Intro prose.",
	"",
	"## List Monitors",
	"",
	"Retrieve all monitors.",
	"",
	"```",
	"GET /api/v1/monitors",
	"```",
	"",
	'<operation name="monitorsIndex" />',
	"",
	"### Query Parameters",
	"",
	"| Parameter | Type |",
	"| --- | --- |",
	"| `perPage` | integer |",
	"",
	"### cURL",
	"",
	"```bash",
	'curl "https://uptime.sergiodxa.com/api/v1/monitors" \\',
	'  -H "Authorization: Bearer key"',
	"```",
	"",
	"### Response",
	"",
	"```json",
	'{ "data": {} }',
	"```",
].join("\n");

describe("endpointSections", () => {
	test("splits an endpoint into prose and code, with its path as a chip", () => {
		let document = endpointSections(page(SECTION));
		let endpoint = document.children.find(
			(node) => node.type === "tag" && node.name === "endpoint",
		);
		let [main, code] =
			endpoint && "children" in endpoint ? (endpoint.children as Markdown.Node[]) : [];

		expect(names(document)).toEqual(["paragraph", "endpoint"]);
		expect(names(main)).toEqual([
			"heading",
			"endpoint-path",
			"paragraph",
			"operation",
			"heading",
			"fields",
			"operation-details",
		]);
		expect(names(code)).toEqual(["request", "code-label", "code"]);
	});

	test("leaves a section that documents no operation as prose", () => {
		let document = endpointSections(page("## Rules\n\nSome rules.\n\n### Response\n\nText."));
		expect(names(document)).toEqual(["heading", "paragraph", "heading", "paragraph"]);
	});
});

describe("curlToFetch", () => {
	test("writes a JSON body as an object through JSON.stringify", () => {
		let source = [
			"curl https://uptime.sergiodxa.com/api/v1/monitors \\",
			'  -H "Content-Type: application/json" \\',
			`  -d '{"name": "API"}'`,
		].join("\n");

		expect(curlToFetch(source)).toBe(
			[
				'let response = await fetch("https://uptime.sergiodxa.com/api/v1/monitors", {',
				'\tmethod: "POST",',
				"\theaders: {",
				'\t\t"Content-Type": "application/json",',
				"\t},",
				"\tbody: JSON.stringify({",
				'\t\t"name": "API"',
				"\t}),",
				"});",
				"let result = await response.json();",
			].join("\n"),
		);
	});

	test("keeps an explicit method", () => {
		expect(
			curlToFetch("curl -X DELETE https://uptime.sergiodxa.com/api/v1/monitors/mon_1"),
		).toContain('method: "DELETE"');
	});

	test("answers nothing for a script, a pipe or an output file", () => {
		expect(curlToFetch("curl -s https://x.com | jq .")).toBeNull();
		expect(curlToFetch("curl https://x.com -o out.csv")).toBeNull();
		expect(curlToFetch("status=$(curl https://x.com)")).toBeNull();
	});
});
