/**
 * Where `sdxc create` writes a project: a directory that is missing or holds nothing but a
 * `.git` folder, so `git init && sdxc create` works and an existing project is never written
 * over. The project takes its `package.json` name from the directory's last path segment.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

/** The directory a project is created in, as the command found it. */
export interface Target {
	/** Absolute path. */
	directory: string;
	/** The project's `package.json` name, derived from the directory's last segment. */
	name: string;
	/** `false` when the directory does not exist yet, so `create` makes it. */
	exists: boolean;
	/** Whether the directory already holds a `.git` folder. */
	hasGit: boolean;
}

/**
 * Resolves `directory` against `cwd` (the current directory when omitted) and checks it can
 * take a project. A file, or a directory holding anything besides `.git`, is a failure that
 * names the first entries in the way.
 */
export async function resolveTarget(
	cwd: string,
	directory: string | undefined,
): Promise<Result<Target, Error>> {
	let absolute = resolve(cwd, directory ?? ".");
	let name = packageName(basename(absolute));
	let info = await wrap(() => stat(absolute));
	if (isFailure(info)) {
		if ((info.error as NodeJS.ErrnoException).code === "ENOENT") {
			return success({ directory: absolute, name, exists: false, hasGit: false });
		}
		return info;
	}
	if (!info.data.isDirectory()) {
		return failure(new Error(`${absolute} is a file; sdxc create needs an empty directory`));
	}
	let entries = await wrap(() => readdir(absolute));
	if (isFailure(entries)) return entries;
	let others = entries.data.filter((entry) => entry !== ".git").sort();
	if (others.length > 0) {
		let shown = others.slice(0, 3).join(", ");
		let more = others.length > 3 ? ` and ${others.length - 3} more` : "";
		return failure(
			new Error(`${absolute} is not empty (${shown}${more}); sdxc create needs an empty directory`),
		);
	}
	return success({
		directory: absolute,
		name,
		exists: true,
		hasGit: entries.data.includes(".git"),
	});
}

/**
 * A directory name as an npm package name: lower case, with each run of characters npm
 * refuses collapsed to one `-`, and `app` when nothing usable is left.
 */
export function packageName(segment: string): string {
	let name = segment
		.toLowerCase()
		.replace(/[^a-z0-9._~-]+/g, "-")
		.replace(/^[._-]+|-+$/g, "");
	return name === "" ? "app" : name;
}
