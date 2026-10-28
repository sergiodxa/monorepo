/**
 * Answers `get_status`: overall operational status across the team's enabled HTTP monitors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool } from "@sdxc/mcp/server";

import type { UptimeModels } from "~/app/models";
import type { Monitor } from "~/app/models/monitors";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { encodeId } from "~/app/services/typed-id";

type MonitorStatus = "up" | "down" | "degraded" | "unknown";

interface MonitorStatusEntry {
	id: string;
	name: string;
	status: MonitorStatus;
	enabled: boolean;
	lastCheck: number | null;
	responseTimeMs: number | null;
}

/** Derives one monitor's up/down/unknown state from its latest completed result. */
async function statusFor(models: UptimeModels, monitor: Monitor): Promise<MonitorStatusEntry> {
	let latest = await models.monitorResults
		.ofMonitor(monitor.id)
		.orderBy("completed_at", "desc")
		.first();

	let status: MonitorStatus = "unknown";
	if (latest?.response_status !== null && latest?.response_status !== undefined) {
		status = latest.response_status === monitor.expected_status ? "up" : "down";
	}

	return {
		id: encodeId("mon", monitor.id),
		name: monitor.name,
		status,
		enabled: monitor.enabled_at !== null,
		lastCheck: latest?.completed_at ?? null,
		responseTimeMs: latest?.response_time_ms ?? null,
	};
}

/** Reports the team's overall status across every HTTP monitor. */
export default createTool(toolset.getStatus, {
	...forAbility(abilities.monitors.read),
	handler: async (ctx) => {
		let monitors = await ctx.models.monitors
			.inTeam(ctx.apiTeam.id)
			.orderBy("created_at", "desc")
			.all();
		let monitorStatuses = await Promise.all(
			monitors.map((monitor) => statusFor(ctx.models, monitor)),
		);

		let enabledMonitors = monitorStatuses.filter((monitor) => monitor.enabled);
		let downMonitors = enabledMonitors.filter((monitor) => monitor.status === "down");
		let degradedMonitors: MonitorStatusEntry[] = [];

		let overallStatus: "operational" | "degraded" | "partial_outage" | "major_outage" | "unknown";
		if (enabledMonitors.length === 0) {
			overallStatus = "unknown";
		} else if (downMonitors.length === enabledMonitors.length) {
			overallStatus = "major_outage";
		} else if (downMonitors.length > 0) {
			overallStatus = "partial_outage";
		} else if (degradedMonitors.length > 0) {
			overallStatus = "degraded";
		} else {
			overallStatus = "operational";
		}

		return {
			status: {
				overall: overallStatus,
				monitors: monitorStatuses,
				summary: {
					total: enabledMonitors.length,
					up: enabledMonitors.filter((monitor) => monitor.status === "up").length,
					down: downMonitors.length,
					degraded: degradedMonitors.length,
					unknown: enabledMonitors.filter((monitor) => monitor.status === "unknown").length,
				},
			},
		};
	},
});
