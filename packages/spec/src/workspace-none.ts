/**
 * The workspace for a runtime that has no filesystem. Every path is refused,
 * and `cleanup` is a no-op because there is nothing to remove.
 *
 * A run without `fs` and `cli` registered can never reach `resolve` — those are
 * the only capabilities that resolve a path — so this exists to make that
 * arrangement expressible rather than to be used. It also makes the failure
 * legible if the arrangement is ever wrong: a spec that reaches for a file is
 * told there is no filesystem here, in the language's own error shape, instead
 * of crashing on a missing `node:fs` or silently writing into a directory that
 * disappears with the isolate.
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
 * Create a workspace that refuses every path.
 *
 * Shaped as an async factory returning a `Result` so it is usable directly as
 * `runTests`'s `createWorkspace`, matching the on-disk factory that genuinely
 * can fail; this one never does.
 *
 * @returns A workspace whose `resolve` always fails and whose `cleanup` does nothing.
 */
export async function createNoFilesystemWorkspace(): Promise<Result<Workspace, SpecError>> {
	let workspace: Workspace = {
		// Nothing resolves, so the root is only ever reported, never joined onto.
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
