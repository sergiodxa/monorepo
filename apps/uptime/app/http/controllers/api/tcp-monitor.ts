/**
 * API v1 item endpoints for a single TCP monitor: get/update/delete
 * (`tcp-monitors:read`/`tcp-monitors:write`) and paginated check-result history
 * (`tcp-monitors:read`), scoped to a monitor owned by the caller's team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import * as s from "@sdxc/json-schema";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { InsertTcpMonitor, SelectTcpMonitor } from "~/database/schema";

import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import {
	TCP_MONITOR_ID_PARAMS,
	UPDATE_TCP_MONITOR_BODY,
	WRITABLE_TCP_MONITOR,
} from "~/app/http/openapi/tcp-monitors";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { readApiUpdate } from "~/app/services/api-update";
import { apiPage, newestFirst, PAGING } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";
import { tcpMonitorRoutes } from "~/routes/api-groups";

function serializeTcpMonitor(monitor: SelectTcpMonitor) {
	return {
		id: encodeId("tcpm", monitor.id),
		name: monitor.name,
		host: monitor.host,
		port: monitor.port,
		timeoutMs: monitor.timeout_ms,
		intervalSeconds: monitor.interval_seconds,
		isEnabled: monitor.is_enabled,
		lastCheckedAt: monitor.last_checked_at,
		lastStatus: monitor.last_status,
		lastResponseTimeMs: monitor.last_response_time_ms,
		createdAt: monitor.created_at,
		updatedAt: monitor.updated_at,
	};
}

/**
 * The TCP monitor's writable members as the API reads them, the target an update's merge
 * patch applies to.
 */
function writableTcpMonitor(monitor: SelectTcpMonitor) {
	return {
		name: monitor.name,
		host: monitor.host,
		port: monitor.port,
		timeoutMs: monitor.timeout_ms,
		intervalSeconds: monitor.interval_seconds,
		isEnabled: monitor.is_enabled,
	};
}

/**
 * Applies a `PATCH` merge patch to one TCP monitor. Only the members the patch changed
 * are written, so re-sending the current interval or `isEnabled` leaves the schedule alone.
 *
 * @param ctx - The request, after `requireApiKey("tcp-monitors:write")`.
 * @returns The updated monitor; a 404 for a monitor outside the team, before the body is read.
 */
async function patchTcpMonitor(ctx: RequestContext): Promise<Response> {
	let { tcpMonitorId } = s.parse(TCP_MONITOR_ID_PARAMS, ctx.params);
	let existing = await ctx.models.tcpMonitors
		.inTeam(ctx.apiTeam.id)
		.where({ id: tcpMonitorId })
		.first();
	if (!existing)
		return apiProblems.notFound({ detail: "TCP monitor not found", instance: problemInstance() });

	let update = await readApiUpdate(ctx.request, writableTcpMonitor(existing), WRITABLE_TCP_MONITOR);
	if (update instanceof Response) return update;
	let { value, changed } = update;

	let changes: Partial<InsertTcpMonitor> = {};
	if (changed.has("name")) changes.name = value.name;
	if (changed.has("host")) changes.host = value.host;
	if (changed.has("port")) changes.port = value.port;
	if (changed.has("timeoutMs")) changes.timeout_ms = value.timeoutMs;
	if (changed.has("intervalSeconds")) changes.interval_seconds = value.intervalSeconds;
	if (changed.has("isEnabled")) changes.is_enabled = value.isEnabled;

	let monitor = unwrap(await ctx.models.tcpMonitors.update(tcpMonitorId, changes));
	return apiSuccess({ monitor: serializeTcpMonitor(monitor) });
}

export default createController(tcpMonitorRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/tcp-monitors/:tcpMonitorId — a single TCP monitor. */
		tcpMonitorShow: {
			middleware: [requireApiKey("tcp-monitors:read")],
			handler: async (ctx) => {
				let { tcpMonitorId } = s.parse(TCP_MONITOR_ID_PARAMS, ctx.params);
				let monitor = await ctx.models.tcpMonitors
					.inTeam(ctx.apiTeam.id)
					.where({ id: tcpMonitorId })
					.first();
				if (!monitor)
					return apiProblems.notFound({
						detail: "TCP monitor not found",
						instance: problemInstance(),
					});
				return apiSuccess({ monitor: serializeTcpMonitor(monitor) });
			},
		},

		/** PATCH /api/v1/tcp-monitors/:tcpMonitorId — merge-patches a TCP monitor. */
		tcpMonitorPatch: {
			middleware: [requireApiKey("tcp-monitors:write")],
			handler: patchTcpMonitor,
		},

		/** PUT /api/v1/tcp-monitors/:tcpMonitorId — updates a TCP monitor's editable fields. */
		tcpMonitorUpdate: {
			middleware: [requireApiKey("tcp-monitors:write")],
			handler: async (ctx) => {
				let { tcpMonitorId } = s.parse(TCP_MONITOR_ID_PARAMS, ctx.params);
				let existing = await ctx.models.tcpMonitors
					.inTeam(ctx.apiTeam.id)
					.where({ id: tcpMonitorId })
					.first();
				if (!existing)
					return apiProblems.notFound({
						detail: "TCP monitor not found",
						instance: problemInstance(),
					});

				let result = await validate(ctx.request, UPDATE_TCP_MONITOR_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let changes: Partial<InsertTcpMonitor> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;
				if (result.data.host !== undefined) changes.host = result.data.host;
				if (result.data.port !== undefined) changes.port = result.data.port;
				if (result.data.timeoutMs !== undefined) changes.timeout_ms = result.data.timeoutMs;
				if (result.data.intervalSeconds !== undefined)
					changes.interval_seconds = result.data.intervalSeconds;
				if (result.data.isEnabled !== undefined) changes.is_enabled = result.data.isEnabled;

				let monitor = unwrap(await ctx.models.tcpMonitors.update(tcpMonitorId, changes));
				return apiSuccess({ monitor: serializeTcpMonitor(monitor) });
			},
		},

		/** DELETE /api/v1/tcp-monitors/:tcpMonitorId — deletes a TCP monitor. */
		tcpMonitorDestroy: {
			middleware: [requireApiKey("tcp-monitors:write")],
			handler: async (ctx) => {
				let { tcpMonitorId } = s.parse(TCP_MONITOR_ID_PARAMS, ctx.params);
				let existing = await ctx.models.tcpMonitors
					.inTeam(ctx.apiTeam.id)
					.where({ id: tcpMonitorId })
					.first();
				if (!existing)
					return apiProblems.notFound({
						detail: "TCP monitor not found",
						instance: problemInstance(),
					});

				unwrap(await ctx.models.tcpMonitors.delete(tcpMonitorId));
				return apiSuccess({ deleted: true });
			},
		},

		/** GET /api/v1/tcp-monitors/:tcpMonitorId/results — paginated check-result history. */
		tcpMonitorResults: {
			middleware: [requireApiKey("tcp-monitors:read")],
			handler: async (ctx) => {
				let { tcpMonitorId } = s.parse(TCP_MONITOR_ID_PARAMS, ctx.params);
				let monitor = await ctx.models.tcpMonitors
					.inTeam(ctx.apiTeam.id)
					.where({ id: tcpMonitorId })
					.first();
				if (!monitor)
					return apiProblems.notFound({
						detail: "TCP monitor not found",
						instance: problemInstance(),
					});

				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				let page = await Pagination.byKeyset(
					ctx.models.tcpMonitorResults.forMonitor(tcpMonitorId),
					{
						orderBy: newestFirst("checked_at"),
						cursor: params.data.cursor,
						limit: params.data.perPage,
					},
				);

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
					id: encodeId("tcpr", row.id),
					status: row.status,
					responseTimeMs: row.response_time_ms,
					errorMessage: row.error_message,
					checkedAt: row.checked_at,
				}));

				return apiPage({ results }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
				});
			},
		},
	},
});
