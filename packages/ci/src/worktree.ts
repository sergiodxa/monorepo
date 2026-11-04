/**
 * A temporary detached worktree of HEAD for a clean signoff run: creates it, installs
 * dependencies with a frozen lockfile (workspace package links must point at the worktree, so a
 * symlink of the main `node_modules` would test the dirty checkout), and removes it afterwards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { git } from "./git.js";
import { runCommand } from "./process.js";

/** A prepared worktree ready to run the script in, with a cleanup that removes it. */
export interface PreparedWorktree {
	/** Absolute path of the temporary worktree. */
	root: string;
	/** Removes the worktree and its directory; safe to call more than once. */
	cleanup: () => Promise<void>;
}

/** Lock files that name a package manager, in lookup order. */
const LOCK_FILES: ReadonlyArray<readonly [string, string[]]> = [
	["bun.lock", ["bun", "install", "--frozen-lockfile"]],
	["bun.lockb", ["bun", "install", "--frozen-lockfile"]],
	["pnpm-lock.yaml", ["pnpm", "install", "--frozen-lockfile"]],
	["yarn.lock", ["yarn", "install", "--immutable"]],
	["package-lock.json", ["npm", "ci"]],
];

/** The frozen install command for `root`, from its lockfile; Bun when none is found. */
async function frozenInstallCommand(root: string): Promise<string[]> {
	for (let [file, command] of LOCK_FILES) {
		let found = await stat(join(root, file)).then(
			() => true,
			() => false,
		);
		if (found) return command;
	}
	return ["bun", "install", "--frozen-lockfile"];
}

/**
 * Creates a detached worktree of HEAD under a temp directory, installs dependencies there with
 * a frozen lockfile so workspace packages resolve inside the worktree, and returns a cleanup
 * that removes the worktree even when the install failed. Its root is the canonical path (macOS
 * puts the temp directory under `/var`, a symlink to `/private/var`), so a script's path filters
 * match the paths tools resolve inside it.
 */
export async function prepareWorktree(root: string): Promise<Result<PreparedWorktree, Error>> {
	let directory = await realpath(await mkdtemp(join(tmpdir(), "sdxc-ci-wt-")));
	let added = await git(root, ["worktree", "add", "--detach", directory, "HEAD"]);
	if (isFailure(added)) {
		await rm(directory, { recursive: true, force: true });
		return failure(new Error(`git worktree add failed: ${added.error.message}`));
	}
	let removed = false;
	let cleanup = async (): Promise<void> => {
		if (removed) return;
		removed = true;
		await git(root, ["worktree", "remove", "--force", directory]);
		await rm(directory, { recursive: true, force: true });
	};
	let command = await frozenInstallCommand(directory);
	let installed = await runCommand(command, { cwd: directory });
	if (isFailure(installed)) {
		await cleanup();
		return failure(
			new Error(
				`${command.join(" ")} failed in the worktree; the CI script did not run\n${installed.error.output}`,
			),
		);
	}
	return success({ root: directory, cleanup });
}
