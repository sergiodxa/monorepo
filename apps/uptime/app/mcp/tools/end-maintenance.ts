/**
 * Answers `end_maintenance`: ends a maintenance window early.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import { serializeMaintenanceWindow } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Ends a maintenance window early. */
export default createTool(toolset.endMaintenance, {
	...forAbility(abilities.maintenance.write),
	handler: async (ctx) => {
		let existing = await ctx.models.maintenanceWindows
			.inTeam(ctx.apiTeam.id)
			.find(ctx.input.maintenanceId);
		if (!existing) throw new ToolError("Maintenance window not found");
		let window = unwrap(await ctx.models.maintenanceWindows.endEarly(ctx.input.maintenanceId));
		return { maintenanceWindow: serializeMaintenanceWindow(window) };
	},
});
