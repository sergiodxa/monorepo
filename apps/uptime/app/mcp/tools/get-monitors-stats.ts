/**
 * Answers `get_monitors_stats`: aggregate stats across every HTTP monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Aggregate stats across every HTTP monitor on the team. */
export default createTool(toolset.getMonitorsStats, {
	...forAbility(abilities.monitors.read),
	handler: async (ctx) => {
		let stats = await ctx.models.monitors.statsForTeam(ctx.apiTeam.id);
		return { stats };
	},
});
