/**
 * Feeds every grammar input built to make a pattern backtrack — unterminated
 * strings and comments, deep nesting, one character repeated across a whole
 * line — and fails when quadrupling the input more than quadruples the time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { expect, test } from "vitest";

import type { Grammar } from "./lexer.js";

import { scan } from "./lexer.js";

import { languages } from "./index.js";

/** Characters repeated alone for a whole line: every ASCII punctuation mark, a letter, a digit, and blanks. */
const REPEATED = [..."!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~".split(""), "a", "A", "0", " ", "\t"];

/**
 * Units repeated to build an input, each an opener left open, a construct
 * nested inside itself, or a short line repeated down a file.
 */
const UNITS = [
	...REPEATED,
	'"a',
	"'a",
	"`a",
	"/*a",
	"<!--a",
	"${",
	"${a",
	"{a:",
	"(a,",
	"[a,",
	"<a ",
	"<a>",
	"<a b=",
	"**a",
	"*a",
	"_a",
	"[a](",
	"![",
	"a ",
	"a.",
	"a:",
	"a=",
	"a-",
	" -",
	"\\a",
	"\\\n",
	"a\n",
	" \n",
	"\t\n",
	"# a\n",
	"> \n",
	"- \n",
	"```\n",
	"/*\n",
	"<!--\n",
	"a: \n",
	"  - a\n",
	"$(",
	"$((",
	"@a ",
	"0x",
	"1.",
	"1e",
	"+ a\n",
	"- a\n",
	"@@ -1 +1 @@\n",
	"a(",
	"a<",
	"a<b",
	"#{",
	"%w(",
	'"""',
	"'''",
];

/**
 * Text that leaves a grammar inside one of its modes before the repeated unit
 * starts: a block, a tag, a template, an interpolation, a fence, a string.
 */
const PREFIXES = [
	"",
	"a{",
	"@media ",
	"<a ",
	"<a>",
	"`",
	"`${",
	"{",
	"query {",
	"(",
	'"',
	"```\n",
	"a: |\n",
	"<<EOF\n",
	"%w(",
];

/** Input sizes, in characters, for the top level and for the prefixed modes: four times apart. */
const TOP_LEVEL = { small: 12_500, large: 50_000 };
const IN_MODE = { small: 2_500, large: 10_000 };

/**
 * The fewest milliseconds a scan has to take before its growth is judged:
 * below it, timer resolution and garbage collection outweigh the scan.
 */
const MEASURABLE_MS = 8;

/**
 * How much slower the larger input may scan. Linear growth is 4, quadratic 16;
 * the margin absorbs a pause the scan did not cause.
 */
const MAX_GROWTH = 10;

/** The best of `attempts` timings of one scan, which discards a pause the scan did not cause. */
function time(code: string, grammar: Grammar, attempts: number): number {
	let best = Infinity;
	for (let attempt = 0; attempt < attempts; attempt++) {
		let start = performance.now();
		scan(code, grammar, { maxLineLength: Infinity });
		best = Math.min(best, performance.now() - start);
	}
	return best;
}

/** The unit repeated to at least `length` characters. */
function build(unit: string, length: number): string {
	return unit.repeat(Math.ceil(length / unit.length));
}

test.each(Object.entries(languages))("%s scans adversarial input in linear time", (_, grammar) => {
	let superLinear: string[] = [];

	for (let prefix of PREFIXES) {
		let { small, large } = prefix === "" ? TOP_LEVEL : IN_MODE;
		for (let unit of UNITS) {
			if (time(prefix + build(unit, large), grammar, 1) < MEASURABLE_MS) continue;
			let smallMs = time(prefix + build(unit, small), grammar, 3);
			let largeMs = time(prefix + build(unit, large), grammar, 3);
			if (largeMs / Math.max(smallMs, 1) > MAX_GROWTH) {
				superLinear.push(
					`${JSON.stringify(prefix + unit)}: ${smallMs.toFixed(1)}ms → ${largeMs.toFixed(1)}ms`,
				);
			}
		}
	}

	expect(superLinear).toEqual([]);
});

test("the default line cap scans a 50,000-character line at once in every grammar", () => {
	let line = build("a(b,c){return d.e(f=>f*2)}", TOP_LEVEL.large);
	let slow = Object.entries(languages).filter(([, grammar]) => {
		let start = performance.now();
		scan(line, grammar);
		return performance.now() - start > 5;
	});

	expect(slow.map(([name]) => name)).toEqual([]);
});
