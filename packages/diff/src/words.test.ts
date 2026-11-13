/**
 * Tests the word diff's rules: which tokens a line splits into, the ranges it reports, the
 * pairs it skips (long lines, little in common), and how paired lines are chosen in a hunk.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { diffLines, diffWords } from "./index.js";

describe("diffWords", () => {
	test("marks the changed identifier on both lines", () => {
		expect(diffWords("let a = 1;", "let b = 1;")).toEqual({ old: [[4, 5]], new: [[4, 5]] });
	});

	test("treats a whole identifier or number as one token", () => {
		expect(diffWords("total = count + 10;", "total = counter + 12;")).toEqual({
			old: [
				[8, 13],
				[16, 18],
			],
			new: [
				[8, 15],
				[18, 20],
			],
		});
	});

	test("splits punctuation into single characters, so an added argument is the only mark", () => {
		expect(diffWords("call();", "call(value);")).toEqual({ old: [], new: [[5, 10]] });
	});

	test("joins changed tokens separated by one unchanged space into one range", () => {
		expect(diffWords("a x y b", "a p q b")).toEqual({ old: [[2, 5]], new: [[2, 5]] });
	});

	test("reports offsets that slice the changed text out of each line", () => {
		let oldLine = '\tconst greeting = "hello";';
		let newLine = '\tconst greeting = "goodbye";';
		let words = diffWords(oldLine, newLine)!;

		expect(words.old.map(([start, end]) => oldLine.slice(start, end))).toEqual(["hello"]);
		expect(words.new.map(([start, end]) => newLine.slice(start, end))).toEqual(["goodbye"]);
	});

	test("skips pairs that share less than half their tokens", () => {
		expect(diffWords("alpha beta gamma", "one two three")).toBeUndefined();
	});

	test("skips lines over 1,000 characters", () => {
		let long = "x ".repeat(501);

		expect(diffWords(long, `${long}y`)).toBeUndefined();
		expect(diffWords("x ".repeat(400), `${"x ".repeat(400)}y`)).toBeDefined();
	});
});

describe("word ranges in a line diff", () => {
	test("pair a run of deletions with the additions after it, first with first", () => {
		let { hunks } = diffLines(
			"let a = 1;\nlet b = 2;\n",
			"let a = 10;\nlet b = 20;\nlet c = 30;\n",
		);
		let words = hunks[0]!.lines.map((line) => [line.kind, line.words]);

		expect(words).toEqual([
			["del", [[8, 9]]],
			["del", [[8, 9]]],
			["add", [[8, 10]]],
			["add", [[8, 10]]],
			["add", undefined],
		]);
	});

	test("leave lines without a pair, and skipped pairs, unmarked", () => {
		let { hunks } = diffLines("keep\nold line\n", "keep\nsomething else entirely\n");

		expect(hunks[0]!.lines.every((line) => line.words === undefined)).toBe(true);
	});

	test("stay off when asked", () => {
		let { hunks } = diffLines("let a = 1;\n", "let b = 1;\n", { words: false });

		expect(hunks[0]!.lines.every((line) => line.words === undefined)).toBe(true);
	});
});
