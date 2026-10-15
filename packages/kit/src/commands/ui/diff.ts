/**
 * The `sdxc ui diff` handler: prints how a copy differs from the installed version as a unified
 * diff, or says that it matches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { SDXC_COMMANDS } from "../../contract.js";
import { packageRoot, project } from "../../middleware.js";
import { diffComponent, loadContext } from "../../ui/commands.js";

/** Writes the diff, from the installed file to the local one, to stdout. */
export default createCommand(SDXC_COMMANDS.ui.diff, {
	middleware: [project(), packageRoot()],
	/** Exits 1 for a component that is not copied or no longer shipped. */
	async handler(ctx) {
		let context = await loadContext(ctx.project, ctx.packageRoot);
		if (isFailure(context)) return context;
		let name = ctx.arguments.component;
		let diff = await diffComponent(context.data, name);
		if (isFailure(diff)) return diff;
		ctx.stdout(
			diff.data === "" ? `${name} matches sdxc ${context.data.registry.release}\n` : diff.data,
		);
		return success();
	},
});
