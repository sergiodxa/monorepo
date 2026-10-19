/**
 * How `sdxc notes` finds note comments in each kind of comment, and how it prints them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { DEFAULT_TAGS, findNotes, formatNotes, projectNotes } from "./notes.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	await Promise.all(DIRECTORIES.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("findNotes", () => {
	test("reads a tag after every comment marker, its colon dropped", () => {
		let text = [
			"// TODO: answer the request",
			"let x = 1; // FIXME handle zero",
			" * HACK: until the API takes a cursor",
			"{/* TODO: render the page */}",
			"-- OPTIMIZE: index this column",
			"<!-- TODO: link the guide -->",
			"let todo = 'TODO in a string';",
			"// TODOS are not tags",
		].join("\n");

		expect(findNotes("a.tsx", text, DEFAULT_TAGS)).toEqual([
			{ file: "a.tsx", line: 1, tag: "TODO", text: "answer the request" },
			{ file: "a.tsx", line: 2, tag: "FIXME", text: "handle zero" },
			{ file: "a.tsx", line: 3, tag: "HACK", text: "until the API takes a cursor" },
			{ file: "a.tsx", line: 4, tag: "TODO", text: "render the page" },
			{ file: "a.tsx", line: 5, tag: "OPTIMIZE", text: "index this column" },
			{ file: "a.tsx", line: 6, tag: "TODO", text: "link the guide" },
		]);
	});

	test("reads only the tags it is given", () => {
		let text = "// TODO: one\n// REVIEW: two\n";

		expect(findNotes("a.ts", text, ["REVIEW"])).toEqual([
			{ file: "a.ts", line: 2, tag: "REVIEW", text: "two" },
		]);
	});
});

describe("projectNotes", () => {
	test("reads the layout folders and groups the list by file", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-notes-"));
		DIRECTORIES.push(root);
		let files: Record<string, string> = {
			"app/services/charge.ts": "export {};\n// TODO: retry a declined card\n",
			"routes/web.ts": "// FIXME: name this route\n",
			"node_modules/pkg/index.ts": "// TODO: not ours\n",
			"scripts/build.ts": "// TODO: outside the layout\n",
		};
		for (let [path, content] of Object.entries(files)) {
			await mkdir(dirname(join(root, path)), { recursive: true });
			await writeFile(join(root, path), content);
		}

		let notes = await projectNotes(root, DEFAULT_TAGS);

		expect(formatNotes(notes)).toBe(
			"app/services/charge.ts:\n  [2] TODO: retry a declined card\n\nroutes/web.ts:\n  [1] FIXME: name this route\n",
		);
	});
});
