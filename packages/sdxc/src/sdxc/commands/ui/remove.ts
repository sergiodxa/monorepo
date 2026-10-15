/**
 * The `sdxc ui remove` handler: deletes copies and points imports back at `sdxc/ui/<name>`.
 * Without names, a terminal picks from the copies the lock file lists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success, usage } from "@sdxc/cli";
import { failure, isFailure } from "@sdxc/result";

import { SDXC_COMMANDS } from "../../contract.js";
import { uiEntries } from "../../lock.js";
import { packageRoot, project } from "../../middleware.js";
import { finishPlan, loadContext, planRemove } from "../../ui/commands.js";

/** Removes the named copies, or the ones picked on a terminal, and prints what it did. */
export default createCommand(SDXC_COMMANDS.ui.remove, {
	middleware: [project(), packageRoot()],
	/** Exits 1 when nothing is copied, and 2 when no copy is named and none is picked. */
	async handler(ctx) {
		let context = await loadContext(ctx.project, ctx.packageRoot);
		if (isFailure(context)) return context;
		let names: readonly string[] = ctx.arguments.components;
		if (names.length === 0) {
			let copies = uiEntries(context.data.lock).map((entry) => entry.name);
			if (copies.length === 0) {
				return failure(new Error("No component is copied; sdxc ui add copies one"));
			}
			let picked = await ctx.prompt.multiselect<string>({
				message: "Remove which copies?",
				options: copies.sort(),
				default: [],
				name: "components",
			});
			if (isFailure(picked)) return picked;
			names = picked.data;
		}
		if (names.length === 0) return usage("Name at least one component to remove");
		let plan = await planRemove(context.data, names);
		if (isFailure(plan)) return plan;
		let finished = await finishPlan(ctx, context.data, plan.data, ctx.flags.dryRun);
		if (isFailure(finished)) return finished;
		return success();
	},
});
