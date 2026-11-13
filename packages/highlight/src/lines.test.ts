/**
 * Tests the line form of the scanner — one entry per line, the state each
 * line ends in, and resuming from that state — and the line length cap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { javascript } from "./grammars/javascript.js";
import { markdown } from "./grammars/markdown.js";
import { scan, scanLines } from "./lexer.js";

import { tokenize, tokenizeLines } from "./index.js";

describe("scanLines", () => {
	test("returns one entry per line, each without its newline", () => {
		let lines = scanLines("let a = 1;\n\nb\n", javascript);

		expect(lines.map((line) => line.tokens.map((token) => token.value).join(""))).toEqual([
			"let a = 1;",
			"",
			"b",
			"",
		]);
		expect(lines[1]?.tokens).toEqual([]);
	});

	test("splits a token that spans lines into one run per line", () => {
		let lines = scanLines("a /* b\nc */ d", javascript);

		expect(lines[0]?.tokens.at(-1)).toEqual({ type: "comment", value: "/* b" });
		expect(lines[1]?.tokens[0]).toEqual({ type: "comment", value: "c */" });
	});

	test("records the modes each line ends in", () => {
		let lines = scanLines("let a = `x\n${b}\ny`;\n", javascript);

		expect(lines.map((line) => line.state)).toEqual([
			["main", "template"],
			["main", "template"],
			["main"],
			["main"],
		]);
	});

	test("resumes a chunk from the state a line ended in", () => {
		let code = "# Title\n\n```ts\nlet a = 1;\n```\nafter *this*\n";
		let whole = scanLines(code, markdown);
		let chunk = scanLines("let a = 1;\n```\nafter *this*\n", markdown, { state: whole[2]?.state });

		expect(chunk).toEqual(whole.slice(3));
	});

	test("ends an empty source in the state it started in", () => {
		expect(scanLines("", javascript, { state: ["main", "template"] })).toEqual([
			{ tokens: [], state: ["main", "template"] },
		]);
	});
});

describe("tokenizeLines", () => {
	test("resolves the language the way tokenize does", () => {
		let code = "let a = 1;\nlet b = 2;";

		expect(tokenizeLines(code, "ts").flatMap((line) => line.tokens)).toEqual(
			tokenize("let a = 1;", "ts").concat(tokenize("let b = 2;", "ts")),
		);
	});

	test("returns each line as plain text for a language with no grammar", () => {
		expect(tokenizeLines("a\n\nb", "hcl")).toEqual([
			{ tokens: [{ type: "plain", value: "a" }], state: ["main"] },
			{ tokens: [], state: ["main"] },
			{ tokens: [{ type: "plain", value: "b" }], state: ["main"] },
		]);
	});
});

describe("maxLineLength", () => {
	test("paints the rest of a long line plain and reads the next line normally", () => {
		let tokens = scan("let a = 1;\nlet b = 2;", javascript, { maxLineLength: 5 });

		expect(tokens).toEqual([
			{ type: "keyword", value: "let" },
			{ type: "plain", value: " a = 1;\n" },
			{ type: "keyword", value: "let" },
			{ type: "plain", value: " b = 2;" },
		]);
	});

	test("caps a line at 2,000 characters by default", () => {
		let line = "x(1);".repeat(500);
		let tokens = scan(`${line}\nlet`, javascript);

		expect(tokens.at(-2)?.value.length).toBeGreaterThan(400);
		expect(tokens.at(-1)).toEqual({ type: "keyword", value: "let" });
	});

	test("reads every line in full when the cap is Infinity", () => {
		let line = "x(1);".repeat(500);

		expect(
			scan(line, javascript, { maxLineLength: Infinity }).filter((t) => t.type === "function"),
		).toHaveLength(500);
	});
});
