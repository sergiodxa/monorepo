/**
 * Checks the ANSI parser against what CI logs emit: SGR colours and weights, resets, bright and
 * 256-colour variants, styles carried across lines, and other escapes dropped without a trace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { parseAnsi, parseAnsiLine, stripAnsi } from "./ansi.js";

const ESC = "\u001b";

describe("parseAnsiLine", () => {
	test("returns a plain line as one unstyled span", () => {
		expect(parseAnsiLine("Run bun install").spans).toEqual([{ text: "Run bun install" }]);
	});

	test("returns no spans for an empty line", () => {
		expect(parseAnsiLine("").spans).toEqual([]);
	});

	test("colours a run and resets after it", () => {
		expect(parseAnsiLine(`${ESC}[31merror${ESC}[0m: build failed`).spans).toEqual([
			{ text: "error", fg: "red" },
			{ text: ": build failed" },
		]);
	});

	test("combines weight, colour and background in one escape, and folds bright colours", () => {
		expect(parseAnsiLine(`${ESC}[1;92;41mPASS${ESC}[22m done`).spans).toEqual([
			{ text: "PASS", bold: true, fg: "green", bg: "red" },
			{ text: " done", fg: "green", bg: "red" },
		]);
	});

	test("maps the first 16 of 256 colours to names and skips truecolor arguments", () => {
		expect(parseAnsiLine(`${ESC}[38;5;9ma${ESC}[38;5;200mb${ESC}[38;2;10;20;30;4mc`).spans).toEqual(
			[{ text: "a", fg: "red" }, { text: "b" }, { text: "c", underline: true }],
		);
	});

	test("treats an empty parameter list as a reset", () => {
		expect(parseAnsiLine(`${ESC}[33mwarn${ESC}[m ok`).spans).toEqual([
			{ text: "warn", fg: "yellow" },
			{ text: " ok" },
		]);
	});

	test("drops cursor, erase and OSC escapes, merging the text around them", () => {
		let line = `${ESC}[2K${ESC}[1Gdown${ESC}]0;title${ESC}\\load${ESC}[?25l ok`;
		expect(parseAnsiLine(line).spans).toEqual([{ text: "download ok" }]);
	});

	test("hands the style in force to the next line", () => {
		let first = parseAnsiLine(`${ESC}[36mstart`);
		expect(first.state).toEqual({ fg: "cyan" });
		expect(parseAnsiLine("continues", first.state).spans).toEqual([
			{ text: "continues", fg: "cyan" },
		]);
	});
});

describe("parseAnsi", () => {
	test("parses each line, carrying the style across line breaks", () => {
		expect(parseAnsi(`${ESC}[1mBuild\nstill bold${ESC}[0m\nplain`)).toEqual([
			[{ text: "Build", bold: true }],
			[{ text: "still bold", bold: true }],
			[{ text: "plain" }],
		]);
	});
});

describe("stripAnsi", () => {
	test("leaves only the text a reader sees", () => {
		expect(stripAnsi(`${ESC}[32m✓${ESC}[39m 12 tests ${ESC}[2mpassed${ESC}[22m`)).toBe(
			"✓ 12 tests passed",
		);
	});
});
