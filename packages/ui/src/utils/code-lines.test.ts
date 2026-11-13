/**
 * Unit tests for {@link "./code-lines"}: runs split at every newline, multi-line runs
 * carried across lines with their type, and one entry per source line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { codeLines } from "./code-lines.js";

describe(codeLines.name, () => {
	test("returns one empty line for no runs", () => {
		expect(codeLines([])).toEqual([[]]);
	});

	test("keeps runs on one line together", () => {
		expect(
			codeLines([
				{ type: "keyword", value: "let" },
				{ type: "plain", value: " x" },
			]),
		).toEqual([
			[
				{ type: "keyword", value: "let" },
				{ type: "plain", value: " x" },
			],
		]);
	});

	test("carries a multi-line run onto each line it spans, with its type", () => {
		expect(
			codeLines([
				{ type: "comment", value: "/**\n * Doc\n */" },
				{ type: "plain", value: "\n" },
				{ type: "keyword", value: "export" },
			]),
		).toEqual([
			[{ type: "comment", value: "/**" }],
			[{ type: "comment", value: " * Doc" }],
			[{ type: "comment", value: " */" }],
			[{ type: "keyword", value: "export" }],
		]);
	});

	test("keeps blank lines as empty entries and splits on CRLF", () => {
		expect(codeLines([{ type: "plain", value: "a\r\n\r\nb\n" }])).toEqual([
			[{ type: "plain", value: "a" }],
			[],
			[{ type: "plain", value: "b" }],
			[],
		]);
	});
});
