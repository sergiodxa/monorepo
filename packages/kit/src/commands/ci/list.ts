/**
 * The `sdxc ci list` handler: lists the steps the project's CI script reaches when every step
 * passes, or one matrix's entry keys for a CI host's job matrix, without running anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { listAction } from "@sdxc/ci/command-line";
import { createCommand, exit } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { locateCI } from "../../ci/locate.js";
import { SDXC_COMMANDS } from "../../contract.js";

export default createCommand(SDXC_COMMANDS.ci.list, {
	middleware: [],
	/** Lists from the script's project, scoped like `sdxc ci` to the workspace it starts in. */
	async handler(ctx) {
		let located = await locateCI(ctx.cwd);
		if (isFailure(located)) return exit(2, located.error.message);
		let workspace = located.data.workspace;
		let scope = ctx.flags.scope.length > 0 || workspace === null ? ctx.flags.scope : [workspace];
		return listAction(ctx, located.data.script, { ...ctx.flags, scope }, located.data.root);
	},
});
