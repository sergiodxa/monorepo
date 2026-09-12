/**
 * Cutting a table row into cells and reading a delimiter row. The cases are the
 * ones where a pipe is not a divider, where the outer pipes are absent, and where
 * a row of hyphens either states an alignment or is not a delimiter row at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { readDelimiterRow, splitCells } from "./table.js";

/**
 * @param row - The row to cut
 * @returns Each cell's text, which is what most assertions here are about
 */
function texts(row: string): string[] {
	return splitCells(row).map((cell) => cell.text);
}

describe("splitCells", () => {
	test("cuts a row at each pipe", () => {
		expect(texts("| a | b | c |")).toEqual(["a", "b", "c"]);
	});

	test("reads a row written without its outer pipes as the same cells", () => {
		expect(texts("a | b")).toEqual(["a", "b"]);
		expect(texts("| a | b")).toEqual(["a", "b"]);
		expect(texts("a | b |")).toEqual(["a", "b"]);
	});

	test("keeps an escaped pipe inside the cell it was written in", () => {
		expect(texts("| x \\| y |")).toEqual(["x | y"]);
	});

	test("resolves an escaped pipe to a literal pipe in the cell's text", () => {
		expect(texts("| a\\|b |")).toEqual(["a|b"]);
	});

	test("divides on a pipe inside a code span, which is why that pipe needs escaping", () => {
		expect(texts("a `x | y` b")).toEqual(["a `x", "y` b"]);
		expect(texts("b `\\|` az")).toEqual(["b `|` az"]);
	});

	test("keeps a backslash that escapes nothing for the inline phase to read", () => {
		expect(texts("| a\\b |")).toEqual(["a\\b"]);
	});

	test("keeps an empty cell that two pipes enclose", () => {
		expect(texts("| a || b |")).toEqual(["a", "", "b"]);
	});

	test("reads a row with no pipe at all as a single cell", () => {
		expect(texts("a")).toEqual(["a"]);
	});

	test("reads a row that is only its outer pipes as one empty cell", () => {
		expect(texts("| |")).toEqual([""]);
	});

	test("drops the whitespace after the closing pipe rather than opening a cell", () => {
		expect(texts("| a | b |   ")).toEqual(["a", "b"]);
	});

	test("reports the cells the row actually has, leaving the header's width to the caller", () => {
		expect(texts("| 1 |")).toHaveLength(1);
		expect(texts("| 1 | 2 | 3 |")).toHaveLength(3);
	});

	test("points a cell's start at its first character, past the padding", () => {
		expect(splitCells("|  spaced   |   cell |")).toEqual([
			{ text: "spaced", start: 3 },
			{ text: "cell", start: 16 },
		]);
	});

	test("counts the indentation before the row when locating a cell", () => {
		expect(splitCells("\t| a |")).toEqual([{ text: "a", start: 3 }]);
	});
});

describe("readDelimiterRow", () => {
	test("reads a column with no colon as asking for no alignment", () => {
		expect(readDelimiterRow("| - | --- |")).toEqual([null, null]);
	});

	test("reads a colon on the side it sits as the alignment it asks for", () => {
		expect(readDelimiterRow("| :- | -: | :-: | - |")).toEqual(["left", "right", "center", null]);
	});

	test("reads a longer run of hyphens the same as a single one", () => {
		expect(readDelimiterRow("| :--- | ---: |")).toEqual(["left", "right"]);
	});

	test("reads a delimiter row written without its outer pipes", () => {
		expect(readDelimiterRow(":-: | -----------:")).toEqual(["center", "right"]);
	});

	test("reports one alignment per column, so a caller can compare it with the header", () => {
		expect(readDelimiterRow("| - |")).toHaveLength(1);
		expect(splitCells("| a | b |")).toHaveLength(2);
	});

	test("rejects a row of hyphens with no pipe, which is a setext heading instead", () => {
		expect(readDelimiterRow("---")).toBe(null);
	});

	test("rejects a row holding a cell that is not hyphens", () => {
		expect(readDelimiterRow("| - | x |")).toBe(null);
		expect(readDelimiterRow("| a | b |")).toBe(null);
	});

	test("rejects a cell of colons with nothing between them", () => {
		expect(readDelimiterRow("| :: |")).toBe(null);
	});

	test("rejects a cell whose hyphens are interrupted", () => {
		expect(readDelimiterRow("| -- - |")).toBe(null);
	});

	test("rejects an empty cell, since a column has to state something", () => {
		expect(readDelimiterRow("|  |")).toBe(null);
	});

	test("rejects a row whose every pipe is escaped, since none of them divides", () => {
		expect(readDelimiterRow("\\|-\\|")).toBe(null);
	});
});
