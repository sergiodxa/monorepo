/**
 * Tests for `sdxc-ci clean`: it removes the step cache and run history below the shared git
 * directory and reports what went, keeps signoff records, and exits 2 outside a repository —
 * driven through `invoke()` against real temporary repositories.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { afterEach, describe, expect, test } from "vitest";

import { formatBytes } from "./clean.js";
import { cli } from "./cli.js";
import { createRepo, removeRepos } from "./test-repo.js";

/** The environment a local run sees: no CI variable. */
const ENV = { CI: "" };

afterEach(removeRepos);

/** A repository whose git directory holds two cache entries, one run and a signoff record. */
async function repoWithStores(): Promise<{ root: string; store: string }> {
	let root = await createRepo({ "package.json": "{}\n" });
	let store = join(root, ".git", "sdxc-ci");
	await mkdir(join(store, "cache"), { recursive: true });
	await mkdir(join(store, "runs"), { recursive: true });
	await writeFile(join(store, "cache", "a.json"), "1234567890");
	await writeFile(join(store, "cache", "b.json"), "12345");
	await writeFile(join(store, "runs", "run.json"), "123");
	await writeFile(join(store, "abc123.json"), "{}");
	return { root, store };
}

describe("sdxc-ci clean", () => {
	test("removes the cache and run history, keeping signoff records", async () => {
		let { root, store } = await repoWithStores();
		let run = await invoke(cli, ["clean"], { cwd: root, env: ENV });
		expect(run.code).toBe(0);
		expect(run.stdout).toBe("Removed 3 files (18 B) from the cache and run history.\n");
		expect(await readdir(store)).toEqual(["abc123.json"]);
	});

	test("--json reports the directories, files and bytes removed", async () => {
		let { root, store } = await repoWithStores();
		let run = await invoke(cli, ["clean", "--json"], { cwd: root, env: ENV });
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({
			directories: [join(store, "cache"), join(store, "runs")],
			files: 3,
			bytes: 18,
		});
	});

	test("reports nothing to clean when no run stored anything", async () => {
		let root = await createRepo({ "package.json": "{}\n" });
		let run = await invoke(cli, ["clean"], { cwd: root, env: ENV });
		expect(run).toMatchObject({
			code: 0,
			stdout: "Nothing to clean: the cache and run history are empty.\n",
		});
	});

	test("exits 2 outside a git repository", async () => {
		let cwd = await realpath(await mkdtemp(join(tmpdir(), "sdxc-ci-bare-dir-")));
		try {
			let run = await invoke(cli, ["clean"], { cwd, env: ENV });
			expect(run.code).toBe(2);
			expect(run.stderr).toContain("Not inside a git repository");
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});
});

describe("formatBytes", () => {
	test("prints bytes below a kilobyte, then one decimal in the largest unit", () => {
		expect(formatBytes(0)).toBe("0 B");
		expect(formatBytes(1536)).toBe("1.5 KB");
		expect(formatBytes(13 * 1024 * 1024)).toBe("13.0 MB");
	});
});
