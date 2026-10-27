/**
 * Answers `create_monitor`: creates an HTTP monitor for the team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import { serializeMonitor } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Creates an HTTP monitor for the calling key's team. */
export default createTool(toolset.createMonitor, {
	...forAbility(abilities.monitors.write),
	handler: async (ctx) => {
		let created = await ctx.models.monitors.create({
			team_id: ctx.apiTeam.id,
			author_id: ctx.apiTeam.owner_id,
			name: ctx.input.name,
			url: ctx.input.url,
			method: ctx.input.method,
			expected_status: ctx.input.expectedStatus,
			interval_seconds: ctx.input.intervalSeconds,
			degraded_after_ms: ctx.input.degradedAfterMs,
			timeout_seconds: ctx.input.timeoutSeconds,
			location_hint: ctx.input.locationHint,
			ssl_monitoring_enabled: ctx.input.sslMonitoringEnabled,
			ssl_expiry_warning_days: ctx.input.sslExpiryWarningDays,
		});
		return { monitor: serializeMonitor(unwrap(created)) };
	},
});
