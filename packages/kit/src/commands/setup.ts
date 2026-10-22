/**
 * The `sdxc setup` handler: lists known features with no name, or installs auth / billing /
 * flags from a printed plan (`-y` writes; without it the plan is dry-run).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { SDXC_COMMANDS } from "../contract.js";
import { packageRoot, project } from "../middleware.js";
import { listFeatures, runSetup } from "../setup/index.js";

/**
 * `sdxc setup` with no feature: lists the catalog. With a feature argument, installs it.
 */
export default createCommand(SDXC_COMMANDS.setup, {
	middleware: [project(), packageRoot()],
	async handler(ctx) {
		if (ctx.arguments.feature === undefined) {
			ctx.stdout(listFeatures());
			return success();
		}
		let ran = await runSetup(ctx.project.root, ctx.arguments.feature, {
			provider: ctx.flags.provider,
			dryRun: ctx.flags.dryRun,
			yes: ctx.flags.yes,
			stdout: (text) => ctx.stdout(text),
		});
		if (isFailure(ran)) return ran;
		return success();
	},
});
