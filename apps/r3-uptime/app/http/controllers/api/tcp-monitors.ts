/**
 * API v1 collection endpoints for TCP monitors: `GET /api/v1/tcp-monitors` lists a
 * team's TCP monitors and `POST /api/v1/tcp-monitors` creates one. Requires
 * `tcp-monitors:read`/`tcp-monitors:write` via `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, Created } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import type { SelectTcpMonitor } from "~/database/schema";

import TcpMonitor from "~/app/data/tcp-monitor";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

/** Maps a TCP monitor row to the OLD APP's exact camelCase JSON shape. */
function serializeTcpMonitor(monitor: SelectTcpMonitor) {
	return {
		id: monitor.id,
		name: monitor.name,
		host: monitor.host,
		port: monitor.port,
		timeoutMs: monitor.timeout_ms,
		intervalSeconds: monitor.interval_seconds,
		isEnabled: monitor.is_enabled,
		lastCheckedAt: monitor.last_checked_at,
		lastStatus: monitor.last_status,
		lastResponseTimeMs: monitor.last_response_time_ms,
		createdAt: monitor.created_at,
		updatedAt: monitor.updated_at,
	};
}

const CreateTcpMonitorSchema = s.object({
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	host: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	port: s.number().pipe(checks.min(1), checks.max(65_535)),
	timeoutMs: s.defaulted(s.number().pipe(checks.min(100), checks.max(60_000)), 5000),
	intervalSeconds: s.defaulted(s.number().pipe(checks.min(10), checks.max(86_400)), 60),
	isEnabled: s.defaulted(s.boolean(), true),
});

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const tcpMonitorsRoutes = {
	tcpMonitorsIndex: routes.api.v1.tcpMonitors.index,
	tcpMonitorsCreate: routes.api.v1.tcpMonitors.create,
};

export default createController(tcpMonitorsRoutes, {
	actions: {
		/** GET /api/v1/tcp-monitors — lists the team's TCP monitors. */
		tcpMonitorsIndex: {
			middleware: [requireApiKey("tcp-monitors:read")],
			handler: async (ctx) => {
				let db = getServiceContainer().get(Database);
				let tcpMonitors = await TcpMonitor.listByTeam(db, ctx.apiTeam.id);
				return apiSuccess({ monitors: tcpMonitors.map(serializeTcpMonitor) });
			},
		},

		/** POST /api/v1/tcp-monitors — creates a TCP monitor for the team. */
		tcpMonitorsCreate: {
			middleware: [requireApiKey("tcp-monitors:write")],
			handler: async (ctx) => {
				let result = await validate(ctx.request, CreateTcpMonitorSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let db = getServiceContainer().get(Database);
				let monitor = await TcpMonitor.create(db, ctx.apiTeam.id, {
					name: result.data.name,
					host: result.data.host,
					port: result.data.port,
					timeout_ms: result.data.timeoutMs,
					interval_seconds: result.data.intervalSeconds,
					is_enabled: result.data.isEnabled,
				});

				return apiSuccess({ monitor: serializeTcpMonitor(monitor) }, Created);
			},
		},
	},
});
