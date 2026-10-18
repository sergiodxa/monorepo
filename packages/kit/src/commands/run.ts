/**
 * The `sdxc run` handler: runs the project's own command line, `bootstrap/cli.ts`, with the
 * project's runtime and every token after `run` as typed, so a globally installed `sdxc` reaches
 * any project's commands without a package script.
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

/** Where the app layout puts an app's command line, relative to the project root. */
export const CLI_ENTRY = "bootstrap/cli.ts";

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
 * The command that starts the project's command line with `args`: under Bun for a project on
 * Bun and under Node otherwise.
 *
 * @param root - The project root, whose `package.json` and lock file name the package manager
 */
export async function commandLine(
	root: string,
	args: readonly string[],
): Promise<Result<string[], Error>> {
	let manifest = await readManifest(root);
	if (isFailure(manifest)) return manifest;
	let manager = await packageManager({
		declared: manifest.data.manifest.packageManager,
		findLockFile: lockFileAtOrAbove(root),
	});
	return success([manager.name === "bun" ? "bun" : "node", CLI_ENTRY, ...args]);
}

/**
 * Runs `bootstrap/cli.ts` under Bun for a project on Bun and under Node otherwise, with its
 * output on the terminal and the project's `node_modules/.bin` first on `PATH`, as a package
 * script has it; the app's exit code is `sdxc run`'s, and only the app's messages print on failure.
 */
export default createCommand(SDXC_COMMANDS.run, {
	middleware: [project()],
	/** Fails naming the missing entry; otherwise hands the app's exit code back unchanged. */
	async handler(ctx) {
		let root = ctx.project.root;
		let entry = join(root, CLI_ENTRY);
		if (!isSuccess(await wrap(() => stat(entry)))) {
			return failure(
				new Error(`${CLI_ENTRY} not found in ${root}; an app's command line starts there`),
			);
		}
		let command = await commandLine(root, ctx.arguments.args);
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
