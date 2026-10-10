/**
 * API v1 item endpoints for a single maintenance window: get/update/delete and
 * ending it early, all requiring `maintenance:read`/`maintenance:write` via
 * `requireApiKey`. `PUT` writes the fields it is sent and `PATCH` reads a JSON merge patch;
 * both re-validate the dates and the `monitorType`/`monitorId` scope pair.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import * as s from "@sdxc/json-schema";
import { issuesFrom } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { InsertMaintenanceWindow, SelectMaintenanceWindow } from "~/database/schema";

import { apiScopeFrom, serializeMaintenanceWindow } from "~/app/http/controllers/api/maintenance";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import {
	MAINTENANCE_ID_PARAMS,
	UPDATE_MAINTENANCE_BODY,
	WRITABLE_MAINTENANCE,
} from "~/app/http/openapi/maintenance";
import { storedMonitorScope } from "~/app/lib/monitor-scope";
import { apiProblems, invalidField, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { readApiUpdate } from "~/app/services/api-update";
import { isResolvableScope } from "~/app/services/scope-monitors";
import { encodeMonitorId } from "~/app/services/typed-id";
import { maintenanceWindowRoutes } from "~/routes/api-groups";

/**
 * The window's writable members as its create body spells them, the target a `PATCH`
 * merge patch applies to; the dates are ISO-8601 strings, the form a request sends.
 */
function writableMaintenanceWindow(window: SelectMaintenanceWindow) {
	let scope = storedMonitorScope(window);
	return {
		name: window.name,
		monitorType: scope.monitorType,
		monitorId:
			scope.monitorId === null ? null : encodeMonitorId(scope.monitorType, scope.monitorId),
		startsAt: new Date(window.starts_at).toISOString(),
		endsAt: new Date(window.ends_at).toISOString(),
		suppressAlerts: window.suppress_alerts,
		showOnStatusPage: window.show_on_status_page,
	};
}

/**
 * Applies a `PATCH` merge patch to one window, writing only the members it changed.
 * A changed `monitorType` alone widens to the whole type, and a removed `monitorId` alone
 * widens to every monitor.
 *
 * @param ctx - The request, after `requireApiKey("maintenance:write")`.
 * @returns The updated window; a 404 for a window outside the team, before the body is read.
 */
async function patchMaintenanceWindow(ctx: RequestContext): Promise<Response> {
	let { maintenanceId } = s.parse(MAINTENANCE_ID_PARAMS, ctx.params);
	let existing = await ctx.models.maintenanceWindows.inTeam(ctx.apiTeam.id).find(maintenanceId);
	if (!existing)
		return apiProblems.notFound({
			detail: "Maintenance window not found",
			instance: problemInstance(),
		});

	let update = await readApiUpdate(
		ctx.request,
		writableMaintenanceWindow(existing),
		WRITABLE_MAINTENANCE,
	);
	if (update instanceof Response) return update;
	let { value, changed } = update;

	if (value.endsAt <= value.startsAt) {
		return invalidField("endsAt must be after startsAt", "/endsAt");
	}

	let changes: Partial<InsertMaintenanceWindow> = {};
	if (changed.has("name")) changes.name = value.name;

	if (changed.has("monitorType") || changed.has("monitorId")) {
		let scope = apiScopeFrom({
			monitorType: changed.has("monitorType") ? value.monitorType : undefined,
			monitorId: changed.has("monitorId") ? (value.monitorId ?? null) : undefined,
		});
		if (scope === null || !(await isResolvableScope(ctx.models, ctx.apiTeam.id, scope))) {
			return apiProblems.notFound({ detail: "Monitor not found", instance: problemInstance() });
		}

		changes.monitor_type = scope.monitorType;
		changes.monitor_id = scope.monitorId;
	}

	if (changed.has("startsAt")) changes.starts_at = value.startsAt;
	if (changed.has("endsAt")) changes.ends_at = value.endsAt;
	if (changed.has("suppressAlerts")) changes.suppress_alerts = value.suppressAlerts;
	if (changed.has("showOnStatusPage")) changes.show_on_status_page = value.showOnStatusPage;

	let window = unwrap(await ctx.models.maintenanceWindows.update(maintenanceId, changes));
	return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(window) });
}

export default createController(maintenanceWindowRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/maintenance/:maintenanceId — a single maintenance window. */
		maintenanceShow: {
			middleware: [requireApiKey("maintenance:read")],
			handler: async (ctx) => {
				let { maintenanceId } = s.parse(MAINTENANCE_ID_PARAMS, ctx.params);
				let window = await ctx.models.maintenanceWindows.inTeam(ctx.apiTeam.id).find(maintenanceId);
				if (!window)
					return apiProblems.notFound({
						detail: "Maintenance window not found",
						instance: problemInstance(),
					});
				return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(window) });
			},
		},

		/** PATCH /api/v1/maintenance/:maintenanceId — merge-patches a maintenance window. */
		maintenancePatch: {
			middleware: [requireApiKey("maintenance:write")],
			handler: patchMaintenanceWindow,
		},

		/** PUT /api/v1/maintenance/:maintenanceId — updates a maintenance window. */
		maintenanceUpdate: {
			middleware: [requireApiKey("maintenance:write")],
			handler: async (ctx) => {
				let { maintenanceId } = s.parse(MAINTENANCE_ID_PARAMS, ctx.params);
				let existing = await ctx.models.maintenanceWindows
					.inTeam(ctx.apiTeam.id)
					.find(maintenanceId);
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
					if (scope === null || !(await isResolvableScope(ctx.models, ctx.apiTeam.id, scope))) {
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

				let window = unwrap(await ctx.models.maintenanceWindows.update(maintenanceId, changes));
				return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(window) });
			},
		},

		/** DELETE /api/v1/maintenance/:maintenanceId — deletes a maintenance window. */
		maintenanceDestroy: {
			middleware: [requireApiKey("maintenance:write")],
			handler: async (ctx) => {
				let { maintenanceId } = s.parse(MAINTENANCE_ID_PARAMS, ctx.params);
				let existing = await ctx.models.maintenanceWindows
					.inTeam(ctx.apiTeam.id)
					.find(maintenanceId);
				if (!existing)
					return apiProblems.notFound({
						detail: "Maintenance window not found",
						instance: problemInstance(),
					});

				unwrap(await ctx.models.maintenanceWindows.delete(maintenanceId));
				return apiSuccess({ deleted: true });
			},
		},

		/** POST /api/v1/maintenance/:maintenanceId/end — ends a maintenance window early. */
		maintenanceEnd: {
			middleware: [requireApiKey("maintenance:write")],
			handler: async (ctx) => {
				let { maintenanceId } = s.parse(MAINTENANCE_ID_PARAMS, ctx.params);
				let existing = await ctx.models.maintenanceWindows
					.inTeam(ctx.apiTeam.id)
					.find(maintenanceId);
				if (!existing)
					return apiProblems.notFound({
						detail: "Maintenance window not found",
						instance: problemInstance(),
					});

				let window = unwrap(await ctx.models.maintenanceWindows.endEarly(maintenanceId));
				return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(window) });
			},
		},
	},
});
