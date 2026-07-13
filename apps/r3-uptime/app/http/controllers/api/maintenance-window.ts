/**
 * API v1 item endpoints for a single maintenance window: get/update/delete and
 * ending it early, all requiring `maintenance:read`/`maintenance:write` via
 * `requireApiKey` and re-validating dates and any referenced monitor.
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
import { createAction } from "remix/fetch-router";

import type { InsertMaintenanceWindow } from "~/database/schema";

import MaintenanceWindow from "~/app/data/maintenance-window";
import Monitor from "~/app/data/monitor";
import { serializeMaintenanceWindow } from "~/app/http/controllers/api/maintenance";
import requireApiKey from "~/app/http/middleware/require-api-key";
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
	monitorId: s.optional(s.nullable(s.string())),
	startsAt: s.optional(isoDateTime),
	endsAt: s.optional(isoDateTime),
	suppressAlerts: s.optional(s.boolean()),
	showOnStatusPage: s.optional(s.boolean()),
});

/** GET /api/v1/maintenance/:maintenanceId — a single maintenance window. */
export const maintenanceShow = createAction(routes.api.v1.maintenanceShow, {
	middleware: [requireApiKey("maintenance:read")],
	handler: async (ctx) => {
		let { maintenanceId } = s.parse(MaintenanceIdParams, ctx.params);
		let db = getServiceContainer().get(Database);
		let window = await MaintenanceWindow.findByIdForTeam(db, ctx.apiTeam.id, maintenanceId);
		if (!window) return apiError("NOT_FOUND", "Maintenance window not found", NotFound);
		return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(window) });
	},
});

/** PUT /api/v1/maintenance/:maintenanceId — updates a maintenance window. */
export const maintenanceUpdate = createAction(routes.api.v1.maintenanceUpdate, {
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

		if (result.data.monitorId) {
			let monitor = await Monitor.findByIdForTeam(db, ctx.apiTeam.id, result.data.monitorId);
			if (!monitor) return apiError("NOT_FOUND", "Monitor not found", NotFound);
		}

		let newStartsAt = result.data.startsAt ?? existing.starts_at;
		let newEndsAt = result.data.endsAt ?? existing.ends_at;
		if (newEndsAt <= newStartsAt) {
			return apiError("VALIDATION_ERROR", "endsAt must be after startsAt", BadRequest);
		}

		let changes: Partial<InsertMaintenanceWindow> = {};
		if (result.data.name !== undefined) changes.name = result.data.name;
		if (result.data.monitorId !== undefined) changes.monitor_id = result.data.monitorId;
		if (result.data.startsAt !== undefined) changes.starts_at = result.data.startsAt;
		if (result.data.endsAt !== undefined) changes.ends_at = result.data.endsAt;
		if (result.data.suppressAlerts !== undefined)
			changes.suppress_alerts = result.data.suppressAlerts;
		if (result.data.showOnStatusPage !== undefined)
			changes.show_on_status_page = result.data.showOnStatusPage;

		let window = await MaintenanceWindow.updateById(db, maintenanceId, changes);
		return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(window) });
	},
});

/** DELETE /api/v1/maintenance/:maintenanceId — deletes a maintenance window. */
export const maintenanceDestroy = createAction(routes.api.v1.maintenanceDestroy, {
	middleware: [requireApiKey("maintenance:write")],
	handler: async (ctx) => {
		let { maintenanceId } = s.parse(MaintenanceIdParams, ctx.params);
		let db = getServiceContainer().get(Database);
		let existing = await MaintenanceWindow.findByIdForTeam(db, ctx.apiTeam.id, maintenanceId);
		if (!existing) return apiError("NOT_FOUND", "Maintenance window not found", NotFound);

		await MaintenanceWindow.deleteById(db, maintenanceId);
		return apiSuccess({ deleted: true });
	},
});

/** POST /api/v1/maintenance/:maintenanceId/end — ends a maintenance window early. */
export const maintenanceEnd = createAction(routes.api.v1.maintenanceEnd, {
	middleware: [requireApiKey("maintenance:write")],
	handler: async (ctx) => {
		let { maintenanceId } = s.parse(MaintenanceIdParams, ctx.params);
		let db = getServiceContainer().get(Database);
		let existing = await MaintenanceWindow.findByIdForTeam(db, ctx.apiTeam.id, maintenanceId);
		if (!existing) return apiError("NOT_FOUND", "Maintenance window not found", NotFound);

		let window = await MaintenanceWindow.endEarly(db, maintenanceId);
		return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(window) });
	},
});
