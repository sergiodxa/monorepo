/**
 * Projects created inside a monorepo: a directory below a `package.json` that declares
 * `workspaces` belongs to that repository, whose root owns CI. The template's CI script and
 * GitHub workflows are left out there, so the repository's own CI stays the only one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { isSuccess, wrap } from "@sdxc/result";

import type { TemplateTree } from "./templates.js";

/** Template paths a repository root owns, left out of a project created inside a workspace. */
export const ROOT_OWNED_PATHS: readonly string[] = [".config/sdxc/ci.ts", ".github/"];

/** Whether a `package.json` above `directory` declares `workspaces`. */
export async function insideWorkspace(directory: string): Promise<boolean> {
	let current = dirname(directory);
	while (true) {
		let text = await wrap(() => readFile(join(current, "package.json"), "utf8"));
		if (isSuccess(text)) {
			let manifest = wrap((): unknown => JSON.parse(text.data));
			if (isSuccess(manifest) && typeof manifest.data === "object" && manifest.data !== null) {
				if ("workspaces" in manifest.data) return true;
			}
		}
		let parent = dirname(current);
		if (parent === current) return false;
		current = parent;
	}
}

/** Removes every root-owned file and directory from `tree`. */
export function dropRootOwned(tree: TemplateTree): void {
	/** Whether `path` is one of the root-owned paths or sits below one. */
	let owned = (path: string): boolean =>
		ROOT_OWNED_PATHS.some((root) => (root.endsWith("/") ? path.startsWith(root) : path === root));
	for (let path of tree.files.keys()) if (owned(path)) tree.files.delete(path);
	for (let path of tree.directories)
		if (owned(`${path}/`) || owned(path)) tree.directories.delete(path);
}
