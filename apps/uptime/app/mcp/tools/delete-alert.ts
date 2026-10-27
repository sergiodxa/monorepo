/**
 * Answers `delete_alert`: deletes an alert.
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
export default createTool(toolset.deleteAlert, {
	...forAbility(abilities.alerts.write),
	handler: async (ctx) => {
		let alertId = ctx.input.alertId;
		let existing = await ctx.models.alerts.inTeam(ctx.apiTeam.id).find(alertId);
		if (!existing) throw new ToolError("Alert not found");
		unwrap(await ctx.models.alerts.delete(alertId));
		return { deleted: true };
	},
});
