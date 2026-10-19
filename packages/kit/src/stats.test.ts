/**
 * How `sdxc stats` counts code lines and sorts files into the kinds the app layout names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { codeLines, formatStats, projectStats } from "./stats.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	await Promise.all(DIRECTORIES.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("codeLines", () => {
	test("leaves out blank lines and comments of every kind", () => {
		let source = [
			"/**",
			" * A module.",
			" */",
			"",
			"// a note",
			"let a = 1;",
			"/* inline */",
			"let b = 2; // trailing",
			"{/* jsx */}",
		].join("\n");

		expect(codeLines(source, false)).toBe(2);
		expect(codeLines("-- a comment\nCREATE TABLE t (id TEXT);\n", true)).toBe(1);
	});
});

describe("projectStats", () => {
	test("counts each kind in layout order, tests apart, with the ratio", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-stats-"));
		DIRECTORIES.push(root);
		let files: Record<string, string> = {
			"app/http/controllers/home.tsx": "let a = 1;\nlet b = 2;\n",
			"app/http/controllers/home.test.tsx": "let t = 1;\n",
			"app/models/post.ts": "// a\nlet c = 3;\n",
			"database/migrations/0001_CreatePosts.sql": "-- c\nCREATE TABLE posts (id TEXT);\n",
			"resources/locales/en.json": "{}\n",
		};
		for (let [path, content] of Object.entries(files)) {
			await mkdir(dirname(join(root, path)), { recursive: true });
			await writeFile(join(root, path), content);
		}

		let stats = await projectStats(root);

		expect(stats.rows).toEqual([
			{ kind: "Controllers", files: 1, lines: 2, code: 2 },
			{ kind: "Models", files: 1, lines: 2, code: 1 },
			{ kind: "Migrations", files: 1, lines: 2, code: 1 },
			{ kind: "Tests", files: 1, lines: 1, code: 1 },
		]);
		expect(stats).toMatchObject({ code: 4, tests: 1 });
		expect(formatStats(stats)).toContain("Code: 4  Tests: 1  Code to test ratio: 1:0.3");
	});
});
