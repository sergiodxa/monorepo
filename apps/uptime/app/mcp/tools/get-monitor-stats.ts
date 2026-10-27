/**
 * Answers `get_monitor_stats`: aggregate stats for one HTTP monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Aggregate stats for one HTTP monitor. */
export default createTool(toolset.getMonitorStats, {
	...forAbility(abilities.monitors.read),
	handler: async (ctx) => {
		let monitor = await ctx.models.monitors.inTeam(ctx.apiTeam.id).find(ctx.input.monitorId);
		if (!monitor) throw new ToolError("Monitor not found");
		let stats = await ctx.models.monitors.statsForMonitor(ctx.input.monitorId);
		return { stats };
	},
});
