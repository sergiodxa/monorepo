/**
 * The repository's history as the release reads it: the release tags, the commit range since
 * the last one with the files each commit touched, and the checks behind the same-day rules.
 * Every command runs at the repo root through `git` itself, so the answers match what CI sees.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, isSuccess, success } from "@sdxc/result";

import type { CommandError } from "./command.js";

import { run } from "./command.js";
import { REPO_ROOT } from "./workspace.js";

/** A release tag, `v` plus the dated version, with the parts the ordering compares. */
const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

/** Record separator, then sha, subject and body split by field separators; `--name-only` adds the paths. */
const LOG_FORMAT = "--format=%x1e%H%x1f%s%x1f%b%x1f";

/** A full-history log with paths runs to hundreds of megabytes; the buffer allows for it. */
const OUTPUT_LIMIT = 512 * 1024 * 1024;

/** The commit every publish manifest records as `gitHead` and the release tag points at. */
export async function headSha(): Promise<Result<string, CommandError>> {
	let output = await git(["rev-parse", "HEAD"]);
	if (isFailure(output)) return output;
	return success(output.data.trim());
}

/** The highest `v<YYYY>.<M>.<D>` tag by its numeric parts, or `null` before the first release. */
export async function latestReleaseTag(): Promise<Result<string | null, CommandError>> {
	let output = await git(["tag", "--list", "v*"]);
	if (isFailure(output)) return output;
	let tags = output.data
		.split("\n")
		.map((line) => line.trim())
		.filter((tag) => RELEASE_TAG.test(tag));
	tags.sort((a, b) => compareVersions(versionParts(b), versionParts(a)));
	return success(tags[0] ?? null);
}

/** The commit a tag points at, through an annotated tag when there is one. */
export async function tagSha(tag: string): Promise<Result<string, CommandError>> {
	let output = await git(["rev-list", "-n", "1", tag]);
	if (isFailure(output)) return output;
	return success(output.data.trim());
}

/** Whether `tag` exists in this clone; git declining to resolve it is the `false`. */
export async function tagExists(tag: string): Promise<boolean> {
	return isSuccess(await git(["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`]));
}

/**
 * Raw `git log` output for `parseCommits`, oldest commit first: the whole history when `range`
 * is `null`, otherwise the given range such as `v2026.9.2..HEAD`.
 */
export async function commitLog(range: string | null): Promise<Result<string, CommandError>> {
	return git(["log", ...(range === null ? [] : [range]), "--reverse", LOG_FORMAT, "--name-only"]);
}

/** Whether `sha` names a commit in this clone, which a `gitHead` from npm may not after a rewrite. */
export async function hasCommit(sha: string): Promise<boolean> {
	return isSuccess(await git(["cat-file", "-e", `${sha}^{commit}`]));
}

/** Repo-relative paths that differ between `sinceSha` and HEAD. */
export async function changedFiles(sinceSha: string): Promise<Result<string[], CommandError>> {
	let output = await git(["diff", "--name-only", sinceSha, "HEAD"]);
	if (isFailure(output)) return output;
	return success(
		output.data
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line !== ""),
	);
}

/**
 * Brings the remote's tags in, so a release created elsewhere today is seen. Best effort: an
 * offline clone carries on with the tags it has, which keeps a dry run able to plan.
 */
export async function fetchTags(): Promise<void> {
	await git(["fetch", "--tags", "--quiet"]);
}

/** Runs git at the repo root; the answer is its stdout. */
async function git(args: string[]): Promise<Result<string, CommandError>> {
	let result = await run("git", args, { cwd: REPO_ROOT, maxBuffer: OUTPUT_LIMIT });
	if (isFailure(result)) return result;
	return success(result.data.stdout);
}

function versionParts(tag: string): number[] {
	return tag.slice(1).split(".").map(Number);
}

function compareVersions(a: number[], b: number[]): number {
	for (let index = 0; index < 3; index += 1) {
		let difference = (a[index] ?? 0) - (b[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return 0;
}
