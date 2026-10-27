/**
 * Answers `get_monitor`: reads one HTTP monitor by id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";

import { forAbility } from "~/app/mcp/ability";
import { serializeMonitor } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Reads one monitor by id. */
export default createTool(toolset.getMonitor, {
	...forAbility(abilities.monitors.read),
	handler: async (ctx) => {
		let monitorId = ctx.input.monitorId;
		let row = await ctx.models.monitors.inTeam(ctx.apiTeam.id).find(monitorId);
		if (!row) throw new ToolError("Monitor not found");
		return { monitor: serializeMonitor(row) };
	},
});
