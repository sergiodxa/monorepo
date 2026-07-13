/**
 * API v1 item endpoints for a single alert: get/update/delete (`alerts:read`/
 * `alerts:write`) and its delivery-event history (`alerts:read`). Update only ever
 * touches `name`/`notifyOnRecovery`/`cooldownMinutes`/`monitorId` — the channel
 * strategy and its config are immutable after creation; delete and recreate the
 * alert to change channel.
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

import type { InsertAlert } from "~/database/schema";

import Alert from "~/app/data/alert";
import AlertEvent from "~/app/data/alert-event";
import Monitor from "~/app/data/monitor";
import { serializeAlertSafe, serializeAlertStrategyOnly } from "~/app/http/controllers/api/alerts";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess, parsePaginationQuery } from "~/app/services/api-response";
import routes from "~/routes/web";

const AlertIdParams = s.object({ alertId: s.string() });

const UpdateAlertSchema = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	notifyOnRecovery: s.optional(s.boolean()),
	cooldownMinutes: s.optional(s.number().pipe(checks.min(0), checks.max(1440))),
	monitorId: s.optional(s.nullable(s.string())),
});

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const alertRoutes = {
	alertShow: routes.api.v1.alerts.show,
	alertUpdate: routes.api.v1.alerts.update,
	alertDestroy: routes.api.v1.alerts.destroy,
	alertEvents: routes.api.v1.alerts.events,
};

export default createController(alertRoutes, {
	actions: {
		/** GET /api/v1/alerts/:alertId — a single alert with sensitive config stripped. */
		alertShow: {
			middleware: [requireApiKey("alerts:read")],
			handler: async (ctx) => {
				let { alertId } = s.parse(AlertIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let alert = await Alert.findByIdForTeam(db, ctx.apiTeam.id, alertId);
				if (!alert) return apiError("NOT_FOUND", "Alert not found", NotFound);
				return apiSuccess({ alert: serializeAlertSafe(alert) });
			},
		},

		/** PUT /api/v1/alerts/:alertId — updates an alert's non-channel fields. */
		alertUpdate: {
			middleware: [requireApiKey("alerts:write")],
			handler: async (ctx) => {
				let { alertId } = s.parse(AlertIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let existing = await Alert.findByIdForTeam(db, ctx.apiTeam.id, alertId);
				if (!existing) return apiError("NOT_FOUND", "Alert not found", NotFound);

				let result = await validate(ctx.request, UpdateAlertSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				if (result.data.monitorId) {
					let monitor = await Monitor.findByIdForTeam(db, ctx.apiTeam.id, result.data.monitorId);
					if (!monitor) return apiError("NOT_FOUND", "Monitor not found", NotFound);
				}

				let changes: Partial<InsertAlert> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;
				if (result.data.notifyOnRecovery !== undefined)
					changes.notify_on_recovery = result.data.notifyOnRecovery;
				if (result.data.cooldownMinutes !== undefined)
					changes.cooldown_minutes = result.data.cooldownMinutes;
				if (result.data.monitorId !== undefined) changes.monitor_id = result.data.monitorId;

				let alert = await Alert.updateById(db, alertId, changes);
				return apiSuccess({ alert: serializeAlertStrategyOnly(alert) });
			},
		},

		/** DELETE /api/v1/alerts/:alertId — deletes an alert. */
		alertDestroy: {
			middleware: [requireApiKey("alerts:write")],
			handler: async (ctx) => {
				let { alertId } = s.parse(AlertIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let existing = await Alert.findByIdForTeam(db, ctx.apiTeam.id, alertId);
				if (!existing) return apiError("NOT_FOUND", "Alert not found", NotFound);

				await Alert.deleteById(db, alertId);
				return apiSuccess({ deleted: true });
			},
		},

		/** GET /api/v1/alerts/:alertId/events — delivery-event history for one alert. */
		alertEvents: {
			middleware: [requireApiKey("alerts:read")],
			handler: async (ctx) => {
				let { alertId } = s.parse(AlertIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let alert = await Alert.findByIdForTeam(db, ctx.apiTeam.id, alertId);
				if (!alert) return apiError("NOT_FOUND", "Alert not found", NotFound);

				let { limit } = parsePaginationQuery(ctx.url, { defaultLimit: 50, maxLimit: 200 });
				let events = await AlertEvent.listByAlertId(db, alertId, limit);

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
