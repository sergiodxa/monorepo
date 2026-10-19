/**
 * The `sdxc schedule` handler: prints every scheduled job with its next run and the trigger
 * that fires it, as a table, or as JSON for an agent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";

import { SDXC_COMMANDS } from "../contract.js";
import { project } from "../middleware.js";
import { formatSchedule, listSchedule } from "../schedule.js";

/** Reads the job declarations and the trigger files and prints the schedule. */
export default createCommand(SDXC_COMMANDS.schedule, {
	middleware: [project()],
	/** Always succeeds once the project is found; a job no trigger fires is a row that says so. */
	async handler(ctx) {
		let listing = await listSchedule(ctx.project.root);
		ctx.stdout(ctx.flags.json ? `${JSON.stringify(listing, null, 2)}\n` : formatSchedule(listing));
		return success();
	},
});
