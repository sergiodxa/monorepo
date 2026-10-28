/**
 * Answers `get_dns_monitor`: reads one DNS monitor by id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";

import { forAbility } from "~/app/mcp/ability";
import { serializeDnsMonitor } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Reads one dnsMonitor by id. */
export default createTool(toolset.getDnsMonitor, {
	...forAbility(abilities.dnsMonitors.read),
	handler: async (ctx) => {
		let dnsMonitorId = ctx.input.dnsMonitorId;
		let row = await ctx.models.dnsMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: dnsMonitorId })
			.first();
		if (!row) throw new ToolError("DNS monitor not found");
		return { dnsMonitor: serializeDnsMonitor(row) };
	},
});
