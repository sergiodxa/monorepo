/**
 * API v1 endpoint reporting the authenticated team's overall status: fetches each
 * enabled HTTP monitor's latest result, derives an up/down/unknown state per
 * monitor, and rolls that up into one of operational/degraded/partial_outage/
 * major_outage/unknown. Requires `monitors:read` via `requireApiKey`. Distinct from
 * `/healthcheck`, which reports the worker's own health, not a team's monitors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { SelectMonitor } from "~/database/schema";

import Monitor from "~/app/data/monitor";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiSuccess } from "~/app/services/api-response";
import { monitorResults } from "~/database/schema";
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
async function statusFor(db: Database, monitor: SelectMonitor): Promise<MonitorStatusEntry> {
	let [latest] = await db.findMany(monitorResults, {
		where: { monitor_id: monitor.id },
		orderBy: ["completed_at", "desc"],
		limit: 1,
	});

	let status: MonitorStatus = "unknown";
	if (latest?.response_status !== null && latest?.response_status !== undefined) {
		status = latest.response_status === monitor.expected_status ? "up" : "down";
	}

	return {
		id: monitor.id,
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
		let db = getServiceContainer().get(Database);
		let monitors = await Monitor.listByTeam(db, ctx.apiTeam.id);
		let monitorStatuses = await Promise.all(monitors.map((monitor) => statusFor(db, monitor)));

		let enabledMonitors = monitorStatuses.filter((monitor) => monitor.enabled);
		let downMonitors = enabledMonitors.filter((monitor) => monitor.status === "down");
		/** Degraded status is not currently tracked per monitor result; reserved for future use. */
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
					total: monitors.length,
					up: monitorStatuses.filter((monitor) => monitor.status === "up").length,
					down: downMonitors.length,
					degraded: degradedMonitors.length,
					unknown: monitorStatuses.filter((monitor) => monitor.status === "unknown").length,
				},
			},
		});
	},
});
