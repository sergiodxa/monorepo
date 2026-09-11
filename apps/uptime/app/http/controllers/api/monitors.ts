/**
 * API v1 collection endpoints for HTTP monitors: `GET /api/v1/monitors` lists a
 * team's monitors, `POST /api/v1/monitors` creates one, and `GET /api/v1/monitors/stats`
 * returns aggregate stats across every monitor on the team. Requires `monitors:read`
 * (list, stats) or `monitors:write` (create) via `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, Created, InternalServerError } from "@sdxc/http/status-code";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { createController } from "remix/router";

import type { SelectMonitor } from "~/database/schema";

import Monitor from "~/app/data/monitor";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import { apiPage, NEWEST_FIRST, PAGING } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";
import routes from "~/routes/web";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;
const LOCATION_HINTS = ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"] as const;

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

const CreateMonitorSchema = s.object({
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	url: s.string().pipe(checks.url()),
	method: s.defaulted(s.enum_(HTTP_METHODS), "HEAD"),
	expectedStatus: s.defaulted(s.number().pipe(checks.min(100), checks.max(599)), 200),
	intervalSeconds: s.defaulted(s.number().pipe(checks.min(60), checks.max(3600)), 60),
	degradedAfterMs: s.defaulted(s.number().pipe(checks.min(1000), checks.max(30_000)), 5000),
	timeoutSeconds: s.defaulted(s.number().pipe(checks.min(1), checks.max(60)), 10),
	locationHint: s.defaulted(s.enum_(LOCATION_HINTS), "wnam"),
	sslMonitoringEnabled: s.defaulted(s.boolean(), false),
	sslExpiryWarningDays: s.defaulted(s.number().pipe(checks.min(1), checks.max(365)), 30),
});

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const monitorsRoutes = {
	monitorsIndex: routes.api.v1.monitors.index,
	monitorsCreate: routes.api.v1.monitors.create,
	monitorsStats: routes.api.v1.monitors.stats,
};

export default createController(monitorsRoutes, {
	actions: {
		/** GET /api/v1/monitors — lists the team's HTTP monitors. */
		monitorsIndex: {
			middleware: [requireApiKey("monitors:read")],
			handler: async (ctx) => {
				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params)) return apiError("BAD_REQUEST", params.error.message, BadRequest);

				// Chaining returns new queries, so the same one both counts and pages.
				let query = Monitor.listByTeamQuery(ctx.db, ctx.apiTeam.id);

				let page = await Pagination.byKeyset(query, {
					orderBy: NEWEST_FIRST,
					cursor: params.data.cursor,
					limit: params.data.perPage,
				});

				if (isFailure(page)) {
					if (page.error instanceof InvalidCursorError) {
						return apiError("BAD_REQUEST", page.error.message, BadRequest);
					}
					return apiError("INTERNAL", page.error.message, InternalServerError);
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
			middleware: [requireApiKey("monitors:write")],
			handler: async (ctx) => {
				let result = await validate(ctx.request, CreateMonitorSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
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
