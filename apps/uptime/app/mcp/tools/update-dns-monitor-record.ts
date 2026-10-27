/**
 * Answers `update_dns_monitor_record`: enables or declines one tracked DNS record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";

import { forAbility } from "~/app/mcp/ability";
import { serializeDnsMonitorRecord } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Sets whether a deviation from one tracked DNS record alerts. */
export default createTool(toolset.updateDnsMonitorRecord, {
	...forAbility(abilities.dnsMonitors.write),
	handler: async (ctx) => {
		let monitor = await ctx.models.dnsMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: ctx.input.dnsMonitorId })
			.first();
		if (!monitor) throw new ToolError("DNS monitor not found");

		let existing = await ctx.models.dnsMonitorRecords
			.forMonitor(ctx.input.dnsMonitorId)
			.find(ctx.input.recordId);
		if (!existing) throw new ToolError("DNS record not found");

		await ctx.models.dnsMonitorRecords.setEnabled(
			ctx.input.dnsMonitorId,
			[ctx.input.recordId],
			ctx.input.isEnabled,
		);

		let record = await ctx.models.dnsMonitorRecords
			.forMonitor(ctx.input.dnsMonitorId)
			.find(ctx.input.recordId);
		if (!record) throw new ToolError("DNS record not found");
		return { record: serializeDnsMonitorRecord(record) };
	},
});
