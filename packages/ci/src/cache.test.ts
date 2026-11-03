/**
 * Tests for cache pruning: an entry no run reused within the age limit is removed, one a run
 * read recently stays because the hit refreshed it, and the signoff records beside the cache
 * are left alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, readdir, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { CACHE_MAX_AGE, cacheDirectory, pruneCache, readCache, writeCache } from "./cache.js";
import { createRepo, removeRepos } from "./test-repo.js";

/** A day in milliseconds. */
const DAY = 24 * 60 * 60 * 1000;

/** A stored pass with no declared outputs, so a read always hits. */
const ENTRY = { duration: 10, output: "ok\n", outputs: {} };

afterEach(removeRepos);

/** Sets a file's access and modification time to `days` days ago. */
async function age(path: string, days: number): Promise<void> {
	let then = new Date(Date.now() - days * DAY);
	await utimes(path, then, then);
}

describe("pruneCache", () => {
	test("removes entries unused past the limit and keeps recent ones", async () => {
		let root = await createRepo({ "package.json": "{}\n" });
		let gitDirectory = join(root, ".git");
		let directory = cacheDirectory(gitDirectory);
		await writeCache(directory, "old", ENTRY);
		await writeCache(directory, "fresh", ENTRY);
		await age(join(directory, "old.json"), 31);
		await age(join(directory, "fresh.json"), 29);
		let record = join(gitDirectory, "sdxc-ci", "abc123.json");
		await writeFile(record, "{}");
		await age(record, 90);
		expect(await pruneCache(directory)).toBe(1);
		expect(await readdir(directory)).toEqual(["fresh.json"]);
		expect((await stat(record)).isFile()).toBe(true);
	});

	test("a cache hit refreshes the entry, so a reused pass outlives the limit", async () => {
		let root = await createRepo({ "package.json": "{}\n" });
		let directory = cacheDirectory(join(root, ".git"));
		await writeCache(directory, "reused", ENTRY);
		await age(join(directory, "reused.json"), 45);
		expect(await readCache(root, directory, "reused")).toEqual(ENTRY);
		expect(await pruneCache(directory)).toBe(0);
		expect(await readdir(directory)).toEqual(["reused.json"]);
	});

	test("prunes nothing in a directory that does not exist, and honors a custom age", async () => {
		let root = await createRepo({ "package.json": "{}\n" });
		let directory = cacheDirectory(join(root, ".git"));
		expect(await pruneCache(directory)).toBe(0);
		await mkdir(directory, { recursive: true });
		await writeCache(directory, "day-old", ENTRY);
		await age(join(directory, "day-old.json"), 2);
		expect(await pruneCache(directory, CACHE_MAX_AGE)).toBe(0);
		expect(await pruneCache(directory, DAY)).toBe(1);
	});
});
