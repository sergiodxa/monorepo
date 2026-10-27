/**
 * Answers `delete_dns_monitor`: deletes a DNS monitor.
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
export default createTool(toolset.deleteDnsMonitor, {
	...forAbility(abilities.dnsMonitors.delete),
	handler: async (ctx) => {
		let dnsMonitorId = ctx.input.dnsMonitorId;
		let existing = await ctx.models.dnsMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: dnsMonitorId })
			.first();
		if (!existing) throw new ToolError("DNS monitor not found");
		unwrap(await ctx.models.dnsMonitors.delete(dnsMonitorId));
		return { deleted: true };
	},
});
