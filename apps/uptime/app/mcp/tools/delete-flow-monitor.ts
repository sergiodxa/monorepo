/**
 * Answers `delete_flow_monitor`: deletes a flow monitor.
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
export default createTool(toolset.deleteFlowMonitor, {
	...forAbility(abilities.flowMonitors.delete),
	handler: async (ctx) => {
		let flowMonitorId = ctx.input.flowMonitorId;
		let existing = await ctx.models.flowMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: flowMonitorId })
			.first();
		if (!existing) throw new ToolError("Flow monitor not found");
		unwrap(await ctx.models.flowMonitors.delete(flowMonitorId));
		return { deleted: true };
	},
});
