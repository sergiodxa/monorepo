/**
 * API v1 item endpoints for a single HTTP monitor: get/update/delete
 * (`monitors:read`/`monitors:write`), aggregate stats, check-result history, and
 * alert-delivery history (`monitors:read`/`alerts:read`) for one monitor scoped to
 * the caller's team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import * as s from "@sdxc/json-schema";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { InsertMonitor, SelectMonitor } from "~/database/schema";

import AlertEvent from "~/app/data/alert-event";
import Monitor from "~/app/data/monitor";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import {
	MONITOR_ID_PARAMS,
	UPDATE_MONITOR_BODY,
	WRITABLE_MONITOR,
} from "~/app/http/openapi/monitors";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { readApiUpdate } from "~/app/services/api-update";
import { apiPage, NEWEST_FIRST, newestFirst, PAGING } from "~/app/services/pagination";
import { encodeId, encodeMonitorId } from "~/app/services/typed-id";
import { monitorRoutes } from "~/routes/api-groups";

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

/**
 * The monitor's writable members as the API reads them, the target an update's merge
 * patch applies to.
 */
function writableMonitor(monitor: SelectMonitor) {
	return {
		name: monitor.name,
		url: monitor.url,
		method: monitor.method,
		expectedStatus: monitor.expected_status,
		intervalSeconds: monitor.interval_seconds,
		degradedAfterMs: monitor.degraded_after_ms,
		timeoutSeconds: monitor.timeout_seconds,
		locationHint: monitor.location_hint,
		enabled: monitor.enabled_at !== null,
		sslMonitoringEnabled: monitor.ssl_monitoring_enabled,
		sslExpiryWarningDays: monitor.ssl_expiry_warning_days,
	};
}

/**
 * Applies a `PATCH` merge patch to one monitor. Only the members the patch changed are
 * written, so re-sending `enabled: true` keeps the instant checks resumed.
 *
 * @param ctx - The request, after `requireApiKey("monitors:write")`.
 * @returns The updated monitor; a 404 for a monitor outside the team, before the body is read.
 */
async function patchMonitor(ctx: RequestContext): Promise<Response> {
	let { monitorId } = s.parse(MONITOR_ID_PARAMS, ctx.params);
	let existing = await Monitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, monitorId);
	if (!existing)
		return apiProblems.notFound({ detail: "Monitor not found", instance: problemInstance() });

	let update = await readApiUpdate(ctx.request, writableMonitor(existing), WRITABLE_MONITOR);
	if (update instanceof Response) return update;
	let { value, changed } = update;

	let changes: Partial<InsertMonitor> = {};
	if (changed.has("name")) changes.name = value.name;
	if (changed.has("url")) changes.url = value.url;
	if (changed.has("method")) changes.method = value.method;
	if (changed.has("expectedStatus")) changes.expected_status = value.expectedStatus;
	if (changed.has("intervalSeconds")) changes.interval_seconds = value.intervalSeconds;
	if (changed.has("degradedAfterMs")) changes.degraded_after_ms = value.degradedAfterMs;
	if (changed.has("timeoutSeconds")) changes.timeout_seconds = value.timeoutSeconds;
	if (changed.has("locationHint")) changes.location_hint = value.locationHint;
	if (changed.has("enabled")) changes.enabled_at = value.enabled ? Date.now() : null;
	if (changed.has("sslMonitoringEnabled"))
		changes.ssl_monitoring_enabled = value.sslMonitoringEnabled;
	if (changed.has("sslExpiryWarningDays"))
		changes.ssl_expiry_warning_days = value.sslExpiryWarningDays;

	let monitor = await Monitor.updateById(ctx.db, monitorId, changes);
	return apiSuccess({ monitor: serializeMonitor(monitor) });
}

export default createController(monitorRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/monitors/:monitorId — a single HTTP monitor. */
		monitorShow: {
			middleware: [requireApiKey("monitors:read")],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MONITOR_ID_PARAMS, ctx.params);
				let monitor = await Monitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, monitorId);
				if (!monitor)
					return apiProblems.notFound({ detail: "Monitor not found", instance: problemInstance() });
				return apiSuccess({ monitor: serializeMonitor(monitor) });
			},
		},

		/** PATCH /api/v1/monitors/:monitorId — merge-patches an HTTP monitor. */
		monitorPatch: {
			middleware: [requireApiKey("monitors:write")],
			handler: patchMonitor,
		},

		/** PUT /api/v1/monitors/:monitorId — updates an HTTP monitor's editable fields. */
		monitorUpdate: {
			middleware: [requireApiKey("monitors:write")],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MONITOR_ID_PARAMS, ctx.params);
				let existing = await Monitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, monitorId);
				if (!existing)
					return apiProblems.notFound({ detail: "Monitor not found", instance: problemInstance() });

				let result = await validate(ctx.request, UPDATE_MONITOR_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
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

				let monitor = await Monitor.updateById(ctx.db, monitorId, changes);
				return apiSuccess({ monitor: serializeMonitor(monitor) });
			},
		},

		/** DELETE /api/v1/monitors/:monitorId — deletes an HTTP monitor. */
		monitorDestroy: {
			middleware: [requireApiKey("monitors:write")],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MONITOR_ID_PARAMS, ctx.params);
				let existing = await Monitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, monitorId);
				if (!existing)
					return apiProblems.notFound({ detail: "Monitor not found", instance: problemInstance() });

				await Monitor.deleteById(ctx.db, monitorId);
				return apiSuccess({ deleted: true });
			},
		},

		/** GET /api/v1/monitors/:monitorId/stats — aggregate stats for one monitor. */
		monitorStats: {
			middleware: [requireApiKey("monitors:read")],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MONITOR_ID_PARAMS, ctx.params);
				let monitor = await Monitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, monitorId);
				if (!monitor)
					return apiProblems.notFound({ detail: "Monitor not found", instance: problemInstance() });

				let stats = await Monitor.getStatsById(ctx.db, monitorId);
				return apiSuccess({ stats });
			},
		},

		/** GET /api/v1/monitors/:monitorId/results — paginated check-result history. */
		monitorResults: {
			middleware: [requireApiKey("monitors:read")],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MONITOR_ID_PARAMS, ctx.params);
				let monitor = await Monitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, monitorId);
				if (!monitor)
					return apiProblems.notFound({ detail: "Monitor not found", instance: problemInstance() });

				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				let page = await Pagination.byKeyset(Monitor.resultsQuery(ctx.db, monitorId), {
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

				let results = page.data.items.map((row) => ({
					/**
					 * A check result is keyed by `Monitor.scheduledJobId` — the monitor id and
					 * the minute the check was scheduled for — which is what lets repeated
					 * deliveries of one minute's cron collapse onto a single row. That key
					 * travels as stored, since a TypeID encodes a UUID and this is a pair.
					 */
					id: row.id,
					responseStatus: row.response_status,
					responseTimeMs: row.response_time_ms,
					completedAt: row.completed_at,
					createdAt: row.created_at,
				}));

				return apiPage({ results }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
				});
			},
		},

		/** GET /api/v1/monitors/:monitorId/alert-events — alert-delivery history for one monitor. */
		monitorAlertEvents: {
			middleware: [requireApiKey("alerts:read")],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MONITOR_ID_PARAMS, ctx.params);
				let monitor = await Monitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, monitorId);
				if (!monitor)
					return apiProblems.notFound({ detail: "Monitor not found", instance: problemInstance() });

				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				let page = await Pagination.byKeyset(AlertEvent.eventsByMonitorQuery(ctx.db, monitorId), {
					orderBy: newestFirst("sent_at"),
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

				let events = page.data.items.map((event) => ({
					id: encodeId("evt", event.id),
					alertId: encodeId("alt", event.alert_id),
					monitorId: encodeMonitorId(event.monitor_type, event.monitor_id),
					eventType: event.event_type,
					status: event.status,
					sentAt: event.sent_at,
					errorMessage: event.error_message,
					createdAt: event.created_at,
				}));

				return apiPage({ events }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
				});
			},
		},
	},
});
