/**
 * API v1 collection endpoints for maintenance windows: `GET /api/v1/maintenance`
 * lists a team's windows and `POST /api/v1/maintenance` creates one, validating the
 * `monitorType`/`monitorId` scope it covers and that `endsAt` follows `startsAt`. Requires
 * `maintenance:read`/`maintenance:write` via `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, Created, NotFound } from "@sdxc/http/status-code";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createController } from "remix/router";

import type { MonitorScope, MonitorScopeType } from "~/app/lib/monitor-scope";
import type { SelectMaintenanceWindow } from "~/database/schema";

import MaintenanceWindow from "~/app/data/maintenance-window";
import { isResolvableScope } from "~/app/data/scope-monitors";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { MONITOR_SCOPE_TYPES, storedMonitorScope } from "~/app/lib/monitor-scope";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

/**
 * The scope a request asks for, derived from the two fields that express it.
 *
 * A `monitorId` sent with no `monitorType` resolves to an HTTP monitor, preserving what
 * every client sending only that field has always meant.
 */
export function apiScopeFrom(input: {
	monitorType?: MonitorScopeType;
	monitorId?: string | null;
}): MonitorScope {
	let monitorId = input.monitorId ?? null;
	return { monitorType: input.monitorType ?? (monitorId === null ? null : "http"), monitorId };
}

/** Maps a maintenance-window row to its public camelCase JSON shape. */
export function serializeMaintenanceWindow(window: SelectMaintenanceWindow) {
	return {
		id: window.id,
		teamId: window.team_id,
		monitorType: storedMonitorScope(window).monitorType,
		monitorId: window.monitor_id,
		name: window.name,
		startsAt: window.starts_at,
		endsAt: window.ends_at,
		endedEarlyAt: window.ended_early_at,
		suppressAlerts: window.suppress_alerts,
		showOnStatusPage: window.show_on_status_page,
		createdAt: window.created_at,
		updatedAt: window.updated_at,
	};
}

/** An ISO-8601 date-time string, transformed into epoch milliseconds. */
const isoDateTime = s
	.string()
	.refine((value: string) => Number.isFinite(new Date(value).getTime()), "Invalid date/time.")
	.transform((value: string) => new Date(value).getTime());

const CreateMaintenanceSchema = s
	.object({
		name: s.string().refine((value: string) => value.length > 0, "Name is required."),
		/**
		 * Which monitor table `monitorId` names, or, alone, the whole type it covers.
		 *
		 * Stays optional beside an id for compatibility: `monitorId` alone meant an HTTP monitor
		 * before this field existed, and requests still sending just that resolve the same way.
		 */
		monitorType: s.optional(s.enum_(MONITOR_SCOPE_TYPES)),
		monitorId: s.optional(s.nullable(s.string())),
		startsAt: isoDateTime,
		endsAt: isoDateTime,
		suppressAlerts: s.defaulted(s.boolean(), true),
		showOnStatusPage: s.defaulted(s.boolean(), true),
	})
	.refine((value) => value.endsAt > value.startsAt, "endsAt must be after startsAt");

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const maintenanceRoutes = {
	maintenanceIndex: routes.api.v1.maintenance.index,
	maintenanceCreate: routes.api.v1.maintenance.create,
};

export default createController(maintenanceRoutes, {
	actions: {
		/** GET /api/v1/maintenance — lists the team's maintenance windows. */
		maintenanceIndex: {
			middleware: [requireApiKey("maintenance:read")],
			handler: async (ctx) => {
				let db = getServiceContainer().get(Database);
				let windows = await MaintenanceWindow.listByTeam(db, ctx.apiTeam.id);
				return apiSuccess({ maintenanceWindows: windows.map(serializeMaintenanceWindow) });
			},
		},

		/** POST /api/v1/maintenance — creates a maintenance window for the team. */
		maintenanceCreate: {
			middleware: [requireApiKey("maintenance:write")],
			handler: async (ctx) => {
				let result = await validate(ctx.request, CreateMaintenanceSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let db = getServiceContainer().get(Database);

				let scope = apiScopeFrom(result.data);
				if (!(await isResolvableScope(db, ctx.apiTeam.id, scope))) {
					return apiError("NOT_FOUND", "Monitor not found", NotFound);
				}

				let window = await MaintenanceWindow.create(db, ctx.apiTeam.id, {
					monitor_type: scope.monitorType,
					monitor_id: scope.monitorId,
					name: result.data.name,
					starts_at: result.data.startsAt,
					ends_at: result.data.endsAt,
					suppress_alerts: result.data.suppressAlerts,
					show_on_status_page: result.data.showOnStatusPage,
				});

				return apiSuccess({ maintenanceWindow: serializeMaintenanceWindow(window) }, Created);
			},
		},
	},
});
