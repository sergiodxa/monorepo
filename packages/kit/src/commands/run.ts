/**
 * The `sdxc run` handler: runs the project's own command line with the project's runtime and
 * every token after `run` as typed, so a globally installed `sdxc` reaches any project's
 * commands without a package script. The entry module defaults to `bootstrap/cli.ts` and a
 * project overrides it with `run.entry` in `.config/sdxc.jsonc`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { stat } from "node:fs/promises";
import { delimiter, join } from "node:path";

import type { Result } from "@sdxc/result";

import { createCommand, ExecError, exit, failure, success } from "@sdxc/cli";
import { isFailure, isSuccess, wrap } from "@sdxc/result";

import { SDXC_COMMANDS } from "../contract.js";
import { project } from "../middleware.js";
import { lockFileAtOrAbove, packageManager } from "../package-manager.js";
import { readManifest } from "../upgrade/project.js";

/** Where an app's command line starts when `run.entry` is left at its default. */
export const DEFAULT_CLI_ENTRY = "bootstrap/cli.ts";

/**
 * `PATH` with the project's `node_modules/.bin` first, as a package script has it, so a child
 * runs the project's own `cf` or `vp` in place of a global one.
 *
 * @param root - The project root
 * @param path - The run's `PATH`
 */
export function projectPath(root: string, path: string | undefined): string {
	let bin = join(root, "node_modules", ".bin");
	return path === undefined ? bin : `${bin}${delimiter}${path}`;
}

/**
 * The command that starts the project's command line at `entry` with `args`: under Bun for a
 * project on Bun and under Node otherwise.
 *
 * @param root - The project root, whose `package.json` and lock file name the package manager
 * @param entry - The module to start, relative to the project root
 * @param args - Tokens after `sdxc run`
 */
export async function commandLine(
	root: string,
	entry: string,
	args: readonly string[],
): Promise<Result<string[], Error>> {
	let manifest = await readManifest(root);
	if (isFailure(manifest)) return manifest;
	let manager = await packageManager({
		declared: manifest.data.manifest.packageManager,
		findLockFile: lockFileAtOrAbove(root),
	});
	return success([manager.name === "bun" ? "bun" : "node", entry, ...args]);
}

/**
 * Runs the configured command-line entry under Bun for a project on Bun and under Node
 * otherwise, with its output on the terminal and the project's `node_modules/.bin` first on
 * `PATH`, as a package script has it; the app's exit code is `sdxc run`'s, and only the app's
 * messages print on failure.
 */
export default createCommand(SDXC_COMMANDS.run, {
	middleware: [project()],
	/** Fails naming the missing entry; otherwise hands the app's exit code back unchanged. */
	async handler(ctx) {
		let root = ctx.project.root;
		let entry = ctx.project.config.run.entry;
		let absolute = join(root, entry);
		if (!isSuccess(await wrap(() => stat(absolute)))) {
			return failure(
				new Error(`${entry} not found in ${root}; an app's command line starts there`),
			);
		}
		let command = await commandLine(root, entry, ctx.arguments.args);
		if (isFailure(command)) return command;
		let ran = await ctx.exec(command.data, {
			cwd: root,
			stdio: "inherit",
			env: { PATH: projectPath(root, ctx.env.PATH) },
		});
		if (isSuccess(ran)) return success();
		if (ran.error instanceof ExecError && ran.error.code !== null) return exit(ran.error.code);
		return ran;
	},
});
