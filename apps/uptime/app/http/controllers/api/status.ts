/**
 * API v1 endpoint reporting the authenticated team's overall status: fetches each
 * enabled HTTP monitor's latest result, derives an up/down/unknown state per
 * monitor, and rolls that up into one of operational/degraded/partial_outage/
 * major_outage/unknown. Requires `monitors:read` via `requireApiKey`; `/healthcheck`
 * separately reports the worker's own runtime health.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import type { UptimeModels } from "~/app/models";
import type { Monitor } from "~/app/models/monitors";

import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiSuccess } from "~/app/services/api-response";
import { encodeId } from "~/app/services/typed-id";
import routes from "~/routes/web";

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

/** GET /api/v1/status — the team's overall status across every HTTP monitor. */
export const statusShow = createAction(routes.api.v1.status, {
	middleware: [requireApiKey("monitors:read")],
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
		/** Reserved for a future degraded signal surfaced by monitor results. */
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

		return apiSuccess({
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
		});
	},
});
