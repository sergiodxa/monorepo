/**
 * The project every `sdxc` command works in: the nearest directory at or above the current one
 * that holds a `package.json`. Configuration and every configured path resolve against it, and a
 * path that would leave it is refused, so a command only ever writes inside the project.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isSuccess, success, wrap } from "@sdxc/result";

/**
 * The nearest directory at or above `cwd` holding a `package.json`, as an absolute path. Reaching
 * the filesystem root without one is a failure naming where the search started.
 */
export async function findProjectRoot(cwd: string): Promise<Result<string, Error>> {
	let directory = resolve(cwd);
	while (true) {
		let manifest = await wrap(() => stat(join(directory, "package.json")));
		if (isSuccess(manifest) && manifest.data.isFile()) return success(directory);
		let parent = dirname(directory);
		if (parent === directory) {
			return failure(
				new Error(`No package.json at or above ${resolve(cwd)}; run sdxc inside a project`),
			);
		}
		directory = parent;
	}
}

/**
 * `path`, relative to `root`, as an absolute path that stays inside `root`. An absolute path, or
 * one whose `..` segments climb out of the project, is a failure.
 */
export function resolveInside(root: string, path: string): Result<string, Error> {
	if (isAbsolute(path)) return failure(new Error(`${path} must be relative to the project root`));
	let resolved = resolve(root, path);
	let fromRoot = relative(root, resolved);
	if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
		return failure(new Error(`${path} points outside the project root`));
	}
	return success(resolved);
}
