/**
 * Answers `update_alert`: updates an alert's non-channel fields (PUT-equivalent body).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";

import type { InsertAlert } from "~/database/schema";

import { apiScopeFrom } from "~/app/http/controllers/api/alerts";
import { forAbility } from "~/app/mcp/ability";
import { serializeAlertStrategyOnly } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { isResolvableScope } from "~/app/services/scope-monitors";

/** Updates an alert; the channel strategy stays fixed at creation. */
export default createTool(toolset.updateAlert, {
	...forAbility(abilities.alerts.write),
	handler: async (ctx) => {
		let { alertId, ...fields } = ctx.input;
		let existing = await ctx.models.alerts.inTeam(ctx.apiTeam.id).find(alertId);
		if (!existing) throw new ToolError("Alert not found");

		let changes: Partial<InsertAlert> = {};
		if (fields.name !== undefined) changes.name = fields.name;
		if (fields.notifyOnRecovery !== undefined) changes.notify_on_recovery = fields.notifyOnRecovery;
		if (fields.cooldownMinutes !== undefined) changes.cooldown_minutes = fields.cooldownMinutes;

		if (fields.monitorType !== undefined || fields.monitorId !== undefined) {
			let scope = apiScopeFrom(fields);
			if (scope === null || !(await isResolvableScope(ctx.models, ctx.apiTeam.id, scope))) {
				throw new ToolError("Monitor not found");
			}
			changes.monitor_type = scope.monitorType;
			changes.monitor_id = scope.monitorId;
		}

		let alert = unwrap(await ctx.models.alerts.update(alertId, changes));
		return { alert: serializeAlertStrategyOnly(alert) };
	},
});
