/**
 * Tests reading and writing unified diffs against real `git show` output: added, deleted,
 * copied and renamed files, mode changes, binary content, quoted and spaced paths, missing
 * final newlines, and a byte-for-byte round trip through `stringifyPatch`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import type { FilePatch } from "./index.js";

import { parseHunks, parsePatch, stringifyPatch } from "./index.js";

/** Reads a fixture next to this file. */
function fixture(path: string): string {
	return readFileSync(new URL(`./fixtures/${path}`, import.meta.url), "utf8");
}

/** `git show --format= -M -C --patch` of a commit that touches every header git writes. */
const HEADERS = fixture("git/headers.patch");

/** The header fields of a parsed file, without the offsets and counts. */
function header(file: FilePatch): Partial<FilePatch> {
	let { additions: _a, deletions: _d, bodyStart: _s, bodyEnd: _e, ...rest } = file;
	return rest;
}

describe("parsePatch", () => {
	test("reads every file's paths, status, modes, hashes and similarity", () => {
		let files = parsePatch(HEADERS);

		expect(files.map(header)).toEqual([
			{
				oldPath: "added.txt",
				newPath: "added.txt",
				status: "added",
				binary: false,
				newMode: "100644",
				oldHash: "0000000",
				newHash: "3e75765",
			},
			{
				oldPath: "copysrc.txt",
				newPath: "copy.txt",
				status: "copied",
				binary: false,
				similarity: 100,
			},
			{
				oldPath: "copysrc.txt",
				newPath: "copysrc.txt",
				status: "modified",
				binary: false,
				oldMode: "100644",
				newMode: "100644",
				oldHash: "5ddf809",
				newHash: "9f52852",
			},
			{
				oldPath: "gone.txt",
				newPath: "gone.txt",
				status: "deleted",
				binary: false,
				oldMode: "100644",
				oldHash: "587be6b",
				newHash: "0000000",
			},
			{
				oldPath: "img.bin",
				newPath: "img.bin",
				status: "modified",
				binary: true,
				oldMode: "100644",
				newMode: "100644",
				oldHash: "6772730",
				newHash: "cfd533b",
			},
			{
				oldPath: "keep.txt",
				newPath: "keep.txt",
				status: "modified",
				binary: false,
				oldMode: "100644",
				newMode: "100755",
				oldHash: "e8823e1",
				newHash: "5401050",
			},
			{
				oldPath: "nonl.txt",
				newPath: "nonl.txt",
				status: "modified",
				binary: false,
				oldMode: "100644",
				newMode: "100644",
				oldHash: "1c943a9",
				newHash: "6dcce7d",
			},
			{
				oldPath: "moved.txt",
				newPath: "renamed.txt",
				status: "renamed",
				binary: false,
				oldMode: "100644",
				newMode: "100755",
				similarity: 94,
				oldHash: "0ff3bbb",
				newHash: "d4de868",
			},
			{
				oldPath: "run.sh",
				newPath: "run.sh",
				status: "modified",
				binary: false,
				oldMode: "100644",
				newMode: "100755",
			},
			{
				oldPath: "sp ace.txt",
				newPath: "sp ace.txt",
				status: "modified",
				binary: false,
				oldMode: "100644",
				newMode: "100644",
				oldHash: "bca70f3",
				newHash: "d169a2f",
			},
			{
				oldPath: "ünï.txt",
				newPath: "ü2.txt",
				status: "renamed",
				binary: false,
				similarity: 100,
			},
		]);
	});

	test("counts additions and deletions without parsing hunks", () => {
		let files = parsePatch(HEADERS);

		expect(files.map((file) => [file.newPath, file.additions, file.deletions])).toEqual([
			["added.txt", 1, 0],
			["copy.txt", 0, 0],
			["copysrc.txt", 1, 0],
			["gone.txt", 0, 1],
			["img.bin", 0, 0],
			["keep.txt", 1, 1],
			["nonl.txt", 1, 1],
			["renamed.txt", 1, 0],
			["run.sh", 0, 0],
			["sp ace.txt", 1, 1],
			["ü2.txt", 0, 0],
		]);
	});

	test("points each file's body at its hunks, and at an empty span when it has none", () => {
		let files = parsePatch(HEADERS);
		let keep = files.find((file) => file.newPath === "keep.txt")!;
		let run = files.find((file) => file.newPath === "run.sh")!;

		expect(HEADERS.slice(keep.bodyStart, keep.bodyEnd).startsWith("@@ -12,7 +12,7 @@\n")).toBe(
			true,
		);
		expect(HEADERS.slice(keep.bodyStart, keep.bodyEnd).endsWith(" 18\n")).toBe(true);
		expect(run.bodyStart).toBe(run.bodyEnd);
	});

	test("reads a GIT binary patch as binary", () => {
		expect(parsePatch(fixture("git/binary.patch")).map(header)).toEqual([
			{
				oldPath: "img.bin",
				newPath: "img.bin",
				status: "modified",
				binary: true,
				oldMode: "100644",
				newMode: "100644",
				oldHash: "677273046bce3115f56c248238f3b83f77cfc239",
				newHash: "cfd533bc0dd4437e51ffdb2febf6303b581c0762",
			},
		]);
	});

	test("skips a commit message before the first file", () => {
		let files = parsePatch(fixture("git/show.patch"));

		expect(files.map((file) => [file.newPath, file.additions, file.deletions])).toEqual([
			["keep.txt", 1, 1],
		]);
	});

	test("reads a plain unified diff without git headers", () => {
		let text = "--- a/x.txt\t2026-01-01\n+++ b/x.txt\t2026-01-02\n@@ -1 +1 @@\n-a\n+b\n";
		let [file] = parsePatch(text);

		expect(header(file!)).toEqual({
			oldPath: "x.txt",
			newPath: "x.txt",
			status: "modified",
			binary: false,
		});
		expect(parseHunks(text, file!)[0]?.lines.map((line) => line.text)).toEqual(["a", "b"]);
	});

	test("reads a deletion line that looks like a header as part of its hunk", () => {
		let text = "diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1,2 +1 @@\n--- a\n keep\n";
		let [file] = parsePatch(text);

		expect(parsePatch(text)).toHaveLength(1);
		expect(parseHunks(text, file!)[0]?.lines).toEqual([
			{ kind: "del", text: "-- a", old: 1 },
			{ kind: "context", text: "keep", old: 2, new: 1 },
		]);
	});

	test("stops a truncated hunk at the next file", () => {
		let text =
			"diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1,5 +1,5 @@\n-a\n+b\ndiff --git a/y b/y\n";

		expect(parsePatch(text).map((file) => file.newPath)).toEqual(["x", "y"]);
	});
});

describe("parseHunks", () => {
	test("numbers lines on both sides and marks a missing final newline", () => {
		let files = parsePatch(HEADERS);
		let file = files.find((each) => each.newPath === "nonl.txt")!;

		expect(parseHunks(HEADERS, file)).toEqual([
			{
				oldStart: 1,
				oldLines: 3,
				newStart: 1,
				newLines: 3,
				lines: [
					{ kind: "context", text: "a", old: 1, new: 1 },
					{ kind: "context", text: "b", old: 2, new: 2 },
					{ kind: "del", text: "c", old: 3, noNewline: true },
					{ kind: "add", text: "C", new: 3 },
				],
			},
		]);
	});

	test("reads the section after the hunk header", () => {
		let patch = fixture("git/keys/histogram.patch");
		let [file] = parsePatch(patch);

		expect(parseHunks(patch, file!)[0]?.section).toBe(
			"function focusSheet(controls: Element): void {",
		);
	});

	test("adds word ranges to paired lines, and leaves pairs with nothing in common unmarked", () => {
		let text = "--- a/x\n+++ b/x\n@@ -1,2 +1,2 @@\n-let a = 1;\n-q\n+let b = 1;\n+q2\n";
		let [file] = parsePatch(text);

		expect(parseHunks(text, file!)[0]?.lines).toEqual([
			{ kind: "del", text: "let a = 1;", old: 1, words: [[4, 5]] },
			{ kind: "del", text: "q", old: 2 },
			{ kind: "add", text: "let b = 1;", new: 1, words: [[4, 5]] },
			{ kind: "add", text: "q2", new: 2 },
		]);
	});
});

describe("stringifyPatch", () => {
	test("writes git's output back byte for byte", () => {
		for (let name of ["headers.patch", "keys/histogram.patch", "no-newline/histogram.patch"]) {
			let text = fixture(`git/${name}`);
			let entries = parsePatch(text).map((file) => ({ ...file, hunks: parseHunks(text, file) }));

			expect(stringifyPatch(entries), name).toBe(text);
		}
	});

	test("writes an empty patch for no entries", () => {
		expect(stringifyPatch([])).toBe("");
	});
});
