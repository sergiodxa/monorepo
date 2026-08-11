/**
 * API v1 item endpoints for a single maintenance window: get/update/delete and
 * ending it early, all requiring `maintenance:read`/`maintenance:write` via
 * `requireApiKey` and re-validating dates and the `monitorType`/`monitorId` scope pair.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, NotFound } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import type { InsertMaintenanceWindow } from "~/database/schema";

import MaintenanceWindow from "~/app/data/maintenance-window";
import { isResolvableScope } from "~/app/data/scope-monitors";
import { apiScopeFrom, serializeMaintenanceWindow } from "~/app/http/controllers/api/maintenance";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { MONITOR_SCOPE_TYPES } from "~/app/lib/monitor-scope";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

const MaintenanceIdParams = s.object({ maintenanceId: s.string() });

/** An ISO-8601 date-time string, transformed into epoch milliseconds. */
const isoDateTime = s
	.string()
	.refine((value: string) => Number.isFinite(new Date(value).getTime()), "Invalid date/time.")
	.transform((value: string) => new Date(value).getTime());

const UpdateMaintenanceSchema = s.object({
	name: s.optional(s.string().refine((value: string) => value.length > 0, "Name is required.")),
	monitorType: s.optional(s.enum_(MONITOR_SCOPE_TYPES)),
	monitorId: s.optional(s.nullable(s.string())),
	startsAt: s.optional(isoDateTime),
	endsAt: s.optional(isoDateTime),
	suppressAlerts: s.optional(s.boolean()),
	showOnStatusPage: s.optional(s.boolean()),
});

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const maintenanceWindowRoutes = {
	maintenanceShow: routes.api.v1.maintenance.show,
	maintenanceUpdate: routes.api.v1.maintenance.update,
	maintenanceDestroy: routes.api.v1.maintenance.destroy,
	maintenanceEnd: routes.api.v1.maintenance.end,
};

export default createController(maintenanceWindowRoutes, {
	actions: {
		/** GET /api/v1/maintenance/:maintenanceId — a single maintenance window. */
		maintenanceShow: {
			middleware: [requireApiKey("maintenance:read")],
			handler: async (ctx) => {
				let { maintenanceId } = s.parse(MaintenanceIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let window = await MaintenanceWindow.findByIdForTeam(db, ctx.apiTeam.id, maintenanceId);
				if (!window) return apiError("NOT_FOUND", "Maintenance window not found", NotFound);
				return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(window) });
			},
		},

		/** PUT /api/v1/maintenance/:maintenanceId — updates a maintenance window. */
		maintenanceUpdate: {
			middleware: [requireApiKey("maintenance:write")],
			handler: async (ctx) => {
				let { maintenanceId } = s.parse(MaintenanceIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let existing = await MaintenanceWindow.findByIdForTeam(db, ctx.apiTeam.id, maintenanceId);
				if (!existing) return apiError("NOT_FOUND", "Maintenance window not found", NotFound);

				let result = await validate(ctx.request, UpdateMaintenanceSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let newStartsAt = result.data.startsAt ?? existing.starts_at;
				let newEndsAt = result.data.endsAt ?? existing.ends_at;
				if (newEndsAt <= newStartsAt) {
					return apiError("VALIDATION_ERROR", "endsAt must be after startsAt", BadRequest);
				}

				let changes: Partial<InsertMaintenanceWindow> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;

				/**
				 * The scope moves as a unit or not at all: sending either field rewrites both, so
				 * a request narrowing a window to a whole type cannot leave the previous monitor's
				 * id behind it, and one that mentions neither leaves the window exactly where it is.
				 */
				if (result.data.monitorType !== undefined || result.data.monitorId !== undefined) {
					let scope = apiScopeFrom(result.data);
					if (!(await isResolvableScope(db, ctx.apiTeam.id, scope))) {
						return apiError("NOT_FOUND", "Monitor not found", NotFound);
					}

					changes.monitor_type = scope.monitorType;
					changes.monitor_id = scope.monitorId;
				}

				if (result.data.startsAt !== undefined) changes.starts_at = result.data.startsAt;
				if (result.data.endsAt !== undefined) changes.ends_at = result.data.endsAt;
				if (result.data.suppressAlerts !== undefined)
					changes.suppress_alerts = result.data.suppressAlerts;
				if (result.data.showOnStatusPage !== undefined)
					changes.show_on_status_page = result.data.showOnStatusPage;

				let window = await MaintenanceWindow.updateById(db, maintenanceId, changes);
				return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(window) });
			},
		},

		/** DELETE /api/v1/maintenance/:maintenanceId — deletes a maintenance window. */
		maintenanceDestroy: {
			middleware: [requireApiKey("maintenance:write")],
			handler: async (ctx) => {
				let { maintenanceId } = s.parse(MaintenanceIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let existing = await MaintenanceWindow.findByIdForTeam(db, ctx.apiTeam.id, maintenanceId);
				if (!existing) return apiError("NOT_FOUND", "Maintenance window not found", NotFound);

				await MaintenanceWindow.deleteById(db, maintenanceId);
				return apiSuccess({ deleted: true });
			},
		},

		/** POST /api/v1/maintenance/:maintenanceId/end — ends a maintenance window early. */
		maintenanceEnd: {
			middleware: [requireApiKey("maintenance:write")],
			handler: async (ctx) => {
				let { maintenanceId } = s.parse(MaintenanceIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let existing = await MaintenanceWindow.findByIdForTeam(db, ctx.apiTeam.id, maintenanceId);
				if (!existing) return apiError("NOT_FOUND", "Maintenance window not found", NotFound);

				let window = await MaintenanceWindow.endEarly(db, maintenanceId);
				return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(window) });
			},
		},
	},
});
