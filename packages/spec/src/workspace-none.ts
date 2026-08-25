/**
 * The workspace for a runtime that has no filesystem: every path is refused
 * and `cleanup` is a no-op, since there is nothing to remove. Without `fs`
 * or `cli` registered, a spec can never reach `resolve`; this workspace
 * makes that absence legible, so a spec naming a path gets a `ToolError` in
 * the language's normal diagnostic shape, naming the exact path it tried.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";

import type { SpecError } from "./errors";
import type { Workspace } from "./workspace";

import { ToolError } from "./errors";

/**
 * Create a workspace that refuses every path, shaped as an async factory
 * returning a `Result` so it works directly as `runTests`'s `createWorkspace`
 * like the on-disk factory that can genuinely fail — this one never does.
 *
 * @returns A workspace whose `resolve` always fails, whose `cleanup` does
 * nothing, and whose `root` is a placeholder string that no resolution ever
 * joins onto.
 */
export async function createNoFilesystemWorkspace(): Promise<Result<Workspace, SpecError>> {
	let workspace: Workspace = {
		root: "<no filesystem>",
		resolve(path) {
			return failure(
				new ToolError(
					`Cannot resolve "${path}": this run has no filesystem, so no path can be read or written.`,
				),
			);
		},
		async cleanup() {
			return undefined;
		},
	};
	return success(workspace);
}
