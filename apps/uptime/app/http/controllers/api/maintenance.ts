/**
 * API v1 collection endpoints for maintenance windows: `GET /api/v1/maintenance`
 * lists a team's windows and `POST /api/v1/maintenance` creates one, validating the
 * `monitorType`/`monitorId` scope it covers and that `endsAt` follows `startsAt`. Requires
 * `maintenance:read`/`maintenance:write` via `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Created } from "@sdxc/http/status-code";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { MonitorScope, MonitorScopeType } from "~/app/lib/monitor-scope";
import type { SelectMaintenanceWindow } from "~/database/schema";

import catchValidationError from "~/app/http/middleware/catch-validation-error";
import idempotent from "~/app/http/middleware/idempotency";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { CREATE_MAINTENANCE_BODY } from "~/app/http/openapi/maintenance";
import { storedMonitorScope } from "~/app/lib/monitor-scope";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { apiPage, NEWEST_FIRST, PAGING } from "~/app/services/pagination";
import { isResolvableScope } from "~/app/services/scope-monitors";
import { decodeMonitorId, encodeId, encodeMonitorId } from "~/app/services/typed-id";
import { maintenanceRoutes } from "~/routes/api-groups";

/**
 * The scope a request asks for, derived from the two fields that express it.
 *
 * A `monitorId` sent with no `monitorType` resolves to an HTTP monitor, preserving what
 * every client sending only that field has always meant.
 *
 * Returns null when the id carries a prefix belonging to another monitor type, which
 * names a monitor that cannot exist. Reporting that separately is what keeps such a
 * request from falling back to a null id, since a null id widens the window to every
 * monitor of the type instead of the one that was asked for.
 */
export function apiScopeFrom(input: {
	monitorType?: MonitorScopeType;
	monitorId?: string | null;
}): MonitorScope | null {
	let value = input.monitorId ?? null;
	let monitorType = input.monitorType ?? (value === null ? null : "http");
	if (value === null) return { monitorType, monitorId: null };

	let monitorId = decodeMonitorId(monitorType, value);
	if (monitorId === null) return null;
	return { monitorType, monitorId };
}

/** Maps a maintenance-window row to its public camelCase JSON shape. */
export function serializeMaintenanceWindow(window: SelectMaintenanceWindow) {
	let scope = storedMonitorScope(window);
	return {
		id: encodeId("mnt", window.id),
		teamId: encodeId("team", window.team_id),
		monitorType: scope.monitorType,
		monitorId:
			scope.monitorId === null ? null : encodeMonitorId(scope.monitorType, scope.monitorId),
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

export default createController(maintenanceRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/maintenance — lists the team's maintenance windows. */
		maintenanceIndex: {
			middleware: [requireApiKey("maintenance:read")],
			handler: async (ctx) => {
				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				// Chaining returns new queries, so the same one both counts and pages.
				let query = ctx.models.maintenanceWindows.inTeam(ctx.apiTeam.id);

				let page = await Pagination.byKeyset(query, {
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

				return apiPage(
					{ maintenanceWindows: page.data.items.map(serializeMaintenanceWindow) },
					page.data,
					{
						url: ctx.url,
						perPage: params.data.perPage,
						total: await query.count(),
					},
				);
			},
		},

		/** POST /api/v1/maintenance — creates a maintenance window for the team. */
		maintenanceCreate: {
			middleware: [requireApiKey("maintenance:write"), idempotent],
			handler: async (ctx) => {
				let result = await validate(ctx.request, CREATE_MAINTENANCE_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let scope = apiScopeFrom(result.data);
				if (scope === null || !(await isResolvableScope(ctx.models, ctx.apiTeam.id, scope))) {
					return apiProblems.notFound({ detail: "Monitor not found", instance: problemInstance() });
				}

				let window = await ctx.models.maintenanceWindows.create({
					team_id: ctx.apiTeam.id,
					monitor_type: scope.monitorType,
					monitor_id: scope.monitorId,
					name: result.data.name,
					starts_at: result.data.startsAt,
					ends_at: result.data.endsAt,
					suppress_alerts: result.data.suppressAlerts,
					show_on_status_page: result.data.showOnStatusPage,
				});

				return apiSuccess(
					{ maintenanceWindow: serializeMaintenanceWindow(unwrap(window)) },
					Created,
				);
			},
		},
	},
});
