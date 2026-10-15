/**
 * The `sdxc ui update` handler: replaces copied files with the installed version. A file the
 * project edited is replaced only with `--force`, or when the user says yes on a terminal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure, success as succeed } from "@sdxc/result";

import { SDXC_COMMANDS } from "../../contract.js";
import { packageRoot, project } from "../../middleware.js";
import { finishPlan, loadContext, planUpdate } from "../../ui/commands.js";

/** Updates the named copies and prints what it replaced and what it left. */
export default createCommand(SDXC_COMMANDS.ui.update, {
	middleware: [project(), packageRoot()],
	/** Without a terminal and without `--force`, every edited file is left as it is. */
	async handler(ctx) {
		let context = await loadContext(ctx.project, ctx.packageRoot);
		if (isFailure(context)) return context;
		let plan = await planUpdate(context.data, ctx.arguments.components, {
			overwrite: (path) =>
				ctx.flags.force
					? Promise.resolve(succeed(true))
					: ctx.prompt.confirm({
							message: `${path} is edited; replace it with the installed version?`,
							default: false,
							name: "overwrite",
						}),
		});
		if (isFailure(plan)) return plan;
		let finished = await finishPlan(ctx, context.data, plan.data, ctx.flags.dryRun);
		if (isFailure(finished)) return finished;
		return success();
	},
});
