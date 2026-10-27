/**
 * Answers `delete_monitor_content_check`: deletes one content check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Deletes one content check from an HTTP monitor. */
export default createTool(toolset.deleteMonitorContentCheck, {
	...forAbility(abilities.monitors.write),
	handler: async (ctx) => {
		let monitor = await ctx.models.monitors.inTeam(ctx.apiTeam.id).find(ctx.input.monitorId);
		if (!monitor) throw new ToolError("Monitor not found");

		let contentCheck = await ctx.models.contentChecks
			.ofMonitor(ctx.input.monitorId)
			.find(ctx.input.contentCheckId);
		if (!contentCheck) throw new ToolError("Content check not found");

		unwrap(await ctx.models.contentChecks.delete(contentCheck.id));
		return { success: true };
	},
});
