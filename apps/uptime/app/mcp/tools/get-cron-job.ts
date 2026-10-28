/**
 * Answers `get_cron_job`: reads one cron-job monitor by id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";

import { forAbility } from "~/app/mcp/ability";
import { serializeCronJob } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Reads one cronJob by id. */
export default createTool(toolset.getCronJob, {
	...forAbility(abilities.cronJobs.read),
	handler: async (ctx) => {
		let cronJobId = ctx.input.cronJobId;
		let row = await ctx.models.cronJobMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: cronJobId })
			.first();
		if (!row) throw new ToolError("Cron job not found");
		return { cronJob: serializeCronJob(row) };
	},
});
