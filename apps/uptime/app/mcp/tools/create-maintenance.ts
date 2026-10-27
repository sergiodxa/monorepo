/**
 * Answers `create_maintenance`: creates a maintenance window for a monitor scope the team
 * owns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";
import { unwrap } from "@sdxc/result";

import { apiScopeFrom } from "~/app/http/controllers/api/maintenance";
import { forAbility } from "~/app/mcp/ability";
import { serializeMaintenanceWindow } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { isResolvableScope } from "~/app/services/scope-monitors";

/** Creates a maintenance window for a resolvable monitor scope. */
export default createTool(toolset.createMaintenance, {
	...forAbility(abilities.maintenance.write),
	handler: async (ctx) => {
		let scope = apiScopeFrom(ctx.input);
		if (scope === null || !(await isResolvableScope(ctx.models, ctx.apiTeam.id, scope))) {
			throw new ToolError("Monitor not found");
		}

		let window = await ctx.models.maintenanceWindows.create({
			team_id: ctx.apiTeam.id,
			monitor_type: scope.monitorType,
			monitor_id: scope.monitorId,
			name: ctx.input.name,
			starts_at: ctx.input.startsAt,
			ends_at: ctx.input.endsAt,
			suppress_alerts: ctx.input.suppressAlerts,
			show_on_status_page: ctx.input.showOnStatusPage,
		});

		return { maintenanceWindow: serializeMaintenanceWindow(unwrap(window)) };
	},
});
