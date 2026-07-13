/**
 * API v1 item endpoints for a single HTTP monitor: get/update/delete
 * (`monitors:read`/`monitors:write`), aggregate stats, check-result history, and
 * alert-delivery history (`monitors:read`/`alerts:read`) for one monitor scoped to
 * the caller's team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, NotFound } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import type { InsertMonitor, SelectMonitor } from "~/database/schema";

import AlertEvent from "~/app/data/alert-event";
import Monitor from "~/app/data/monitor";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess, parsePaginationQuery } from "~/app/services/api-response";
import routes from "~/routes/web";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;
const LOCATION_HINTS = ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"] as const;

const MonitorIdParams = s.object({ monitorId: s.string() });

/** Maps a monitor row to the OLD APP's exact camelCase JSON shape. */
function serializeMonitor(monitor: SelectMonitor) {
	return {
		id: monitor.id,
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

const UpdateMonitorSchema = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	url: s.optional(s.string().pipe(checks.url())),
	method: s.optional(s.enum_(HTTP_METHODS)),
	expectedStatus: s.optional(s.number().pipe(checks.min(100), checks.max(599))),
	intervalSeconds: s.optional(s.number().pipe(checks.min(60), checks.max(3600))),
	degradedAfterMs: s.optional(s.number().pipe(checks.min(1000), checks.max(30_000))),
	timeoutSeconds: s.optional(s.number().pipe(checks.min(1), checks.max(60))),
	locationHint: s.optional(s.enum_(LOCATION_HINTS)),
	enabled: s.optional(s.boolean()),
	sslMonitoringEnabled: s.optional(s.boolean()),
	sslExpiryWarningDays: s.optional(s.number().pipe(checks.min(1), checks.max(365))),
});

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const monitorRoutes = {
	monitorShow: routes.api.v1.monitors.show,
	monitorUpdate: routes.api.v1.monitors.update,
	monitorDestroy: routes.api.v1.monitors.destroy,
	monitorStats: routes.api.v1.monitors.itemStats,
	monitorResults: routes.api.v1.monitors.results,
	monitorAlertEvents: routes.api.v1.monitors.alertEvents,
};

export default createController(monitorRoutes, {
	actions: {
		/** GET /api/v1/monitors/:monitorId — a single HTTP monitor. */
		monitorShow: {
			middleware: [requireApiKey("monitors:read")],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let monitor = await Monitor.findByIdForTeam(db, ctx.apiTeam.id, monitorId);
				if (!monitor) return apiError("NOT_FOUND", "Monitor not found", NotFound);
				return apiSuccess({ monitor: serializeMonitor(monitor) });
			},
		},

		/** PUT /api/v1/monitors/:monitorId — updates an HTTP monitor's editable fields. */
		monitorUpdate: {
			middleware: [requireApiKey("monitors:write")],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let existing = await Monitor.findByIdForTeam(db, ctx.apiTeam.id, monitorId);
				if (!existing) return apiError("NOT_FOUND", "Monitor not found", NotFound);

				let result = await validate(ctx.request, UpdateMonitorSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let changes: Partial<InsertMonitor> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;
				if (result.data.url !== undefined) changes.url = result.data.url;
				if (result.data.method !== undefined) changes.method = result.data.method;
				if (result.data.expectedStatus !== undefined)
					changes.expected_status = result.data.expectedStatus;
				if (result.data.intervalSeconds !== undefined)
					changes.interval_seconds = result.data.intervalSeconds;
				if (result.data.degradedAfterMs !== undefined)
					changes.degraded_after_ms = result.data.degradedAfterMs;
				if (result.data.timeoutSeconds !== undefined)
					changes.timeout_seconds = result.data.timeoutSeconds;
				if (result.data.locationHint !== undefined)
					changes.location_hint = result.data.locationHint;
				if (result.data.enabled !== undefined)
					changes.enabled_at = result.data.enabled ? Date.now() : null;
				if (result.data.sslMonitoringEnabled !== undefined)
					changes.ssl_monitoring_enabled = result.data.sslMonitoringEnabled;
				if (result.data.sslExpiryWarningDays !== undefined)
					changes.ssl_expiry_warning_days = result.data.sslExpiryWarningDays;

				let monitor = await Monitor.updateById(db, monitorId, changes);
				return apiSuccess({ monitor: serializeMonitor(monitor) });
			},
		},

		/** DELETE /api/v1/monitors/:monitorId — deletes an HTTP monitor. */
		monitorDestroy: {
			middleware: [requireApiKey("monitors:write")],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let existing = await Monitor.findByIdForTeam(db, ctx.apiTeam.id, monitorId);
				if (!existing) return apiError("NOT_FOUND", "Monitor not found", NotFound);

				await Monitor.deleteById(db, monitorId);
				return apiSuccess({ deleted: true });
			},
		},

		/** GET /api/v1/monitors/:monitorId/stats — aggregate stats for one monitor. */
		monitorStats: {
			middleware: [requireApiKey("monitors:read")],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let monitor = await Monitor.findByIdForTeam(db, ctx.apiTeam.id, monitorId);
				if (!monitor) return apiError("NOT_FOUND", "Monitor not found", NotFound);

				let stats = await Monitor.getStatsById(db, monitorId);
				return apiSuccess({ stats });
			},
		},

		/** GET /api/v1/monitors/:monitorId/results — paginated check-result history. */
		monitorResults: {
			middleware: [requireApiKey("monitors:read")],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let monitor = await Monitor.findByIdForTeam(db, ctx.apiTeam.id, monitorId);
				if (!monitor) return apiError("NOT_FOUND", "Monitor not found", NotFound);

				let { limit, offset } = parsePaginationQuery(ctx.url, { defaultLimit: 50, maxLimit: 100 });
				let { results, hasMore } = await Monitor.listResults(db, monitorId, { limit, offset });

				return apiSuccess({
					results: results.map((row) => ({
						id: row.id,
						responseStatus: row.response_status,
						responseTimeMs: row.response_time_ms,
						completedAt: row.completed_at,
						createdAt: row.created_at,
					})),
					pagination: { limit, offset, hasMore },
				});
			},
		},

		/** GET /api/v1/monitors/:monitorId/alert-events — alert-delivery history for one monitor. */
		monitorAlertEvents: {
			middleware: [requireApiKey("alerts:read")],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let monitor = await Monitor.findByIdForTeam(db, ctx.apiTeam.id, monitorId);
				if (!monitor) return apiError("NOT_FOUND", "Monitor not found", NotFound);

				let { limit } = parsePaginationQuery(ctx.url, { defaultLimit: 50, maxLimit: 200 });
				let events = await AlertEvent.listByMonitorId(db, monitorId, limit);

				return apiSuccess({
					events: events.map((event) => ({
						id: event.id,
						alertId: event.alert_id,
						monitorId: event.monitor_id,
						eventType: event.event_type,
						status: event.status,
						sentAt: event.sent_at,
						errorMessage: event.error_message,
						createdAt: event.created_at,
					})),
				});
			},
		},
	},
});
