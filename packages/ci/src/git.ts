/**
 * The git questions a run asks: which commit it tests, whether the tree matches that commit,
 * which files a cache key or workspace covers, and where the tested commit is pushed. Every
 * call runs `git` without a shell, so paths reach it exactly as given.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isAbsolute, join } from "node:path";

import type { Result } from "@sdxc/result";

import { isFailure, success } from "@sdxc/result";

import type { CommandError } from "./process.js";

import { runCommand } from "./process.js";

/** Runs `git` in `cwd` and answers its stdout. */
export async function git(
	cwd: string,
	args: readonly string[],
): Promise<Result<string, CommandError>> {
	let ran = await runCommand(["git", ...args], { cwd });
	if (isFailure(ran)) return ran;
	return success(ran.data.stdout);
}

/** NUL-separated git output as a list, without the empty entry a trailing NUL leaves. */
function entries(output: string): string[] {
	return output.split("\0").filter((entry) => entry !== "");
}

/** The repository's top directory, which every path a run reports is relative to. */
export async function repositoryRoot(cwd: string): Promise<Result<string, CommandError>> {
	let top = await git(cwd, ["rev-parse", "--show-toplevel"]);
	if (isFailure(top)) return top;
	return success(top.data.trim());
}

/**
 * The directory every worktree of the clone shares, where runs keep their records and cache,
 * so a pass in one worktree is reused by another.
 */
export async function sharedGitDirectory(root: string): Promise<Result<string, CommandError>> {
	let dir = await git(root, ["rev-parse", "--git-common-dir"]);
	if (isFailure(dir)) return dir;
	let path = dir.data.trim();
	return success(isAbsolute(path) ? path : join(root, path));
}

/** The commit HEAD points at. */
export async function headCommit(root: string): Promise<Result<string, CommandError>> {
	let head = await git(root, ["rev-parse", "HEAD"]);
	if (isFailure(head)) return head;
	return success(head.data.trim());
}

/** Whether the tree holds no change and no untracked file beyond what `.gitignore` excludes. */
export async function isClean(root: string): Promise<Result<boolean, CommandError>> {
	let status = await git(root, ["status", "--porcelain", "--untracked-files=all"]);
	if (isFailure(status)) return status;
	return success(status.data.trim() === "");
}

/** Every tracked file, relative to the root. */
export async function trackedFiles(root: string): Promise<Result<string[], CommandError>> {
	let listed = await git(root, ["ls-files", "-z"]);
	if (isFailure(listed)) return listed;
	return success(entries(listed.data));
}

/** The pathspec git reads `pattern` as: a glob anchored at the root. */
function pathspec(pattern: string): string {
	return `:(glob)${pattern}`;
}

/**
 * The files under `patterns` as git would commit them: each tracked file with its index object
 * hash, and each modified or untracked file with `null`, for the caller to hash from disk.
 */
export async function inputFiles(
	root: string,
	patterns: readonly string[],
): Promise<Result<Map<string, string | null>, CommandError>> {
	let specs = patterns.map(pathspec);
	let staged = await git(root, ["ls-files", "-s", "-z", "--", ...specs]);
	if (isFailure(staged)) return staged;
	let changed = await git(root, [
		"ls-files",
		"-m",
		"-o",
		"--exclude-standard",
		"-z",
		"--",
		...specs,
	]);
	if (isFailure(changed)) return changed;
	let files = new Map<string, string | null>();
	for (let entry of entries(staged.data)) {
		let [meta = "", path = ""] = entry.split("\t");
		files.set(path, meta.split(" ")[1] ?? null);
	}
	for (let path of entries(changed.data)) files.set(path, null);
	return success(files);
}

/** The URL `remote` fetches from. */
export async function remoteURL(
	root: string,
	remote: string,
): Promise<Result<string, CommandError>> {
	let url = await git(root, ["remote", "get-url", remote]);
	if (isFailure(url)) return url;
	return success(url.data.trim());
}

/** Where the current branch pushes: its upstream's remote and branch, or `null` without one. */
export async function upstream(
	root: string,
): Promise<Result<{ remote: string; branch: string } | null, CommandError>> {
	let current = await git(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
	if (isFailure(current)) return current;
	let branch = current.data.trim();
	let remote = await git(root, ["config", "--get", `branch.${branch}.remote`]);
	let merge = await git(root, ["config", "--get", `branch.${branch}.merge`]);
	if (isFailure(remote) || isFailure(merge)) return success(null);
	return success({
		remote: remote.data.trim(),
		branch: merge.data.trim().replace(/^refs\/heads\//, ""),
	});
}

/** The current branch's name; `HEAD` when detached. */
export async function currentBranch(root: string): Promise<Result<string, CommandError>> {
	let current = await git(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
	if (isFailure(current)) return current;
	return success(current.data.trim());
}

/** Pushes exactly `sha` to `branch` on `remote`, so commits made during the run stay local. */
export async function pushCommit(
	root: string,
	remote: string,
	sha: string,
	branch: string,
): Promise<Result<string, CommandError>> {
	return git(root, ["push", remote, `${sha}:refs/heads/${branch}`]);
}
