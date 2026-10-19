/**
 * The `sdxc stats` handler: prints the lines of code per kind of code the app layout names and
 * the code to test ratio, as a table, or as JSON for an agent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";

import { SDXC_COMMANDS } from "../contract.js";
import { project } from "../middleware.js";
import { formatStats, projectStats } from "../stats.js";

/** Counts the project's code and prints the table. */
export default createCommand(SDXC_COMMANDS.stats, {
	middleware: [project()],
	/** Always succeeds once the project is found; an empty project prints a table of totals. */
	async handler(ctx) {
		let stats = await projectStats(ctx.project.root);
		ctx.stdout(ctx.flags.json ? `${JSON.stringify(stats, null, 2)}\n` : formatStats(stats));
		return success();
	},
});
