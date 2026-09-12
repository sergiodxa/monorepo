/**
 * Cutting a source into located lines: every terminator CommonMark recognizes, a
 * file that ends without one, and the coordinates a body carries when it begins
 * past a frontmatter block. Every block node's position rests on these numbers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Markdown } from "../../index.js";

import { splitLines } from "./lines.js";

/** Where a body with no frontmatter above it begins. */
const START: Markdown.Point = { line: 1, column: 1, offset: 0 };

describe("terminators", () => {
	test("ends a line at a newline, keeping the terminator out of the text", () => {
		expect(splitLines("a\nb\n", START)).toEqual([
			{ text: "a", line: 1, columnBase: 1, offset: 0 },
			{ text: "b", line: 2, columnBase: 1, offset: 2 },
		]);
	});

	test("counts a carriage return and newline pair as one terminator", () => {
		expect(splitLines("a\r\nb\r\n", START)).toEqual([
			{ text: "a", line: 1, columnBase: 1, offset: 0 },
			{ text: "b", line: 2, columnBase: 1, offset: 3 },
		]);
	});

	test("ends a line at a bare carriage return", () => {
		expect(splitLines("a\rb\r", START)).toEqual([
			{ text: "a", line: 1, columnBase: 1, offset: 0 },
			{ text: "b", line: 2, columnBase: 1, offset: 2 },
		]);
	});

	test("reads a file that mixes all three terminators as four lines", () => {
		let lines = splitLines("a\r\nb\nc\rd", START);

		expect(lines.map((line) => line.text)).toEqual(["a", "b", "c", "d"]);
		expect(lines.map((line) => line.line)).toEqual([1, 2, 3, 4]);
		expect(lines.map((line) => line.offset)).toEqual([0, 3, 5, 7]);
	});

	test("keeps a blank line between two lines", () => {
		expect(splitLines("a\n\nb\n", START).map((line) => line.text)).toEqual(["a", "", "b"]);
	});
});

describe("the end of the source", () => {
	test("keeps the last line of a source that ends without a terminator", () => {
		expect(splitLines("a\nb", START)).toEqual([
			{ text: "a", line: 1, columnBase: 1, offset: 0 },
			{ text: "b", line: 2, columnBase: 1, offset: 2 },
		]);
	});

	test("closes the last line on a final terminator rather than opening an empty one", () => {
		expect(splitLines("a\n", START)).toHaveLength(1);
	});

	test("reads an empty source as no lines at all", () => {
		expect(splitLines("", START)).toEqual([]);
	});

	test("reads a source that is only a terminator as one empty line", () => {
		expect(splitLines("\n", START)).toEqual([{ text: "", line: 1, columnBase: 1, offset: 0 }]);
	});
});

describe("the body's coordinates", () => {
	test("numbers lines from the body's own line, so a body under frontmatter names real lines", () => {
		let source = "---\ntitle: Hi\n---\nbody\nmore\n";

		expect(splitLines(source, { line: 4, column: 1, offset: 18 })).toEqual([
			{ text: "body", line: 4, columnBase: 1, offset: 18 },
			{ text: "more", line: 5, columnBase: 1, offset: 23 },
		]);
	});

	test("gives only the first line the body's column, since the rest begin their own", () => {
		let lines = splitLines("body\nmore\n", { line: 1, column: 3, offset: 2 });

		expect(lines.map((line) => line.columnBase)).toEqual([3, 1]);
	});

	test("offsets every line from where the body sits in the file", () => {
		let source = `${"above\n".repeat(6)}body\nmore\n`;
		let lines = splitLines(source, { line: 7, column: 1, offset: 36 });

		expect(lines.map((line) => line.text)).toEqual(["body", "more"]);
		expect(lines.map((line) => line.offset)).toEqual([36, 41]);
	});

	test("reads the body from the start point, leaving what came before it out", () => {
		let lines = splitLines("skipped\nbody\n", { line: 2, column: 1, offset: 8 });

		expect(lines.map((line) => line.text)).toEqual(["body"]);
	});
});

describe("the characters a line carries", () => {
	test("replaces a NUL with the replacement character, keeping every offset aligned", () => {
		expect(splitLines("a\0b\nc\n", START)).toEqual([
			{ text: "a�b", line: 1, columnBase: 1, offset: 0 },
			{ text: "c", line: 2, columnBase: 1, offset: 4 },
		]);
	});

	test("leaves leading whitespace on the line for the block phase to measure", () => {
		expect(splitLines("\tabc\n", START)[0]?.text).toBe("\tabc");
	});
});
