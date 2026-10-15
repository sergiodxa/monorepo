/**
 * The unified diff `--dry-run` and `sdxc ui diff` print: headers for created and deleted files,
 * hunk ranges, and changes far apart split into their own hunks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { unifiedDiff } from "./diff.js";

describe("unifiedDiff", () => {
	test("answers nothing for equal texts", () => {
		expect(unifiedDiff("a.ts", "x\n", "x\n")).toBe("");
	});

	test("heads a created and a deleted file with /dev/null", () => {
		expect(unifiedDiff("a.ts", null, "one\ntwo\n")).toBe(
			"--- /dev/null\n+++ b/a.ts\n@@ -0,0 +1,2 @@\n+one\n+two\n",
		);
		expect(unifiedDiff("a.ts", "one\n", null)).toBe(
			"--- a/a.ts\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-one\n",
		);
	});

	test("keeps three lines of context and splits distant changes into hunks", () => {
		let before = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`);
		let after = [...before];
		after[1] = "changed 2";
		after[17] = "changed 18";

		let diff = unifiedDiff("a.ts", `${before.join("\n")}\n`, `${after.join("\n")}\n`);

		expect(diff.split("\n").filter((line) => line.startsWith("@@"))).toEqual([
			"@@ -1,5 +1,5 @@",
			"@@ -15,6 +15,6 @@",
		]);
		expect(diff).toContain("-line 2\n+changed 2\n");
	});
});
