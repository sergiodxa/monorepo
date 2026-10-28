/**
 * Answers `delete_maintenance`: deletes a maintenance window.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Deletes one resource by id. */
export default createTool(toolset.deleteMaintenance, {
	...forAbility(abilities.maintenance.write),
	handler: async (ctx) => {
		let maintenanceId = ctx.input.maintenanceId;
		let existing = await ctx.models.maintenanceWindows.inTeam(ctx.apiTeam.id).find(maintenanceId);
		if (!existing) throw new ToolError("Maintenance window not found");
		unwrap(await ctx.models.maintenanceWindows.delete(maintenanceId));
		return { deleted: true };
	},
});
