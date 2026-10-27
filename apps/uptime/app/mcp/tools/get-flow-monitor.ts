/**
 * Answers `get_flow_monitor`: reads one flow monitor by id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";

import { forAbility } from "~/app/mcp/ability";
import { serializeFlowMonitor } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Reads one flowMonitor by id. */
export default createTool(toolset.getFlowMonitor, {
	...forAbility(abilities.flowMonitors.read),
	handler: async (ctx) => {
		let flowMonitorId = ctx.input.flowMonitorId;
		let row = await ctx.models.flowMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: flowMonitorId })
			.first();
		if (!row) throw new ToolError("Flow monitor not found");
		return { flowMonitor: serializeFlowMonitor(row) };
	},
});
