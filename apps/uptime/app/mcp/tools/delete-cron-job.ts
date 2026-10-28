/**
 * Answers `delete_cron_job`: deletes a cron-job monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Deletes one resource by id. */
export default createTool(toolset.deleteCronJob, {
	...forAbility(abilities.cronJobs.delete),
	handler: async (ctx) => {
		let cronJobId = ctx.input.cronJobId;
		let existing = await ctx.models.cronJobMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: cronJobId })
			.first();
		if (!existing) throw new ToolError("Cron job not found");
		unwrap(await ctx.models.cronJobMonitors.delete(cronJobId));
		return { deleted: true };
	},
});
