/**
 * Answers `update_status_page_monitors`: replaces the HTTP monitors and cron jobs attached
 * to a status page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";

import { forAbility } from "~/app/mcp/ability";
import { serializeStatusPage } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { encodeId } from "~/app/services/typed-id";

/** Replaces a status page's monitor and cron-job attachments. */
export default createTool(toolset.updateStatusPageMonitors, {
	...forAbility(abilities.statusPages.write),
	handler: async (ctx) => {
		let statusPage = await ctx.models.statusPages
			.inTeam(ctx.apiTeam.id)
			.find(ctx.input.statusPageId);
		if (!statusPage) throw new ToolError("Status page not found");

		let monitorIds = [...new Set(ctx.input.monitorIds)];
		let cronJobIds = [...new Set(ctx.input.cronJobIds)];

		if (monitorIds.length > 0) {
			let found = await ctx.models.monitors.findManyInTeam(ctx.apiTeam.id, monitorIds);
			if (found.length !== monitorIds.length) {
				throw new ToolError("One or more monitors not found");
			}
		}

		if (cronJobIds.length > 0) {
			let found = await ctx.models.cronJobMonitors.inTeamWithIds(ctx.apiTeam.id, cronJobIds);
			if (found.length !== cronJobIds.length) {
				throw new ToolError("One or more cron jobs not found");
			}
		}

		await ctx.models.statusPages.setMonitors(ctx.input.statusPageId, monitorIds);
		await ctx.models.statusPages.setCronJobs(ctx.input.statusPageId, cronJobIds);

		return {
			statusPage: serializeStatusPage(statusPage),
			monitors: monitorIds.map((id) => encodeId("mon", id)),
			cronJobs: cronJobIds.map((id) => encodeId("cron", id)),
		};
	},
});
