/**
 * Answers `update_monitor`: updates an HTTP monitor's editable fields (PUT-equivalent body).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";
import { unwrap } from "@sdxc/result";

import type { InsertMonitor } from "~/database/schema";

import { forAbility } from "~/app/mcp/ability";
import { serializeMonitor } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Updates an HTTP monitor; only provided fields are written. */
export default createTool(toolset.updateMonitor, {
	...forAbility(abilities.monitors.write),
	handler: async (ctx) => {
		let { monitorId, ...fields } = ctx.input;
		let existing = await ctx.models.monitors.inTeam(ctx.apiTeam.id).find(monitorId);
		if (!existing) throw new ToolError("Monitor not found");

		let changes: Partial<InsertMonitor> = {};
		if (fields.name !== undefined) changes.name = fields.name;
		if (fields.url !== undefined) changes.url = fields.url;
		if (fields.method !== undefined) changes.method = fields.method;
		if (fields.expectedStatus !== undefined) changes.expected_status = fields.expectedStatus;
		if (fields.intervalSeconds !== undefined) changes.interval_seconds = fields.intervalSeconds;
		if (fields.degradedAfterMs !== undefined) changes.degraded_after_ms = fields.degradedAfterMs;
		if (fields.timeoutSeconds !== undefined) changes.timeout_seconds = fields.timeoutSeconds;
		if (fields.locationHint !== undefined) changes.location_hint = fields.locationHint;
		if (fields.enabled !== undefined) changes.enabled_at = fields.enabled ? Date.now() : null;
		if (fields.sslMonitoringEnabled !== undefined)
			changes.ssl_monitoring_enabled = fields.sslMonitoringEnabled;
		if (fields.sslExpiryWarningDays !== undefined)
			changes.ssl_expiry_warning_days = fields.sslExpiryWarningDays;

		let monitor = unwrap(await ctx.models.monitors.update(monitorId, changes));
		return { monitor: serializeMonitor(monitor) };
	},
});
