/**
 * The install a local `sdxc ci` runs before it loads the script: the project's package manager
 * with its frozen-lockfile flag, so a run never tests a `node_modules` older than the lockfile,
 * and a lockfile out of step with a manifest fails before any step runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyCommandContext, ExitError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { projectPackageManager } from "../package-manager.js";

/**
 * Installs the dependencies of the project at `root` exactly as its lock file pins them, printing
 * the command first and the install's output only when it fails, then exiting 1.
 */
export async function frozenInstall(
	ctx: Pick<AnyCommandContext, "exec" | "stdout">,
	root: string,
): Promise<Result<undefined, ExitError>> {
	let manager = await projectPackageManager(root);
	let command = manager.frozenInstall;
	ctx.stdout(`Installing dependencies: ${command.join(" ")}\n`);
	let installed = await ctx.exec(command, { cwd: root, stdio: "collect" });
	if (isFailure(installed)) {
		let output = "output" in installed.error ? installed.error.output : "";
		ctx.stdout(output);
		return exit(1, `${command.join(" ")} failed; the CI script did not run`);
	}
	return success();
}
