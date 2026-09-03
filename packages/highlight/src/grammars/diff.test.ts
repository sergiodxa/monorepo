/**
 * Tests the diff grammar, whose whole job is deciding what a line is from the
 * marker that opens it — including the markers a file header shares with them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer.js";

import { diff } from "./diff.js";

describe("diff", () => {
	test("paints an added and a removed line whole", () => {
		expect(scan("+added\n-removed\n", diff)).toEqual([
			{ type: "inserted", value: "+added" },
			{ type: "plain", value: "\n" },
			{ type: "deleted", value: "-removed" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("leaves a context line plain", () => {
		expect(scan(" unchanged\n", diff)).toEqual([{ type: "plain", value: " unchanged\n" }]);
	});

	test("paints a hunk header", () => {
		expect(scan("@@ -1,4 +1,6 @@ function scan()\n", diff)).toEqual([
			{ type: "keyword", value: "@@ -1,4 +1,6 @@ function scan()" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("reads `---` and `+++` as file headers rather than as changes", () => {
		expect(scan("--- a/file.ts\n+++ b/file.ts\n", diff)).toEqual([
			{ type: "comment", value: "--- a/file.ts" },
			{ type: "plain", value: "\n" },
			{ type: "comment", value: "+++ b/file.ts" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("matches a marker only at the start of a line", () => {
		expect(scan("a - b\n", diff)).toEqual([{ type: "plain", value: "a - b\n" }]);
	});

	/**
	 * From `docs/vendor/@remix-run/test/README.md`, which is what a diff fence
	 * here usually is: two lines showing one line of config changing.
	 */
	test("scans a real patch, covering it exactly", () => {
		let code = [
			"diff --git a/package.json b/package.json",
			"index 1a2b3c4..5d6e7f8 100644",
			"--- a/package.json",
			"+++ b/package.json",
			"@@ -3,3 +3,3 @@",
			'-  "test": "remix-test --type server"',
			'+  "test": "remix test --type server"',
			"",
		].join("\n");

		let tokens = scan(code, diff);

		expect(tokens.map((token) => token.value).join("")).toBe(code);
		expect(tokens.filter((token) => token.type !== "plain")).toEqual([
			{ type: "comment", value: "diff --git a/package.json b/package.json" },
			{ type: "comment", value: "index 1a2b3c4..5d6e7f8 100644" },
			{ type: "comment", value: "--- a/package.json" },
			{ type: "comment", value: "+++ b/package.json" },
			{ type: "keyword", value: "@@ -3,3 +3,3 @@" },
			{ type: "deleted", value: '-  "test": "remix-test --type server"' },
			{ type: "inserted", value: '+  "test": "remix test --type server"' },
		]);
	});
});
