/**
 * API v1 collection endpoints for HTTP monitors: `GET /api/v1/monitors` lists a
 * team's monitors, `POST /api/v1/monitors` creates one, and `GET /api/v1/monitors/stats`
 * returns aggregate stats across every monitor on the team. Requires `monitors:read`
 * (list, stats) or `monitors:write` (create) via `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Created } from "@sdxc/http/status-code";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { SelectMonitor } from "~/database/schema";

import Monitor from "~/app/data/monitor";
import idempotent from "~/app/http/middleware/idempotency";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { CREATE_MONITOR_BODY } from "~/app/http/openapi/monitors";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { apiPage, NEWEST_FIRST, PAGING } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";
import { monitorsRoutes } from "~/routes/api-groups";

/** Maps a monitor row to its public camelCase JSON shape. */
function serializeMonitor(monitor: SelectMonitor) {
	return {
		id: encodeId("mon", monitor.id),
		name: monitor.name,
		url: monitor.url,
		method: monitor.method,
		expectedStatus: monitor.expected_status,
		intervalSeconds: monitor.interval_seconds,
		degradedAfterMs: monitor.degraded_after_ms,
		timeoutSeconds: monitor.timeout_seconds,
		locationHint: monitor.location_hint,
		enabledAt: monitor.enabled_at,
		sslMonitoringEnabled: monitor.ssl_monitoring_enabled,
		sslExpiryWarningDays: monitor.ssl_expiry_warning_days,
		sslExpiresAt: monitor.ssl_expires_at,
		sslIssuer: monitor.ssl_issuer,
		sslStatus: monitor.ssl_status,
		sslLastCheckedAt: monitor.ssl_last_checked_at,
		createdAt: monitor.created_at,
		updatedAt: monitor.updated_at,
	};
}

export default createController(monitorsRoutes, {
	actions: {
		/** GET /api/v1/monitors — lists the team's HTTP monitors. */
		monitorsIndex: {
			middleware: [requireApiKey("monitors:read")],
			handler: async (ctx) => {
				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				// Chaining returns new queries, so the same one both counts and pages.
				let query = Monitor.listByTeamQuery(ctx.db, ctx.apiTeam.id);

				let page = await Pagination.byKeyset(query, {
					orderBy: NEWEST_FIRST,
					cursor: params.data.cursor,
					limit: params.data.perPage,
				});

				if (isFailure(page)) {
					if (page.error instanceof InvalidCursorError) {
						return apiProblems.badRequest({
							detail: page.error.message,
							instance: problemInstance(),
						});
					}
					return apiProblems.internal({ detail: page.error.message, instance: problemInstance() });
				}

				return apiPage({ monitors: page.data.items.map(serializeMonitor) }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
					total: await query.count(),
				});
			},
		},

		/** POST /api/v1/monitors — creates an HTTP monitor for the team. */
		monitorsCreate: {
			middleware: [requireApiKey("monitors:write"), idempotent],
			handler: async (ctx) => {
				let result = await validate(ctx.request, CREATE_MONITOR_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let monitor = await Monitor.create(ctx.db, ctx.apiTeam.id, ctx.apiTeam.owner_id, {
					name: result.data.name,
					url: result.data.url,
					method: result.data.method,
					expected_status: result.data.expectedStatus,
					interval_seconds: result.data.intervalSeconds,
					degraded_after_ms: result.data.degradedAfterMs,
					timeout_seconds: result.data.timeoutSeconds,
					location_hint: result.data.locationHint,
					ssl_monitoring_enabled: result.data.sslMonitoringEnabled,
					ssl_expiry_warning_days: result.data.sslExpiryWarningDays,
				});

				return apiSuccess({ monitor: serializeMonitor(monitor) }, Created);
			},
		},

		/** GET /api/v1/monitors/stats — aggregate stats across every monitor on the team. */
		monitorsStats: {
			middleware: [requireApiKey("monitors:read")],
			handler: async (ctx) => {
				let stats = await Monitor.getStatsByTeamId(ctx.db, ctx.apiTeam.id);
				return apiSuccess({ stats });
			},
		},
	},
});
