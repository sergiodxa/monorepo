/**
 * The `sdxc ui add` handler: copies components into `ui.directory` and points the project's
 * imports at the copies. Without names, a terminal searches the registry for them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { SDXC_COMMANDS } from "../../contract.js";
import { uiEntry } from "../../lock.js";
import { packageRoot, project } from "../../middleware.js";
import { finishPlan, loadContext, planAdd } from "../../ui/commands.js";

/** Copies the named components, or the ones picked on a terminal, and prints what it did. */
export default createCommand(SDXC_COMMANDS.ui.add, {
	middleware: [project(), packageRoot()],
	/** Exits 2 when no component is named and none is picked. */
	async handler(ctx) {
		let context = await loadContext(ctx.project, ctx.packageRoot);
		if (isFailure(context)) return context;
		let names: readonly string[] = ctx.arguments.components;
		if (names.length === 0) {
			let lock = context.data.lock;
			let picked = await ctx.prompt.search({
				message: "Add which components?",
				placeholder: "Type to filter",
				multiple: true,
				options: [...context.data.registry.entries.keys()].sort().map((name) => {
					let copied = uiEntry(lock, name) !== undefined;
					return copied ? { value: name, hint: "copied", disabled: true } : { value: name };
				}),
				default: [],
				name: "components",
			});
			if (isFailure(picked)) return picked;
			names = picked.data;
		}
		if (names.length === 0) return usage("Name at least one component to add");
		let plan = await planAdd(context.data, names, { withDeps: ctx.flags.withDeps });
		if (isFailure(plan)) return plan;
		let finished = await finishPlan(ctx, context.data, plan.data, ctx.flags.dryRun);
		if (isFailure(finished)) return finished;
		return success();
	},
});
