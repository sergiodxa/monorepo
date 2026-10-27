/**
 * Answers `get_tcp_monitor`: reads one TCP monitor by id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";

import { forAbility } from "~/app/mcp/ability";
import { serializeTcpMonitor } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Reads one monitor by id. */
export default createTool(toolset.getTcpMonitor, {
	...forAbility(abilities.tcpMonitors.read),
	handler: async (ctx) => {
		let tcpMonitorId = ctx.input.tcpMonitorId;
		let row = await ctx.models.tcpMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: tcpMonitorId })
			.first();
		if (!row) throw new ToolError("TCP monitor not found");
		return { monitor: serializeTcpMonitor(row) };
	},
});
