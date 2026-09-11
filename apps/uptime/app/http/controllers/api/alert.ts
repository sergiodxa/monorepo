/**
 * API v1 item endpoints for a single alert: get/update/delete (`alerts:read`/
 * `alerts:write`) and its delivery-event history (`alerts:read`). Update only ever
 * touches `name`/`notifyOnRecovery`/`cooldownMinutes` and the
 * `monitorType`/`monitorId` scope pair — the channel strategy and its config are
 * immutable after creation; delete and recreate the alert to change channel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, InternalServerError, NotFound } from "@sdxc/http/status-code";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { createController } from "remix/router";

import type { InsertAlert } from "~/database/schema";

import Alert from "~/app/data/alert";
import AlertEvent from "~/app/data/alert-event";
import { isResolvableScope } from "~/app/data/scope-monitors";
import {
	apiScopeFrom,
	serializeAlertSafe,
	serializeAlertStrategyOnly,
} from "~/app/http/controllers/api/alerts";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { MONITOR_SCOPE_TYPES } from "~/app/lib/monitor-scope";
import { apiError, apiSuccess } from "~/app/services/api-response";
import { apiPage, newestFirst, PAGING } from "~/app/services/pagination";
import { encodeId, encodeMonitorId, typedId } from "~/app/services/typed-id";
import routes from "~/routes/web";

const AlertIdParams = s.object({ alertId: typedId("alt") });

const UpdateAlertSchema = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	notifyOnRecovery: s.optional(s.boolean()),
	cooldownMinutes: s.optional(s.number().pipe(checks.min(0), checks.max(1440))),
	monitorType: s.optional(s.enum_(MONITOR_SCOPE_TYPES)),
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
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/alerts/:alertId — a single alert with sensitive config stripped. */
		alertShow: {
			middleware: [requireApiKey("alerts:read")],
			handler: async (ctx) => {
				let { alertId } = s.parse(AlertIdParams, ctx.params);
				let alert = await Alert.findByIdForTeam(ctx.db, ctx.apiTeam.id, alertId);
				if (!alert) return apiError("NOT_FOUND", "Alert not found", NotFound);
				return apiSuccess({ alert: serializeAlertSafe(alert) });
			},
		},

		/** PUT /api/v1/alerts/:alertId — updates an alert's non-channel fields. */
		alertUpdate: {
			middleware: [requireApiKey("alerts:write")],
			handler: async (ctx) => {
				let { alertId } = s.parse(AlertIdParams, ctx.params);
				let existing = await Alert.findByIdForTeam(ctx.db, ctx.apiTeam.id, alertId);
				if (!existing) return apiError("NOT_FOUND", "Alert not found", NotFound);

				let result = await validate(ctx.request, UpdateAlertSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let changes: Partial<InsertAlert> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;
				if (result.data.notifyOnRecovery !== undefined)
					changes.notify_on_recovery = result.data.notifyOnRecovery;
				if (result.data.cooldownMinutes !== undefined)
					changes.cooldown_minutes = result.data.cooldownMinutes;

				/**
				 * The scope moves as a unit: sending either field rewrites both together, so
				 * narrowing an alert to a whole type also clears the previous monitor id, and
				 * omitting both fields keeps the alert's current scope.
				 */
				if (result.data.monitorType !== undefined || result.data.monitorId !== undefined) {
					let scope = apiScopeFrom(result.data);
					if (scope === null || !(await isResolvableScope(ctx.db, ctx.apiTeam.id, scope))) {
						return apiError("NOT_FOUND", "Monitor not found", NotFound);
					}

					changes.monitor_type = scope.monitorType;
					changes.monitor_id = scope.monitorId;
				}

				let alert = await Alert.updateById(ctx.db, alertId, changes);
				return apiSuccess({ alert: serializeAlertStrategyOnly(alert) });
			},
		},

		/** DELETE /api/v1/alerts/:alertId — deletes an alert. */
		alertDestroy: {
			middleware: [requireApiKey("alerts:write")],
			handler: async (ctx) => {
				let { alertId } = s.parse(AlertIdParams, ctx.params);
				let existing = await Alert.findByIdForTeam(ctx.db, ctx.apiTeam.id, alertId);
				if (!existing) return apiError("NOT_FOUND", "Alert not found", NotFound);

				await Alert.deleteById(ctx.db, alertId);
				return apiSuccess({ deleted: true });
			},
		},

		/** GET /api/v1/alerts/:alertId/events — delivery-event history for one alert. */
		alertEvents: {
			middleware: [requireApiKey("alerts:read")],
			handler: async (ctx) => {
				let { alertId } = s.parse(AlertIdParams, ctx.params);
				let alert = await Alert.findByIdForTeam(ctx.db, ctx.apiTeam.id, alertId);
				if (!alert) return apiError("NOT_FOUND", "Alert not found", NotFound);

				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params)) return apiError("BAD_REQUEST", params.error.message, BadRequest);

				let page = await Pagination.byKeyset(AlertEvent.eventsByAlertQuery(ctx.db, alertId), {
					orderBy: newestFirst("sent_at"),
					cursor: params.data.cursor,
					limit: params.data.perPage,
				});

				if (isFailure(page)) {
					if (page.error instanceof InvalidCursorError) {
						return apiError("BAD_REQUEST", page.error.message, BadRequest);
					}
					return apiError("INTERNAL", page.error.message, InternalServerError);
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
