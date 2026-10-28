/**
 * Answers `update_maintenance`: updates a maintenance window (PUT-equivalent body).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";

import type { InsertMaintenanceWindow } from "~/database/schema";

import { apiScopeFrom } from "~/app/http/controllers/api/maintenance";
import { forAbility } from "~/app/mcp/ability";
import { serializeMaintenanceWindow } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { isResolvableScope } from "~/app/services/scope-monitors";

/** Updates a maintenance window; endsAt must still follow startsAt. */
export default createTool(toolset.updateMaintenance, {
	...forAbility(abilities.maintenance.write),
	handler: async (ctx) => {
		let { maintenanceId, ...fields } = ctx.input;
		let existing = await ctx.models.maintenanceWindows.inTeam(ctx.apiTeam.id).find(maintenanceId);
		if (!existing) throw new ToolError("Maintenance window not found");

		let newStartsAt = fields.startsAt ?? existing.starts_at;
		let newEndsAt = fields.endsAt ?? existing.ends_at;
		if (newEndsAt <= newStartsAt) throw new ToolError("endsAt must be after startsAt");

		let changes: Partial<InsertMaintenanceWindow> = {};
		if (fields.name !== undefined) changes.name = fields.name;

		if (fields.monitorType !== undefined || fields.monitorId !== undefined) {
			let scope = apiScopeFrom(fields);
			if (scope === null || !(await isResolvableScope(ctx.models, ctx.apiTeam.id, scope))) {
				throw new ToolError("Monitor not found");
			}
			changes.monitor_type = scope.monitorType;
			changes.monitor_id = scope.monitorId;
		}

		if (fields.startsAt !== undefined) changes.starts_at = fields.startsAt;
		if (fields.endsAt !== undefined) changes.ends_at = fields.endsAt;
		if (fields.suppressAlerts !== undefined) changes.suppress_alerts = fields.suppressAlerts;
		if (fields.showOnStatusPage !== undefined)
			changes.show_on_status_page = fields.showOnStatusPage;

		let window = unwrap(await ctx.models.maintenanceWindows.update(maintenanceId, changes));
		return { maintenanceWindow: serializeMaintenanceWindow(window) };
	},
});
