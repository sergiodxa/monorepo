/**
 * Suite loading from a directory: discovers every `.spec` file under a root,
 * reads each one, and hands the texts to `loadSources` for parsing and
 * registration. Everything here is the filesystem half — the walk, the reads,
 * and the lexicographic order they impose; the language half lives in
 * `sources.ts` and is reachable without a disk.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure } from "@sdxc/result";

import type { SpecError } from "./errors";
import type { LoadedSuite, SpecSource } from "./sources";

import { LoadError } from "./errors";
import { loadSources } from "./sources";

/**
 * Load a suite from a directory: find `*.spec` files recursively, read them in
 * lexicographic relative-path order, then parse and register them.
 *
 * @param root - The suite directory, conventionally `spec/`.
 * @returns The loaded suite, or the load/parse error that prevented it.
 */
export async function loadSuite(root: string): Promise<Result<LoadedSuite, SpecError>> {
	let relativePaths: string[];
	try {
		relativePaths = await collectSpecFiles(root, "");
	} catch (cause) {
		return failure(
			new LoadError(
				"load-error",
				`Could not read the suite directory ${root}: ${describeCause(cause)}`,
			),
		);
	}
	if (relativePaths.length === 0) {
		return failure(new LoadError("load-error", `No .spec files found under ${root}.`));
	}
	relativePaths.sort();

	let sources: SpecSource[] = [];
	for (let relativePath of relativePaths) {
		let path = join(root, relativePath);
		try {
			sources.push({ path, text: await readFile(path, "utf8") });
		} catch (cause) {
			return failure(
				new LoadError("load-error", `Could not read ${path}: ${describeCause(cause)}`),
			);
		}
	}

	return loadSources(sources);
}

/**
 * Walk a directory tree collecting `.spec` file paths relative to the root.
 * Directories reached through symlinks are skipped, which keeps the walk
 * cycle-free. Filesystem failures propagate for the caller to wrap.
 *
 * @param root - The suite root the walk started from.
 * @param prefix - The directory currently being read, relative to the root.
 * @returns Relative paths of every `.spec` file found under the prefix.
 */
async function collectSpecFiles(root: string, prefix: string): Promise<string[]> {
	let entries = await readdir(join(root, prefix), { withFileTypes: true });
	let found: string[] = [];
	for (let entry of entries) {
		let relativePath = prefix === "" ? entry.name : join(prefix, entry.name);
		if (entry.isDirectory()) {
			found.push(...(await collectSpecFiles(root, relativePath)));
		} else if (entry.isFile() && entry.name.endsWith(".spec")) {
			found.push(relativePath);
		}
	}
	return found;
}

/**
 * Render an unknown thrown value (from `node:fs`) as a one-line reason for a
 * load error message.
 *
 * @param cause - Whatever the filesystem call threw.
 * @returns The cause's message, or its string form for non-Error throws.
 */
function describeCause(cause: unknown): string {
	if (cause instanceof Error) return cause.message;
	return String(cause);
}
