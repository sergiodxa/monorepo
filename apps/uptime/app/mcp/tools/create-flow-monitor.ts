/**
 * Answers `create_flow_monitor`: creates a browser-flow monitor on a verified domain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import { serializeFlowMonitor } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { inspectFlowSource } from "~/app/services/flow-check";

/** Creates a flow monitor whose source is on a verified team domain. */
export default createTool(toolset.createFlowMonitor, {
	...forAbility(abilities.flowMonitors.write),
	handler: async (ctx) => {
		let verifiedDomains = await ctx.models.teamDomains.verifiedHostnames(ctx.apiTeam.id);
		let inspection = inspectFlowSource(ctx.input.source, verifiedDomains);
		if (!inspection.ok) throw new ToolError(inspection.message);

		let monitor = unwrap(
			await ctx.models.flowMonitors.create({
				team_id: ctx.apiTeam.id,
				name: ctx.input.name,
				source: ctx.input.source,
				interval_seconds: ctx.input.intervalSeconds,
				is_enabled: ctx.input.isEnabled,
			}),
		);
		return { flowMonitor: serializeFlowMonitor(monitor) };
	},
});
