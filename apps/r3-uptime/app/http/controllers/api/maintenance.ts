/**
 * API v1 collection endpoints for maintenance windows: `GET /api/v1/maintenance`
 * lists a team's windows and `POST /api/v1/maintenance` creates one, validating any
 * referenced monitor and that `endsAt` follows `startsAt`. Requires
 * `maintenance:read`/`maintenance:write` via `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, Created, NotFound } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import type { SelectMaintenanceWindow } from "~/database/schema";

import MaintenanceWindow from "~/app/data/maintenance-window";
import Monitor from "~/app/data/monitor";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

/** Maps a maintenance-window row to its public camelCase JSON shape. */
export function serializeMaintenanceWindow(window: SelectMaintenanceWindow) {
	return {
		id: window.id,
		teamId: window.team_id,
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

				if (result.data.monitorId) {
					let monitor = await Monitor.findByIdForTeam(db, ctx.apiTeam.id, result.data.monitorId);
					if (!monitor) return apiError("NOT_FOUND", "Monitor not found", NotFound);
				}

				let window = await MaintenanceWindow.create(db, ctx.apiTeam.id, {
					monitor_id: result.data.monitorId ?? null,
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
