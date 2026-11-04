/**
 * Tests for the temporary signoff worktree: its root is canonical, so a script's path filters
 * match the paths tools such as Vitest resolve inside it, and cleanup removes it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { realpath, stat } from "node:fs/promises";

import { isFailure } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vitest";

import { createRepo, removeRepos } from "./test-repo.js";
import { prepareWorktree } from "./worktree.js";

afterEach(removeRepos);

describe("prepareWorktree", () => {
	test("answers the worktree's canonical path and removes it on cleanup", async () => {
		let repo = await createRepo({ "package.json": JSON.stringify({ name: "fixture" }) });
		let prepared = await prepareWorktree(repo);
		if (isFailure(prepared)) throw prepared.error;
		let { root, cleanup } = prepared.data;
		try {
			expect(root).toBe(await realpath(root));
		} finally {
			await cleanup();
		}
		await expect(stat(root)).rejects.toThrow();
	});
});
