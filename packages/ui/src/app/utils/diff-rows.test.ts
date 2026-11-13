/**
 * Tests for the diff view's arithmetic: git's header form, split pairing with fillers, each
 * side highlighted as one source, word ranges cut across runs, and the five-block bar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Hunk } from "@sdxc/diff";

import { describe, expect, test } from "vitest";

import {
	changeBlocks,
	hunkHeader,
	hunkTokens,
	markRuns,
	pathHash,
	splitRows,
} from "./diff-rows.js";

describe("hunkHeader", () => {
	test("writes counts as git does, leaving out a count of one", () => {
		expect(hunkHeader({ oldStart: 20, oldLines: 7, newStart: 20, newLines: 8, lines: [] })).toBe(
			"@@ -20,7 +20,8 @@",
		);
		expect(
			hunkHeader({
				oldStart: 3,
				oldLines: 1,
				newStart: 3,
				newLines: 1,
				section: "fn()",
				lines: [],
			}),
		).toBe("@@ -3 +3 @@ fn()");
	});
});

describe("splitRows", () => {
	test("pairs deletions with additions row by row and leaves fillers on the shorter side", () => {
		let rows = splitRows([
			{ kind: "context", old: 1, new: 1, text: "a" },
			{ kind: "del", old: 2, text: "b" },
			{ kind: "del", old: 3, text: "c" },
			{ kind: "add", new: 2, text: "B" },
			{ kind: "context", old: 4, new: 3, text: "d" },
			{ kind: "add", new: 4, text: "e" },
		]);
		expect(rows).toEqual([
			{ old: 0, new: 0 },
			{ old: 1, new: 3 },
			{ old: 2, new: undefined },
			{ old: 4, new: 4 },
			{ old: undefined, new: 5 },
		]);
	});
});

describe("hunkTokens", () => {
	let hunk: Hunk = {
		oldStart: 1,
		oldLines: 2,
		newStart: 1,
		newLines: 2,
		lines: [
			{ kind: "context", old: 1, new: 1, text: "/* opens" },
			{ kind: "del", old: 2, text: "closes */ let a = 1;" },
			{ kind: "add", new: 2, text: "ends */ let a = 2;" },
		],
	};

	test("tokenizes each side as one source, so a comment that spans lines paints whole", () => {
		let runs = hunkTokens(hunk, "ts");
		expect(runs[1]![0]).toEqual({ type: "comment", value: "closes */" });
		expect(runs[2]![0]).toEqual({ type: "comment", value: "ends */" });
		expect(runs[2]).toContainEqual({ type: "keyword", value: "let" });
	});

	test("returns the same runs for the same hunk and language", () => {
		expect(hunkTokens(hunk, "ts")).toBe(hunkTokens(hunk, "ts"));
	});

	test("draws every line as one plain run without a language", () => {
		expect(hunkTokens(hunk, undefined)[2]).toEqual([
			{ type: "plain", value: "ends */ let a = 2;" },
		]);
	});
});

describe("markRuns", () => {
	test("cuts runs at range edges and merges neighbours of one kind", () => {
		expect(
			markRuns(
				[
					{ type: "keyword", value: "let" },
					{ type: "plain", value: " b = " },
					{ type: "number", value: "30" },
					{ type: "plain", value: ";" },
				],
				[[6, 9]],
			),
		).toEqual([
			{ type: "keyword", value: "let", marked: false },
			{ type: "plain", value: " b ", marked: false },
			{ type: "plain", value: "= ", marked: true },
			{ type: "number", value: "3", marked: true },
			{ type: "number", value: "0", marked: false },
			{ type: "plain", value: ";", marked: false },
		]);
	});

	test("marks nothing without ranges", () => {
		expect(markRuns([{ type: "plain", value: "a" }], undefined)).toEqual([
			{ type: "plain", value: "a", marked: false },
		]);
	});
});

describe("changeBlocks", () => {
	test("draws additions and deletions in proportion, each at least one block", () => {
		expect(changeBlocks(12, 3)).toEqual(["add", "add", "add", "add", "del"]);
		expect(changeBlocks(100, 1)).toEqual(["add", "add", "add", "add", "del"]);
		expect(changeBlocks(1, 1)).toEqual(["add", "del", "neutral", "neutral", "neutral"]);
		expect(changeBlocks(0, 0)).toEqual(["neutral", "neutral", "neutral", "neutral", "neutral"]);
	});
});

describe("pathHash", () => {
	test("names a path the same way on every run", () => {
		expect(pathHash("app/routes.ts")).toBe(pathHash("app/routes.ts"));
		expect(pathHash("app/routes.ts")).not.toBe(pathHash("app/route.ts"));
	});
});
