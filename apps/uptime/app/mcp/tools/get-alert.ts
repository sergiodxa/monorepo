/**
 * Answers `get_alert`: reads one alert with sensitive channel config stripped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";

import { forAbility } from "~/app/mcp/ability";
import { serializeAlertSafe } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Reads one alert by id. */
export default createTool(toolset.getAlert, {
	...forAbility(abilities.alerts.read),
	handler: async (ctx) => {
		let alertId = ctx.input.alertId;
		let row = await ctx.models.alerts.inTeam(ctx.apiTeam.id).find(alertId);
		if (!row) throw new ToolError("Alert not found");
		return { alert: serializeAlertSafe(row) };
	},
});
