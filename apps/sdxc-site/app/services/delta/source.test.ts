/**
 * Holds the documents Delta's build writes to their shape, whatever the history holds today:
 * files sorted and counted, commits newest first with no email anywhere, every sha a row or a
 * blame range names known, patches limited to Delta's paths, and the budget kept.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
	commitFiles,
	commitsBySha,
	fileHunks,
	fileLines,
	fileTokens,
	findCommit,
	isFullCommit,
	languageOf,
	readAnchors,
	readBlame,
	readHistory,
	readPatch,
	readTree,
} from "~/app/services/delta/source";
import { DELTA_BUDGET_BYTES, DELTA_HISTORY_LIMIT } from "~/config/delta";

/** Where the extractor writes, relative to this file. */
const GENERATED = join(import.meta.dirname, "../../../resources/generated/delta");

describe("Delta's generated documents", () => {
	test("fit the budget together", () => {
		let bytes = readdirSync(GENERATED)
			.filter((name) => name.endsWith(".json"))
			.reduce((sum, name) => sum + readFileSync(join(GENERATED, name)).length, 0);

		expect(bytes).toBeLessThanOrEqual(DELTA_BUDGET_BYTES);
	});

	test("never hold an email address", () => {
		for (let name of ["history.json", "blame.json", "tree.json"]) {
			let text = readFileSync(join(GENERATED, name), "utf8");
			expect(text, name).not.toMatch(/<[^<>\s]+@[^<>\s]+>/);
		}
	});
});

describe("readTree", () => {
	test("lists files once each, sorted, with their size and line count", async () => {
		let tree = await readTree();
		let paths = tree.files.map((file) => file.path);

		expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
		expect(new Set(paths).size).toBe(paths.length);
		for (let file of tree.files) {
			expect(file.path).not.toMatch(/^\/|apps\/sdxc-site/);
			expect(file.bytes).toBe(new TextEncoder().encode(file.text).length);
			expect(file.lines).toBe(file.text.replace(/\r?\n$/, "").split(/\r?\n/).length);
		}
	});

	test("names a known commit as the last to touch every file and folder", async () => {
		let tree = await readTree();
		let commits = await commitsBySha();

		for (let [path, sha] of Object.entries(tree.lastCommits)) {
			expect(commits.has(sha), path).toBe(true);
		}
		for (let file of tree.files) expect(tree.lastCommits[file.path], file.path).toBeDefined();
	});
});

describe("readHistory", () => {
	test("keeps commits newest first, inside the cap, each with its files under Delta", async () => {
		let history = await readHistory();
		let dates = history.commits.map((commit) => Date.parse(commit.date));

		expect(history.commits.length).toBeLessThanOrEqual(DELTA_HISTORY_LIMIT);
		expect(dates).toEqual([...dates].sort((a, b) => b - a));
		for (let commit of history.commits) {
			expect(commit.sha).toMatch(/^[0-9a-f]{40}$/);
			expect(commit.author).not.toBe("");
			expect(commit.subject).not.toBe("");
			for (let file of commit.files) expect(file.path).not.toMatch(/apps\/sdxc-site/);
		}
	});

	test("cites only commits outside the history", async () => {
		let history = await readHistory();
		let inHistory = new Set(history.commits.map((commit) => commit.sha));

		for (let commit of history.cited) expect(inHistory.has(commit.sha)).toBe(false);
	});
});

describe("readBlame", () => {
	test("covers every line of every file once, each range naming a known commit", async () => {
		let [tree, blame, commits] = await Promise.all([readTree(), readBlame(), commitsBySha()]);
		let history = await readHistory();
		if (history.shallow) return;

		for (let file of tree.files) {
			let ranges = blame[file.path] ?? [];
			let next = 1;
			for (let range of ranges) {
				expect(range.start, file.path).toBe(next);
				expect(range.end).toBeGreaterThanOrEqual(range.start);
				expect(commits.has(range.sha), range.sha).toBe(true);
				next = range.end + 1;
			}
			expect(next - 1, file.path).toBe(file.lines);
		}
	});
});

describe("readAnchors", () => {
	test("resolves every current anchor to lines inside its file", async () => {
		let [tree, anchors] = await Promise.all([readTree(), readAnchors()]);

		for (let anchor of Object.values(anchors)) {
			if (anchor.status !== "current") continue;
			let file = tree.files.find((candidate) => candidate.path === anchor.path);
			expect(file, anchor.id).toBeDefined();
			expect(anchor.end).toBeLessThanOrEqual(file!.lines);
		}
	});
});

describe("patches", () => {
	test("hold one patch per commit in the history, limited to its files", async () => {
		let history = await readHistory();
		for (let commit of history.commits) {
			let patch = await readPatch(commit.sha);
			expect(patch, commit.sha).toBeDefined();
			let headers = (await commitFiles(commit.sha)) ?? [];
			let named = new Set(commit.files.map((file) => file.path));
			for (let header of headers) expect(named.has(header.newPath), header.newPath).toBe(true);
		}
	});

	test("parse one file's hunks once and hand back the same hunks after", async () => {
		let history = await readHistory();
		let commit = history.commits.find((candidate) => candidate.files.length > 0);
		if (commit === undefined) return;
		let headers = (await commitFiles(commit.sha)) ?? [];
		let file = headers.find((header) => !header.binary);
		if (file === undefined) return;

		let first = await fileHunks(commit.sha, file.newPath);
		expect(first).toBeDefined();
		expect(await fileHunks(commit.sha, file.newPath)).toBe(first);
	});
});

describe("fileLines and fileTokens", () => {
	test("tokenize a file once per commit and keep every character", async () => {
		let tree = await readTree();
		let file = tree.files[0];
		if (file === undefined) return;

		let lines = fileLines(file, tree.head);
		expect(fileLines(file, tree.head)).toBe(lines);
		expect(lines).toHaveLength(file.lines);
		expect(
			fileTokens(file, tree.head)
				.map((token) => token.value)
				.join(""),
		).toBe(file.text.replace(/\r?\n$/, ""));
	});
});

describe("findCommit", () => {
	test("finds a commit by its short sha and refuses anything that is not a sha", async () => {
		let history = await readHistory();
		let commit = history.commits[0];
		expect(await findCommit("not-a-sha")).toBeUndefined();
		if (commit === undefined) return;

		let found = await findCommit(commit.sha.slice(0, 7));
		expect(found?.sha).toBe(commit.sha);
		expect(isFullCommit(found!)).toBe(true);
	});
});

describe("languageOf", () => {
	test("names the grammar for each kind of file Delta holds", () => {
		expect(languageOf("screens/blob.tsx")).toBe("tsx");
		expect(languageOf("data.ts")).toBe("ts");
		expect(languageOf("README.md")).toBe("md");
		expect(languageOf("LICENSE")).toBeUndefined();
	});
});
