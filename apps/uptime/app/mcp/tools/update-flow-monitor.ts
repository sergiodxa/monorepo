/**
 * Answers `update_flow_monitor`: updates a flow monitor (PUT-equivalent body).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";

import type { InsertFlowMonitor } from "~/database/schema";

import { forAbility } from "~/app/mcp/ability";
import { serializeFlowMonitor } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { inspectFlowSource } from "~/app/services/flow-check";

/** Updates a flow monitor; a changed source must stay on a verified domain. */
export default createTool(toolset.updateFlowMonitor, {
	...forAbility(abilities.flowMonitors.write),
	handler: async (ctx) => {
		let { flowMonitorId, ...fields } = ctx.input;
		let existing = await ctx.models.flowMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: flowMonitorId })
			.first();
		if (!existing) throw new ToolError("Flow monitor not found");

		if (fields.source !== undefined) {
			let verifiedDomains = await ctx.models.teamDomains.verifiedHostnames(ctx.apiTeam.id);
			let inspection = inspectFlowSource(fields.source, verifiedDomains);
			if (!inspection.ok) throw new ToolError(inspection.message);
		}

		let changes: Partial<InsertFlowMonitor> = {};
		if (fields.name !== undefined) changes.name = fields.name;
		if (fields.source !== undefined) changes.source = fields.source;
		if (fields.intervalSeconds !== undefined) changes.interval_seconds = fields.intervalSeconds;
		if (fields.isEnabled !== undefined) changes.is_enabled = fields.isEnabled;

		let monitor = unwrap(await ctx.models.flowMonitors.update(flowMonitorId, changes));
		return { flowMonitor: serializeFlowMonitor(monitor) };
	},
});
