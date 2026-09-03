/**
 * Tests the JavaScript grammar, and with it the two things the rule list gets
 * asked to decide: whether a `/` divides or opens a regular expression, and
 * where a template literal stops being a string.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer.js";

import { javascript } from "./javascript.js";

/**
 * The types the grammar assigns, in order, for the runs it painted.
 *
 * @param code - Source to scan
 * @returns One `type:value` entry per token that is not plain
 */
function painted(code: string): string[] {
	return scan(code, javascript)
		.filter((token) => token.type !== "plain")
		.map((token) => `${token.type}:${token.value}`);
}

describe("javascript", () => {
	test("paints both comment forms", () => {
		expect(painted("// one\n/* two */")).toEqual(["comment:// one", "comment:/* two */"]);
	});

	test("paints strings, and keeps an unterminated one from swallowing the line", () => {
		expect(painted("\"a\" + 'b'")).toEqual(['string:"a"', "operator:+", "string:'b'"]);
		expect(scan('"a\nlet', javascript).at(-1)).toEqual({ type: "keyword", value: "let" });
	});

	test("reads a template literal as string until an interpolation", () => {
		expect(painted("`a${b}c`")).toEqual([
			"string:`a",
			"punctuation:${",
			"punctuation:}",
			"string:c`",
		]);
	});

	test("returns to the template after a nested brace closes", () => {
		expect(painted("`${ {a:1} }` + 1")).toEqual([
			"string:`",
			"punctuation:${",
			"punctuation:{",
			"property:a",
			"operator::",
			"number:1",
			"punctuation:}",
			"punctuation:}",
			"string:`",
			"operator:+",
			"number:1",
		]);
	});

	test("opens a regular expression where a value can start", () => {
		expect(painted("let re = /ab+/g;")).toEqual([
			"keyword:let",
			"operator:=",
			"regex:/ab+/g",
			"punctuation:;",
		]);
	});

	test("divides where a value cannot start", () => {
		expect(painted("a / b / c")).toEqual(["operator:/", "operator:/"]);
	});

	test("paints keywords, booleans and the word-shaped literals", () => {
		expect(painted("return true, null, undefined")).toEqual([
			"keyword:return",
			"boolean:true",
			"punctuation:,",
			"keyword:null",
			"punctuation:,",
			"keyword:undefined",
		]);
	});

	test("paints numbers in every base, and separators inside them", () => {
		expect(painted("1_000 0xff 0b1010 1e9 .5 10n")).toEqual([
			"number:1_000",
			"number:0xff",
			"number:0b1010",
			"number:1e9",
			"number:.5",
			"number:10n",
		]);
	});

	test("separates a key in an object literal from a name being annotated", () => {
		expect(painted("{ key: value }")).toEqual([
			"punctuation:{",
			"property:key",
			"operator::",
			"punctuation:}",
		]);
	});

	test("paints a called name as a function and a capitalized one as a class", () => {
		expect(painted("new Thing(fn())")).toEqual([
			"keyword:new",
			"class-name:Thing",
			"punctuation:(",
			"function:fn",
			"punctuation:())",
		]);
	});

	test("leaves a member reached through a dot as its own name", () => {
		expect(painted("u.var(1) + Location.from(x)")).toEqual([
			"punctuation:.",
			"function:var",
			"punctuation:(",
			"number:1",
			"punctuation:)",
			"operator:+",
			"class-name:Location",
			"punctuation:.",
			"function:from",
			"punctuation:(",
			"punctuation:)",
		]);
	});

	test("paints a logical not", () => {
		expect(painted("if (!x) y")).toEqual([
			"keyword:if",
			"punctuation:(",
			"operator:!",
			"punctuation:)",
		]);
	});

	test("keeps a screaming-case name out of the class-name rule", () => {
		expect(painted("MAX_AGE + Max")).toEqual(["constant:MAX_AGE", "operator:+", "class-name:Max"]);
	});

	test("covers a multi-line module exactly once", () => {
		let code = [
			"import { join } from 'node:path';",
			"",
			"/** Joins two segments. */",
			"export function link(a, b) {",
			"\tlet url = `${a}/${b}`;",
			"\treturn url.replace(/\\/+/g, '/');",
			"}",
			"",
		].join("\n");

		let tokens = scan(code, javascript);

		expect(tokens.map((token) => token.value).join("")).toBe(code);
		expect(tokens.some((token) => token.type === "comment")).toBe(true);
		expect(tokens.some((token) => token.type === "regex")).toBe(true);
	});
});
