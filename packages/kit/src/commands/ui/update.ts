/**
 * The `sdxc ui update` handler: replaces copied files with the installed version. A file the
 * project edited is replaced only with `--force`, or when the user says yes on a terminal;
 * `--all` covers every copy and leaves edited files without asking, so it is safe unattended.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success, usage } from "@sdxc/cli";
import { isFailure, success as succeed } from "@sdxc/result";

import { SDXC_COMMANDS } from "../../contract.js";
import { uiEntries } from "../../lock.js";
import { packageRoot, project } from "../../middleware.js";
import { finishPlan, loadContext, planUpdate } from "../../ui/commands.js";

/** Updates the named copies, or every copy with `--all`, and prints what it replaced and left. */
export default createCommand(SDXC_COMMANDS.ui.update, {
	middleware: [project(), packageRoot()],
	/**
	 * Exits 2 when neither names nor `--all` are given, or both are. Without a terminal and
	 * without `--force`, every edited file is left as it is.
	 */
	async handler(ctx) {
		let named = ctx.arguments.components;
		let all = ctx.flags.all;
		if (named.length === 0 && !all) return usage("Name the copies to update, or pass --all");
		if (named.length > 0 && all) return usage("Name the copies to update or pass --all, not both");
		let context = await loadContext(ctx.project, ctx.packageRoot);
		if (isFailure(context)) return context;
		let names = all ? uiEntries(context.data.lock).map((entry) => entry.name) : named;
		if (names.length === 0) {
			ctx.stdout("No component is copied; sdxc ui add copies one\n");
			return success();
		}
		let plan = await planUpdate(context.data, names, {
			withDeps: ctx.flags.withDeps,
			overwrite: (path) =>
				ctx.flags.force || all
					? Promise.resolve(succeed(ctx.flags.force))
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
