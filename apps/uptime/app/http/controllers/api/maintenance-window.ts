/**
 * API v1 item endpoints for a single maintenance window: get/update/delete and
 * ending it early, all requiring `maintenance:read`/`maintenance:write` via
 * `requireApiKey` and re-validating dates and the `monitorType`/`monitorId` scope pair.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { InsertMaintenanceWindow } from "~/database/schema";

import MaintenanceWindow from "~/app/data/maintenance-window";
import { isResolvableScope } from "~/app/data/scope-monitors";
import { apiScopeFrom, serializeMaintenanceWindow } from "~/app/http/controllers/api/maintenance";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { MAINTENANCE_ID_PARAMS, UPDATE_MAINTENANCE_BODY } from "~/app/http/openapi/maintenance";
import { apiProblems, invalidField, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { maintenanceWindowRoutes } from "~/routes/api-groups";

export default createController(maintenanceWindowRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/maintenance/:maintenanceId — a single maintenance window. */
		maintenanceShow: {
			middleware: [requireApiKey("maintenance:read")],
			handler: async (ctx) => {
				let { maintenanceId } = s.parse(MAINTENANCE_ID_PARAMS, ctx.params);
				let window = await MaintenanceWindow.findByIdForTeam(ctx.db, ctx.apiTeam.id, maintenanceId);
				if (!window)
					return apiProblems.notFound({
						detail: "Maintenance window not found",
						instance: problemInstance(),
					});
				return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(window) });
			},
		},

		/** PUT /api/v1/maintenance/:maintenanceId — updates a maintenance window. */
		maintenanceUpdate: {
			middleware: [requireApiKey("maintenance:write")],
			handler: async (ctx) => {
				let { maintenanceId } = s.parse(MAINTENANCE_ID_PARAMS, ctx.params);
				let existing = await MaintenanceWindow.findByIdForTeam(
					ctx.db,
					ctx.apiTeam.id,
					maintenanceId,
				);
				if (!existing)
					return apiProblems.notFound({
						detail: "Maintenance window not found",
						instance: problemInstance(),
					});

				let result = await validate(ctx.request, UPDATE_MAINTENANCE_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let newStartsAt = result.data.startsAt ?? existing.starts_at;
				let newEndsAt = result.data.endsAt ?? existing.ends_at;
				if (newEndsAt <= newStartsAt) {
					return invalidField("endsAt must be after startsAt", "/endsAt");
				}

				let changes: Partial<InsertMaintenanceWindow> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;

				/**
				 * The scope moves as a unit: sending either field rewrites both, clearing the
				 * previous monitor id when a window narrows to a whole type, and keeping the
				 * window's existing scope when neither field is sent.
				 */
				if (result.data.monitorType !== undefined || result.data.monitorId !== undefined) {
					let scope = apiScopeFrom(result.data);
					if (scope === null || !(await isResolvableScope(ctx.db, ctx.apiTeam.id, scope))) {
						return apiProblems.notFound({
							detail: "Monitor not found",
							instance: problemInstance(),
						});
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

				let window = await MaintenanceWindow.updateById(ctx.db, maintenanceId, changes);
				return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(window) });
			},
		},

		/** DELETE /api/v1/maintenance/:maintenanceId — deletes a maintenance window. */
		maintenanceDestroy: {
			middleware: [requireApiKey("maintenance:write")],
			handler: async (ctx) => {
				let { maintenanceId } = s.parse(MAINTENANCE_ID_PARAMS, ctx.params);
				let existing = await MaintenanceWindow.findByIdForTeam(
					ctx.db,
					ctx.apiTeam.id,
					maintenanceId,
				);
				if (!existing)
					return apiProblems.notFound({
						detail: "Maintenance window not found",
						instance: problemInstance(),
					});

				await MaintenanceWindow.deleteById(ctx.db, maintenanceId);
				return apiSuccess({ deleted: true });
			},
		},

		/** POST /api/v1/maintenance/:maintenanceId/end — ends a maintenance window early. */
		maintenanceEnd: {
			middleware: [requireApiKey("maintenance:write")],
			handler: async (ctx) => {
				let { maintenanceId } = s.parse(MAINTENANCE_ID_PARAMS, ctx.params);
				let existing = await MaintenanceWindow.findByIdForTeam(
					ctx.db,
					ctx.apiTeam.id,
					maintenanceId,
				);
				if (!existing)
					return apiProblems.notFound({
						detail: "Maintenance window not found",
						instance: problemInstance(),
					});

				let window = await MaintenanceWindow.endEarly(ctx.db, maintenanceId);
				return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(window) });
			},
		},
	},
});
