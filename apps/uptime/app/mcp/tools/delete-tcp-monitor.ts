/**
 * Answers `delete_tcp_monitor`: deletes a TCP monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Deletes one resource by id. */
export default createTool(toolset.deleteTcpMonitor, {
	...forAbility(abilities.tcpMonitors.delete),
	handler: async (ctx) => {
		let tcpMonitorId = ctx.input.tcpMonitorId;
		let existing = await ctx.models.tcpMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: tcpMonitorId })
			.first();
		if (!existing) throw new ToolError("TCP monitor not found");
		unwrap(await ctx.models.tcpMonitors.delete(tcpMonitorId));
		return { deleted: true };
	},
});
