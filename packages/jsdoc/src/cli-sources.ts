/**
 * Collects the source text `sdxc-jsdoc extract` documents: each file named, every source file
 * under each directory named, and stdin for `-`. Paths are recorded relative to the run's
 * directory with forward slashes, so node ids read the same on every platform.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

import type { ChainContext, ExitError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { exit } from "@sdxc/cli";
import { success } from "@sdxc/result";

/** One file's text and the path its nodes are documented under. */
export interface SourceFile {
	path: string;
	source: string;
}

/** The extensions a directory walk picks up, matching the dialects `extract` reads. */
const SOURCE_EXTENSION = /\.(?:[cm]?[jt]s|[jt]sx)$/;

/**
 * Every source file `paths` names, in the order given and sorted within a directory; a file
 * reached twice is read once.
 *
 * @param ctx - The running command, for its directory and stdin
 * @param paths - The path arguments as typed, `-` meaning stdin
 * @param stdinPath - The path stdin is documented under
 * @returns The files, or an exit 2 naming the first path that could not be read
 */
export async function readSources(
	ctx: Pick<ChainContext, "cwd" | "stdin">,
	paths: string[],
	stdinPath: string,
): Promise<Result<SourceFile[], ExitError>> {
	let files = new Map<string, SourceFile>();
	for (let path of paths) {
		if (path === "-") {
			files.set(stdinPath, { path: stdinPath, source: await ctx.stdin.text() });
			continue;
		}
		try {
			for (let absolute of await sourcePaths(resolve(ctx.cwd, path))) {
				let name = relative(ctx.cwd, absolute).split(sep).join("/");
				if (files.has(name)) continue;
				files.set(name, { path: name, source: await readFile(absolute, "utf8") });
			}
		} catch (error) {
			let reason = error instanceof Error ? error.message : String(error);
			return exit(2, `Cannot read ${path}: ${reason}`);
		}
	}
	return success([...files.values()]);
}

/**
 * The file itself whatever its extension, since naming it is the request; for a directory, every
 * source file below it, skipping `node_modules` and dot-directories, which hold dependencies and
 * tooling state.
 */
async function sourcePaths(absolute: string): Promise<string[]> {
	if (!(await stat(absolute)).isDirectory()) return [absolute];
	let entries = await readdir(absolute, { withFileTypes: true });
	let found: string[] = [];
	for (let entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
		let child = join(absolute, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
			found.push(...(await sourcePaths(child)));
		} else if (entry.isFile() && SOURCE_EXTENSION.test(entry.name)) {
			found.push(child);
		}
	}
	return found;
}
