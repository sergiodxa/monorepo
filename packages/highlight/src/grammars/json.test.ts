/**
 * Tests the JSON grammar against the shapes a fence holds: an API response, and
 * the commented configuration a `jsonc` fence writes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer";

import { json } from "./json";

describe("json", () => {
	test("paints a member's name apart from a string value", () => {
		let tokens = scan('{ "name": "auth-saas" }', json);

		expect(tokens).toEqual([
			{ type: "punctuation", value: "{" },
			{ type: "plain", value: " " },
			{ type: "property", value: '"name"' },
			{ type: "operator", value: ":" },
			{ type: "plain", value: " " },
			{ type: "string", value: '"auth-saas"' },
			{ type: "plain", value: " " },
			{ type: "punctuation", value: "}" },
		]);
	});

	test("paints a name the colon follows on the next line", () => {
		let tokens = scan('{\n\t"name"\n\t\t: 1\n}', json);

		expect(tokens).toContainEqual({ type: "property", value: '"name"' });
	});

	test("paints the literals spelled as words", () => {
		let tokens = scan('{ "a": true, "b": false, "c": null }', json);

		expect(tokens.filter((token) => token.type === "boolean")).toEqual([
			{ type: "boolean", value: "true" },
			{ type: "boolean", value: "false" },
		]);
		expect(tokens).toContainEqual({ type: "keyword", value: "null" });
	});

	test("paints every form of number", () => {
		let tokens = scan("[0, 42, -7, 1.5, 6e3, 1.2e-4]", json);

		expect(tokens.filter((token) => token.type === "number").map((token) => token.value)).toEqual([
			"0",
			"42",
			"-7",
			"1.5",
			"6e3",
			"1.2e-4",
		]);
	});

	test("leaves a version unpainted rather than painting its first digits", () => {
		let tokens = scan("[2024-12-01]", json);

		expect(tokens).toEqual([
			{ type: "punctuation", value: "[" },
			{ type: "plain", value: "2024-12-01" },
			{ type: "punctuation", value: "]" },
		]);
	});

	test("paints both comment forms, which is what a jsonc fence needs", () => {
		let tokens = scan('{\n\t// a note\n\t/* and\n\tanother */\n\t"a": 1\n}', json);

		expect(tokens.filter((token) => token.type === "comment").map((token) => token.value)).toEqual([
			"// a note",
			"/* and\n\tanother */",
		]);
	});

	test("keeps a string holding a comment's opening as a string", () => {
		let tokens = scan('{ "url": "https://x.test//y" }', json);

		expect(tokens).toContainEqual({ type: "string", value: '"https://x.test//y"' });
	});

	test("paints a document of commented configuration", () => {
		let code = [
			"// spec/config.jsonc",
			"{",
			'\t"permissions": {',
			"\t\t// A bare string is a whole-family grant (like a bare --allow-<family>);",
			'\t\t"allow": ["run", "plugins", ["env", "DATABASE_URL"]],',
			"\t},",
			"}",
			"",
		].join("\n");

		let tokens = scan(code, json);

		expect(tokens.map((token) => token.value).join("")).toBe(code);
		expect(tokens[0]).toEqual({ type: "comment", value: "// spec/config.jsonc" });
		expect(tokens.filter((token) => token.type === "property").map((token) => token.value)).toEqual(
			['"permissions"', '"allow"'],
		);
		expect(tokens.filter((token) => token.type === "string").map((token) => token.value)).toEqual([
			'"run"',
			'"plugins"',
			'"env"',
			'"DATABASE_URL"',
		]);
	});
});
