/**
 * Resolves `--since <ref>` into a workspace scope: the workspaces whose files changed between
 * the ref and HEAD (plus uncommitted changes), widened later by the same dependent rule as
 * `--scope`. A change outside every workspace falls back to a full run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { git } from "./git.js";
import { loadWorkspaces, type Workspace } from "./workspaces.js";

/** How `--since` mapped changed files onto workspaces. */
export interface SinceScope {
	/**
	 * Workspace paths to keep, or `null` when a changed file sits outside every workspace and
	 * the run covers every entry.
	 */
	scope: readonly string[] | null;
	/** Relative paths that changed between the ref and the working tree. */
	files: readonly string[];
	/**
	 * Why the scope covers every workspace, when it does: a changed file outside every
	 * workspace, named so the run can print the rule.
	 */
	fallback: string | null;
}

/** NUL-separated git output as a list, without the empty entry a trailing NUL leaves. */
function entries(output: string): string[] {
	return output.split("\0").filter((entry) => entry !== "");
}

/**
 * Files that differ from `ref` through HEAD and the working tree: the committed range
 * `<ref>...HEAD` plus every modified or untracked file `.gitignore` does not exclude.
 */
export async function changedFilesSince(
	root: string,
	ref: string,
): Promise<Result<string[], Error>> {
	let committed = await git(root, ["diff", "--name-only", "-z", `${ref}...HEAD`]);
	if (isFailure(committed)) {
		return failure(new Error(`Cannot diff against ${ref}: ${committed.error.message}`));
	}
	let dirty = await git(root, ["ls-files", "-m", "-o", "--exclude-standard", "-z"]);
	if (isFailure(dirty)) {
		return failure(new Error(`Cannot list uncommitted changes: ${dirty.error.message}`));
	}
	let files = new Set([...entries(committed.data), ...entries(dirty.data)]);
	return success([...files].sort());
}

/** The workspace that owns `path`, or `null` when the path sits outside every workspace. */
function workspaceOf(path: string, workspaces: readonly Workspace[]): Workspace | null {
	let matches = workspaces.filter(
		(workspace) => path === workspace.path || path.startsWith(`${workspace.path}/`),
	);
	if (matches.length === 0) return null;
	matches.sort((a, b) => b.path.length - a.path.length);
	return matches[0] ?? null;
}

/**
 * Maps the files changed since `ref` onto workspace paths. When any file sits outside every
 * workspace (the root package.json, the lockfile, root config, the CI script), the scope is
 * `null` so the run covers every entry, and `fallback` names that file.
 */
export async function scopeSince(root: string, ref: string): Promise<Result<SinceScope, Error>> {
	let files = await changedFilesSince(root, ref);
	if (isFailure(files)) return files;
	let workspaces = await loadWorkspaces(root);
	if (isFailure(workspaces)) {
		return failure(new Error(`Cannot read workspaces: ${workspaces.error.message}`));
	}
	if (files.data.length === 0) {
		return success({ scope: [], files: [], fallback: null });
	}
	let scoped = new Set<string>();
	for (let path of files.data) {
		let workspace = workspaceOf(path, workspaces.data);
		if (workspace === null) {
			return success({
				scope: null,
				files: files.data,
				fallback: path,
			});
		}
		scoped.add(workspace.path);
	}
	return success({ scope: [...scoped].sort(), files: files.data, fallback: null });
}
