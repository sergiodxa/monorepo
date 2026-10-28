/**
 * Answers `get_maintenance`: reads one maintenance window by id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";

import { forAbility } from "~/app/mcp/ability";
import { serializeMaintenanceWindow } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Reads one maintenanceWindow by id. */
export default createTool(toolset.getMaintenance, {
	...forAbility(abilities.maintenance.read),
	handler: async (ctx) => {
		let maintenanceId = ctx.input.maintenanceId;
		let row = await ctx.models.maintenanceWindows.inTeam(ctx.apiTeam.id).find(maintenanceId);
		if (!row) throw new ToolError("Maintenance window not found");
		return { maintenanceWindow: serializeMaintenanceWindow(row) };
	},
});
