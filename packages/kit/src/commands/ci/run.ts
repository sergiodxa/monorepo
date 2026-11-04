/**
 * The `sdxc ci` handler: finds the project's CI script, installs dependencies with a frozen
 * lockfile on a local run, scopes the run to the workspace it was started in, and runs the
 * script exactly as `sdxc-ci run` would.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { detectRunner } from "@sdxc/ci";
import { runAction } from "@sdxc/ci/command-line";
import { createCommand, exit } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { frozenInstall } from "../../ci/install.js";
import { locateCI } from "../../ci/locate.js";
import { SDXC_COMMANDS } from "../../contract.js";

export default createCommand(SDXC_COMMANDS.ci, {
	middleware: [],
	/**
	 * Exits 2 without a script, 1 when the install or a step fails, and with the run's own code
	 * otherwise. A remote run skips the install, which the CI host's workflow already ran.
	 */
	async handler(ctx) {
		let located = await locateCI(ctx.cwd);
		if (isFailure(located)) return exit(2, located.error.message);
		let runner = ctx.flags.runner ?? detectRunner(ctx.env);
		/**
		 * `--worktree` installs inside the temporary worktree itself; installing the main
		 * checkout first would leave the worktree without its own correct workspace links.
		 */
		if (runner === "local" && ctx.flags.install && !ctx.flags.worktree) {
			let installed = await frozenInstall(ctx, located.data.root);
			if (isFailure(installed)) return installed;
		}
		let workspace = located.data.workspace;
		let scope = ctx.flags.scope.length > 0 || workspace === null ? ctx.flags.scope : [workspace];
		return runAction(
			{
				cwd: ctx.cwd,
				env: ctx.env,
				stdout: ctx.stdout,
				style: ctx.style,
				signal: ctx.signal,
				interactive: process.stdout.isTTY === true,
			},
			located.data.script,
			{ ...ctx.flags, runner, scope },
			located.data.root,
		);
	},
});
