/**
 * Tests the scanner's contract — full coverage of the input, merged runs, the
 * mode stack — and the one property every grammar has to hold to be scanned
 * correctly at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Grammar } from "./lexer";

import { compose, scan } from "./lexer";

import { languages } from "./index";

const quoted: Grammar = {
	main: [
		{ type: "string", match: /"/y, push: "string" },
		{ type: "keyword", match: /\blet\b/y },
		{ type: "punctuation", match: /[=;]/y },
	],
	string: [
		{ type: "string", match: /"/y, pop: true },
		{ type: "string", match: /[^"]+/y },
	],
};

describe("scan", () => {
	test("covers the input exactly once", () => {
		let code = 'let greeting = "hello";\n';
		let tokens = scan(code, quoted);

		expect(tokens.map((token) => token.value).join("")).toBe(code);
	});

	test("merges adjacent runs of the same type", () => {
		let tokens = scan('"ab"', quoted);

		expect(tokens).toEqual([{ type: "string", value: '"ab"' }]);
	});

	test("collects what no rule claims into a plain run", () => {
		let tokens = scan("let x", quoted);

		expect(tokens).toEqual([
			{ type: "keyword", value: "let" },
			{ type: "plain", value: " x" },
		]);
	});

	test("matches at the cursor rather than searching ahead", () => {
		let tokens = scan("x = let", quoted);

		expect(tokens[0]).toEqual({ type: "plain", value: "x " });
	});

	test("stays in a pushed mode until a rule pops it", () => {
		let tokens = scan('"let" let', quoted);

		expect(tokens).toEqual([
			{ type: "string", value: '"let"' },
			{ type: "plain", value: " " },
			{ type: "keyword", value: "let" },
		]);
	});

	test("returns nothing for empty source", () => {
		expect(scan("", quoted)).toEqual([]);
	});
});

describe("compose", () => {
	test("tries the earlier grammar's rules first", () => {
		let first: Grammar = { main: [{ type: "keyword", match: /a/y }] };
		let second: Grammar = { main: [{ type: "string", match: /a/y }] };

		expect(scan("a", compose(first, second))).toEqual([{ type: "keyword", value: "a" }]);
	});

	test("keeps every mode either grammar defines", () => {
		let merged = compose(quoted, { extra: [{ type: "plain", match: /x/y }] });

		expect(Object.keys(merged).sort()).toEqual(["extra", "main", "string"]);
	});
});

describe("languages", () => {
	/**
	 * A rule's pattern is applied with `lastIndex`, which a pattern without the
	 * sticky flag ignores: it would search the rest of the document and match
	 * something the scanner never reached.
	 */
	test("every rule matches only at the cursor", () => {
		let loose = Object.entries(languages).flatMap(([name, grammar]) =>
			Object.entries(grammar).flatMap(([mode, rules]) =>
				rules
					.filter((rule) => !rule.match.sticky || rule.match.global)
					.map((rule) => `${name}.${mode}: ${rule.match}`),
			),
		);

		expect(loose).toEqual([]);
	});

	/**
	 * A rule that matches the empty string never advances the cursor, and the
	 * scanner would hand the same position to it forever.
	 */
	test("no rule matches an empty string", () => {
		let empty = Object.entries(languages).flatMap(([name, grammar]) =>
			Object.entries(grammar).flatMap(([mode, rules]) =>
				rules
					.filter((rule) => {
						rule.match.lastIndex = 0;
						return rule.match.test("");
					})
					.map((rule) => `${name}.${mode}: ${rule.match}`),
			),
		);

		expect(empty).toEqual([]);
	});

	/**
	 * A rule pushing a mode the grammar never defines leaves the scanner with no
	 * rules to try, so the rest of the source comes back as one plain run.
	 */
	test("pushes only modes the grammar defines", () => {
		let dangling = Object.entries(languages).flatMap(([name, grammar]) =>
			Object.entries(grammar).flatMap(([mode, rules]) =>
				rules
					.filter((rule) => rule.push && !grammar[rule.push])
					.map((rule) => `${name}.${mode} pushes ${rule.push}`),
			),
		);

		expect(dangling).toEqual([]);
	});
});
