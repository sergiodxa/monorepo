/**
 * Tests the YAML grammar against the shapes a fence holds: a service
 * configuration, a document's frontmatter, and a block scalar's literal body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer";

import { yaml } from "./yaml";

describe("yaml", () => {
	test("paints a mapping key apart from its scalar", () => {
		let tokens = scan("name: uptime\n", yaml);

		expect(tokens).toEqual([
			{ type: "property", value: "name" },
			{ type: "punctuation", value: ":" },
			{ type: "plain", value: " " },
			{ type: "string", value: "uptime" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("paints a key that opens a sequence entry", () => {
		let tokens = scan("databases:\n  - binding: DB\n    name: uptime\n", yaml);

		expect(tokens.filter((token) => token.type === "property").map((token) => token.value)).toEqual(
			["databases", "binding", "name"],
		);
		expect(tokens).toContainEqual({ type: "punctuation", value: "-" });
	});

	test("keeps a hyphen inside a word out of the sequence dash", () => {
		let tokens = scan("- security-lead\n", yaml);

		expect(tokens).toEqual([
			{ type: "punctuation", value: "-" },
			{ type: "plain", value: " " },
			{ type: "string", value: "security-lead" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("paints the document markers", () => {
		let tokens = scan("---\ntitle: A post\n...\n", yaml);

		expect(
			tokens.filter((token) => token.type === "punctuation").map((token) => token.value),
		).toEqual(["---", ":", "..."]);
	});

	test("paints a comment, and keeps a hash inside a word as text", () => {
		let tokens = scan("host: example.test # the apex\ntag: v1#2\n", yaml);

		expect(tokens).toContainEqual({ type: "comment", value: "# the apex" });
		expect(tokens).toContainEqual({ type: "string", value: "example.test" });
		expect(tokens).toContainEqual({ type: "string", value: "v1#2" });
	});

	test("paints an anchor, an alias and a tag", () => {
		let tokens = scan("defaults: &base\njob:\n  <<: *base\n  count: !!int 2\n", yaml);

		expect(tokens.filter((token) => token.type === "variable").map((token) => token.value)).toEqual(
			["&base", "*base"],
		);
		expect(tokens).toContainEqual({ type: "keyword", value: "!!int" });
		expect(tokens).toContainEqual({ type: "property", value: "<<" });
	});

	test("paints numbers, booleans and null, and keeps a date whole", () => {
		let tokens = scan(
			"retries: 3\nratio: 1.5\ndraft: false\nexcerpt: null\nsince: 2026-09-02\n",
			yaml,
		);

		expect(tokens).toContainEqual({ type: "number", value: "3" });
		expect(tokens).toContainEqual({ type: "number", value: "1.5" });
		expect(tokens).toContainEqual({ type: "boolean", value: "false" });
		expect(tokens).toContainEqual({ type: "keyword", value: "null" });
		expect(tokens).toContainEqual({ type: "string", value: "2026-09-02" });
	});

	test("paints a quoted scalar, including one holding a colon", () => {
		let tokens = scan(`crons:\n  - "0 0 * * *"\n  - 'it''s fine'\n`, yaml);

		expect(tokens).toContainEqual({ type: "string", value: '"0 0 * * *"' });
		expect(tokens).toContainEqual({ type: "string", value: "'it''s fine'" });
	});

	test("leaves the body of a block scalar as literal text", () => {
		let code = "script: |\n  bun run build\n  echo done: yes\nafter: ok\n";

		let tokens = scan(code, yaml);

		expect(tokens.map((token) => token.value).join("")).toBe(code);
		expect(tokens).toEqual([
			{ type: "property", value: "script" },
			{ type: "punctuation", value: ":" },
			{ type: "plain", value: " " },
			{ type: "punctuation", value: "|" },
			{ type: "string", value: "\n  bun run build\n  echo done: yes" },
			{ type: "plain", value: "\n" },
			{ type: "property", value: "after" },
			{ type: "punctuation", value: ":" },
			{ type: "plain", value: " " },
			{ type: "string", value: "ok" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("ends a block scalar at the first line indented less than its body", () => {
		let code = "job:\n  script: >-\n    folded text\n    continues here\n  after: done\n";

		let tokens = scan(code, yaml);

		expect(tokens.map((token) => token.value).join("")).toBe(code);
		expect(tokens).toContainEqual({ type: "punctuation", value: ">-" });
		expect(tokens).toContainEqual({ type: "property", value: "after" });
	});

	test("paints a frontmatter block", () => {
		let code = [
			"---",
			"title: A post about YAML",
			"tags: [remix, workers]",
			"draft: false",
			"published: 2026-09-02",
			"---",
			"",
		].join("\n");

		let tokens = scan(code, yaml);

		expect(tokens.map((token) => token.value).join("")).toBe(code);
		expect(tokens.filter((token) => token.type === "property").map((token) => token.value)).toEqual(
			["title", "tags", "draft", "published"],
		);
		expect(tokens).toContainEqual({ type: "string", value: "A post about YAML" });
	});
});
