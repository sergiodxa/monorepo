/**
 * Holds the hunk helpers to a file's real lines: walking a patch back restores the old file,
 * widening context reads the file's own lines and merges hunks that meet, and a thread's
 * excerpt and anchor come from the lines a hunk shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Hunk } from "@sdxc/diff";

import { diffLines } from "@sdxc/diff";
import { describe, expect, test } from "vitest";

import {
	excerptHunk,
	expandHunks,
	findInHunks,
	hasHiddenLines,
	unapplyHunks,
} from "~/app/services/delta/hunks";

/** Forty numbered lines, the old side of every case. */
const OLD = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`);

/** The old side with line 5 changed, line 30 removed and a line added after 35. */
const NEW = OLD.flatMap((line, index) => {
	if (index === 4) return ["line five"];
	if (index === 29) return [];
	if (index === 34) return [line, "added after 35"];
	return [line];
});

/** The hunks git would draw between the two, with three lines of context. */
function hunks(): Hunk[] {
	return diffLines(`${OLD.join("\n")}\n`, `${NEW.join("\n")}\n`).hunks;
}

describe("unapplyHunks", () => {
	test("walks a file back across its patch", () => {
		expect(unapplyHunks(NEW, hunks())).toEqual(OLD);
	});

	test("restores a deleted file from a hunk with no new lines", () => {
		let deleted = diffLines("a\nb\n", "").hunks;

		expect(unapplyHunks([], deleted)).toEqual(["a", "b"]);
	});
});

describe("expandHunks", () => {
	test("keeps the hunks as they are without extra lines", () => {
		expect(expandHunks(hunks(), NEW, 0)).toEqual(hunks());
	});

	test("reads the gaps from the file, numbering both sides", () => {
		let wider = expandHunks(hunks(), NEW, 20);
		let lines = wider.flatMap((hunk) => hunk.lines);

		for (let line of lines) {
			if (line.new !== undefined) expect(line.text).toBe(NEW[line.new - 1]);
			if (line.old !== undefined && line.kind !== "add") expect(line.text).toBe(OLD[line.old - 1]);
		}
	});

	test("merges hunks once their context meets, and stops when nothing is hidden", () => {
		let all = expandHunks(hunks(), NEW, 40);

		expect(all).toHaveLength(1);
		expect(all[0]).toMatchObject({ oldStart: 1, newStart: 1, oldLines: 40, newLines: 40 });
		expect(hasHiddenLines(all, NEW)).toBe(false);
		expect(hasHiddenLines(hunks(), NEW)).toBe(true);
	});
});

describe("excerptHunk and findInHunks", () => {
	test("finds a shown line by its text, and cuts the lines ending there", () => {
		let found = findInHunks(hunks(), "added after", 2);

		expect(found).toEqual({ start: 35, end: 36 });
		let excerpt = excerptHunk(hunks(), "R", 35, 3);
		expect(excerpt?.lines.map((line) => line.text)).toEqual([
			"line 34",
			"line 35",
			"added after 35",
		]);
	});

	test("answers nothing for a line no hunk shows", () => {
		expect(findInHunks(hunks(), "line 20")).toBeUndefined();
		expect(excerptHunk(hunks(), "R", 20)).toBeUndefined();
	});
});
