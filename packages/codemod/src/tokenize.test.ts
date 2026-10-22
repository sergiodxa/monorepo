/**
 * The scanner's own contract: which extensions it reads, the token it gives each ambiguous
 * construct, and the failures that keep an edit from being computed over input it lost its
 * place in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import { languageOf, tokenize } from "./tokenize.js";

/** The `type value` of every token in `source`, comments and JSX included. */
function tokens(filename: string, source: string): string[] {
	return unwrap(tokenize(filename, source)).map((token) => `${token.type} ${token.value}`);
}

/** The error code and message `tokenize` fails with. */
function failureOf(filename: string, source: string): string {
	let result = tokenize(filename, source);
	if (!isFailure(result)) throw new Error("expected a failure");
	return `${result.error.code}: ${result.error.message}`;
}

describe("languageOf", () => {
	test("reads JSX in every extension but .ts, .mts and .cts, and TypeScript only in those and .tsx", () => {
		expect(languageOf("a.js")).toEqual({ typescript: false, jsx: true });
		expect(languageOf("a.mjs")).toEqual({ typescript: false, jsx: true });
		expect(languageOf("a.cjs")).toEqual({ typescript: false, jsx: true });
		expect(languageOf("a.jsx")).toEqual({ typescript: false, jsx: true });
		expect(languageOf("a.mts")).toEqual({ typescript: true, jsx: false });
		expect(languageOf("a.d.ts")).toEqual({ typescript: true, jsx: false });
		expect(languageOf("a.tsx")).toEqual({ typescript: true, jsx: true });
		expect(languageOf("a.json")).toBeNull();
	});
});

describe("tokenize", () => {
	test("reads a < in expression position of a .js file as JSX and after an operand as less-than", () => {
		expect(tokens("a.js", "a < b; <p>a &lt; b</p>")).toEqual([
			"identifier a",
			"punctuator <",
			"identifier b",
			"punctuator ;",
			"jsx <",
			"jsx p",
			"jsx >",
			"jsx a &lt; b",
			"jsx </",
			"jsx p",
			"jsx >",
		]);
	});

	test("reads a / after an if head as a regular expression and after an operand as division", () => {
		expect(tokens("a.js", "if (x) /re/.test(y); a / b")).toEqual([
			"identifier if",
			"punctuator (",
			"identifier x",
			"punctuator )",
			"regex /re/",
			"punctuator .",
			"identifier test",
			"punctuator (",
			"identifier y",
			"punctuator )",
			"punctuator ;",
			"identifier a",
			"punctuator /",
			"identifier b",
		]);
	});

	test("returns to a template literal from the } that closes a nested substitution", () => {
		expect(tokens("a.js", "`a ${`b ${c}`} d`")).toEqual([
			"template-head `a ${",
			"template-head `b ${",
			"identifier c",
			"template-tail }`",
			"template-tail } d`",
		]);
	});

	test("reads JSX text as markup, so an apostrophe opens no string", () => {
		expect(tokens("a.tsx", "<p>Don't</p>")).toEqual([
			"jsx <",
			"jsx p",
			"jsx >",
			"jsx Don't",
			"jsx </",
			"jsx p",
			"jsx >",
		]);
	});

	test("reads < as a comparison in .ts files", () => {
		expect(tokens("a.ts", "a <b> c")).toEqual([
			"identifier a",
			"punctuator <",
			"identifier b",
			"punctuator >",
			"identifier c",
		]);
	});

	test("records whether a line break precedes a token", () => {
		let scanned = unwrap(tokenize("a.ts", "a\n// note\nb c"));

		expect(scanned.map((token) => token.newlineBefore)).toEqual([false, true, true, false]);
	});

	test("fails on input that ends inside a construct", () => {
		expect(failureOf("a.ts", 'let a = "open')).toBe(
			"unterminated: a.ts:1:9: string is never closed",
		);
		expect(failureOf("a.ts", "let a = `open ${b}")).toBe(
			"unterminated: a.ts:1:9: template literal is never closed",
		);
		expect(failureOf("a.ts", "let a = /open")).toBe(
			"unterminated: a.ts:1:9: regular expression is never closed",
		);
		expect(failureOf("a.ts", "/* open")).toBe("unterminated: a.ts:1:1: comment is never closed");
		expect(failureOf("a.tsx", "let a = <div>open")).toBe(
			"unterminated: a.tsx:1:9: JSX element is never closed",
		);
		expect(failureOf("a.ts", "f(a, {")).toBe("unterminated: a.ts:1:6: `{` is never closed");
	});

	test("fails on brackets that do not pair and on characters no token starts with", () => {
		expect(failureOf("a.ts", "f(a]")).toBe("unbalanced: a.ts:1:4: unexpected `]`");
		expect(failureOf("a.ts", "a # b")).toBe(
			"unexpected-character: a.ts:1:3: unexpected character `#`",
		);
		expect(failureOf("a.json", "{}")).toBe(
			"unsupported-file: a.json: only .js, .mjs, .cjs, .jsx, .ts, .mts, .cts and .tsx files can be scanned",
		);
	});
});
