/**
 * Holds the scanner to the tokens the original one produced, input for input:
 * every grammar test literal, a sample of the repository's own files, and
 * seeded splices of both, through every grammar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { firstCharacters } from "./dispatch.js";
import { repositoryFiles, splices, testLiterals } from "./fixtures/corpus.js";
import { referenceScan } from "./fixtures/reference-lexer.js";
import { scan, scanLines } from "./lexer.js";

import { languages } from "./index.js";

const LITERALS = testLiterals();
const FILES = repositoryFiles();
const SPLICES = splices([...LITERALS, ...FILES], 400);
const GRAMMARS = Object.entries(languages);

describe("the corpus", () => {
	test("covers every grammar's tests and every sampled kind of file", () => {
		let tested = new Set(LITERALS.map((sample) => sample.language));
		let kinds = new Set(FILES.map((sample) => sample.language));

		expect(LITERALS.length).toBeGreaterThan(500);
		for (let name of Object.keys(languages).filter((name) => name !== "plain")) {
			expect(tested).toContain(name);
		}
		for (let kind of ["typescript", "tsx", "css", "json", "markdown", "yaml", "bash"]) {
			expect(kinds).toContain(kind);
		}
	});
});

describe("scan matches the original scanner", () => {
	test.each(GRAMMARS)("on every test literal, as %s", (_, grammar) => {
		for (let sample of LITERALS) {
			expect(scan(sample.code, grammar, { maxLineLength: Infinity }), sample.name).toEqual(
				referenceScan(sample.code, grammar),
			);
		}
	});

	test.each(GRAMMARS)("on every sampled file, as %s", (_, grammar) => {
		for (let sample of FILES) {
			expect(scan(sample.code, grammar, { maxLineLength: Infinity }), sample.name).toEqual(
				referenceScan(sample.code, grammar),
			);
		}
	});

	test.each(GRAMMARS)("on spliced inputs, as %s", (_, grammar) => {
		for (let sample of SPLICES) {
			expect(scan(sample.code, grammar, { maxLineLength: Infinity }), sample.name).toEqual(
				referenceScan(sample.code, grammar),
			);
		}
	});

	test("with the default line cap, on every file whose lines are all under it", () => {
		let ordinary = FILES.filter((sample) =>
			sample.code.split("\n").every((line) => line.length < 2_000),
		);

		expect(ordinary.length).toBeGreaterThan(40);
		for (let sample of ordinary) {
			let grammar = languages[sample.language ?? "plain"] ?? languages.plain;
			if (!grammar) continue;
			expect(scan(sample.code, grammar), sample.name).toEqual(referenceScan(sample.code, grammar));
		}
	});

	test("scanLines carries the same runs, split at each newline", () => {
		for (let sample of FILES) {
			let grammar = languages[sample.language ?? "plain"];
			if (!grammar) continue;
			let lines = scanLines(sample.code, grammar, { maxLineLength: Infinity });
			let expected = sample.code.split("\n");

			expect(lines.map((line) => line.tokens.map((token) => token.value).join(""))).toEqual(
				expected,
			);
			expect(
				lines.flatMap((line) => line.tokens.map((token) => token.type)).filter(Boolean),
			).toEqual(lines.flatMap((line) => line.tokens).map((token) => token.type));
		}
	});
});

describe("first-character dispatch", () => {
	/**
	 * The guarantee dispatch rests on: wherever a rule matches, the character
	 * there is one the analysis says it can start with. Checked at every
	 * position of a sample, for every rule of every grammar, ignoring order.
	 */
	test("never leaves out a rule that matches", () => {
		let text = [...LITERALS.slice(0, 600), ...FILES.slice(0, 20)]
			.map((sample) => sample.code.slice(0, 1_500))
			.join("\n");
		let missed: string[] = [];

		for (let [name, grammar] of GRAMMARS) {
			for (let [mode, rules] of Object.entries(grammar)) {
				for (let rule of rules) {
					let set = firstCharacters(rule.match);
					for (let position = 0; position < text.length; position++) {
						rule.match.lastIndex = position;
						if (!rule.match.test(text) || rule.match.lastIndex === position) continue;
						let code = text.charCodeAt(position);
						let allowed = code < 128 ? set.ascii[code] === 1 : set.other;
						if (!allowed)
							missed.push(`${name}.${mode} ${rule.match} at ${JSON.stringify(text[position])}`);
					}
				}
			}
		}

		expect([...new Set(missed)]).toEqual([]);
	});

	test("reads the first characters of common pattern shapes", () => {
		let chars = (pattern: RegExp) =>
			[...firstCharacters(pattern).ascii]
				.map((flag, code) => (flag === 1 ? String.fromCharCode(code) : ""))
				.join("");

		expect(chars(/\/\/[^\n]*/y)).toBe("/");
		expect(chars(/(?<=[{,]\s*)[A-Za-z_$][\w$]*(?=\s*:)/y)).toBe(
			"$ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz",
		);
		expect(chars(/\b(?:true|false)\b/y)).toBe("ft");
		expect(chars(/-?\d+/y)).toBe("-0123456789");
		expect(chars(/\blet\b/iy)).toBe("Ll");
		expect(firstCharacters(/(a)\1/y).other).toBe(true);
		expect(firstCharacters(/a*/y).ascii.every((flag) => flag === 1)).toBe(true);
	});
});
