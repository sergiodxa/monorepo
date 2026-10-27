/**
 * Answers `delete_monitor`: deletes an HTTP monitor.
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
export default createTool(toolset.deleteMonitor, {
	...forAbility(abilities.monitors.delete),
	handler: async (ctx) => {
		let monitorId = ctx.input.monitorId;
		let existing = await ctx.models.monitors.inTeam(ctx.apiTeam.id).find(monitorId);
		if (!existing) throw new ToolError("Monitor not found");
		unwrap(await ctx.models.monitors.delete(monitorId));
		return { deleted: true };
	},
});
