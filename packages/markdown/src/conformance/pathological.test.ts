/**
 * The inputs the CommonMark repository keeps to catch a parser that goes
 * quadratic: runs of unmatched delimiters, nested brackets, stacked containers,
 * and backtick strings. Each one is parsed once with the clock running, so a
 * regression shows up as a failing bound rather than as a slow suite.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { Markdown } from "../index.js";

/**
 * How many times a pattern repeats. Held where a quadratic pass takes seconds
 * rather than minutes, so the budget below reports the regression instead of
 * the suite hanging on it.
 */
const REPEATS = 20_000;

/** Lines of a list, each indented one level deeper, which is quadratic in source size. */
const LIST_DEPTH = 500;

/** Backtick strings of growing length, so the source grows with the square of this. */
const BACKTICK_STRINGS = 700;

/** Reference definitions the document defines and then uses, one line each. */
const REFERENCES = 5_000;

/** Characters in the one-token cases: a link label, an autolink, a word. */
const RUN_LENGTH = 50_000;

/**
 * What one parse may take. A linear parser reads every case below in a few
 * milliseconds, so the gap between this and a passing run is three orders of
 * magnitude wide.
 */
const BUDGET_MS = 1_000;

/** The backstop for a case that blows the budget badly, kept above it by a wide margin. */
const CASE_TIMEOUT_MS = 30_000;

/** One input, named for the shape that makes a careless parser quadratic. */
interface Case {
	name: string;
	source: string;
}

/** A list whose items nest one level deeper on every line. */
function nestedLists() {
	let lines: string[] = [];
	for (let depth = 0; depth < LIST_DEPTH; depth++) lines.push(`${"  ".repeat(depth)}* a`);
	return lines.join("\n");
}

/** A paragraph of backtick strings, each one longer than the last and none of them closed. */
function backtickStrings() {
	let parts: string[] = [];
	for (let length = 1; length <= BACKTICK_STRINGS; length++) parts.push(`e${"`".repeat(length)}`);
	return parts.join("");
}

/** A document that defines every reference it uses, so each use resolves against the whole map. */
function manyReferences() {
	let definitions: string[] = [];
	let uses: string[] = [];
	for (let index = 1; index <= REFERENCES; index++) {
		definitions.push(`[${index}]: /u\n`);
		uses.push(`[${index}] `);
	}
	return `${definitions.join("")}\n${uses.join("")}\n`;
}

const CASES: Case[] = [
	{
		name: "nested strong emphasis",
		source: "*a **a ".repeat(REPEATS) + "b" + " a** a*".repeat(REPEATS),
	},
	{ name: "many emphasis closers with no openers", source: "a_ ".repeat(REPEATS) },
	{ name: "many emphasis openers with no closers", source: "_a ".repeat(REPEATS) },
	{ name: "mismatched emphasis openers and closers", source: "*a_ ".repeat(REPEATS) },
	{ name: "openers and closers a multiple of three", source: `a**b${"c* ".repeat(REPEATS)}` },
	{
		name: "emphasis openers then emphasis around a closer",
		source: "*a ".repeat(REPEATS) + "_a*_ ".repeat(REPEATS),
	},
	{ name: "many link closers with no openers", source: "a]".repeat(REPEATS) },
	{ name: "many link openers with no closers", source: "[a".repeat(REPEATS) },
	{ name: "link openers and emphasis closers", source: "[ a_".repeat(REPEATS) },
	{ name: "unclosed link openers", source: "[ ".repeat(REPEATS) },
	{ name: "backslash after every link opener", source: "[\\".repeat(REPEATS) },
	{
		name: "nested brackets",
		source: "[".repeat(REPEATS) + "a" + "]".repeat(REPEATS),
	},
	{ name: "the pattern [ (]( repeated", source: "[ (](".repeat(REPEATS) },
	{ name: "the pattern ![[]() repeated", source: "![[]()".repeat(REPEATS) },
	{ name: "unclosed pointy link destinations", source: "[a](<b".repeat(REPEATS) },
	{ name: "unclosed bare link destinations", source: "[a](b".repeat(REPEATS) },
	{ name: "many backtick strings", source: backtickStrings() },
	{ name: "nested block quotes", source: `${"> ".repeat(REPEATS)}a` },
	{ name: "deeply nested lists", source: nestedLists() },
	{ name: "many reference definitions and uses", source: manyReferences() },
	{ name: "a long link label", source: `[${"a".repeat(RUN_LENGTH)}](/u)` },
	{ name: "a long autolink", source: `<http://example.com/${"a".repeat(RUN_LENGTH)}>` },
];

describe("pathological inputs", () => {
	test.each(CASES)(
		"$name parses within the budget",
		({ source }) => {
			let started = performance.now();
			let result = Markdown.parse(source);
			let elapsed = performance.now() - started;

			expect(isFailure(result)).toBe(false);
			expect(elapsed, `took ${elapsed.toFixed(0)}ms for ${source.length} characters`).toBeLessThan(
				BUDGET_MS,
			);
		},
		CASE_TIMEOUT_MS,
	);
});
