/**
 * API v1 item endpoints for a single TCP monitor: get/update/delete
 * (`tcp-monitors:read`/`tcp-monitors:write`) and paginated check-result history
 * (`tcp-monitors:read`), scoped to a monitor owned by the caller's team.
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

import type { InsertTcpMonitor, SelectTcpMonitor } from "~/database/schema";

import TcpMonitor from "~/app/data/tcp-monitor";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import { apiPage, newestFirst, PAGING } from "~/app/services/pagination";
import { encodeId, typedId } from "~/app/services/typed-id";
import routes from "~/routes/web";

const TcpMonitorIdParams = s.object({ tcpMonitorId: typedId("tcpm") });

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

const UpdateTcpMonitorSchema = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	host: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	port: s.optional(s.number().pipe(checks.min(1), checks.max(65_535))),
	timeoutMs: s.optional(s.number().pipe(checks.min(100), checks.max(60_000))),
	intervalSeconds: s.optional(s.number().pipe(checks.min(60), checks.max(86_400))),
	isEnabled: s.optional(s.boolean()),
});

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const tcpMonitorRoutes = {
	tcpMonitorShow: routes.api.v1.tcpMonitors.show,
	tcpMonitorUpdate: routes.api.v1.tcpMonitors.update,
	tcpMonitorDestroy: routes.api.v1.tcpMonitors.destroy,
	tcpMonitorResults: routes.api.v1.tcpMonitors.results,
};

export default createController(tcpMonitorRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/tcp-monitors/:tcpMonitorId — a single TCP monitor. */
		tcpMonitorShow: {
			middleware: [requireApiKey("tcp-monitors:read")],
			handler: async (ctx) => {
				let { tcpMonitorId } = s.parse(TcpMonitorIdParams, ctx.params);
				let monitor = await TcpMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, tcpMonitorId);
				if (!monitor) return apiError("NOT_FOUND", "TCP monitor not found", NotFound);
				return apiSuccess({ monitor: serializeTcpMonitor(monitor) });
			},
		},

		/** PUT /api/v1/tcp-monitors/:tcpMonitorId — updates a TCP monitor's editable fields. */
		tcpMonitorUpdate: {
			middleware: [requireApiKey("tcp-monitors:write")],
			handler: async (ctx) => {
				let { tcpMonitorId } = s.parse(TcpMonitorIdParams, ctx.params);
				let existing = await TcpMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, tcpMonitorId);
				if (!existing) return apiError("NOT_FOUND", "TCP monitor not found", NotFound);

				let result = await validate(ctx.request, UpdateTcpMonitorSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let changes: Partial<InsertTcpMonitor> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;
				if (result.data.host !== undefined) changes.host = result.data.host;
				if (result.data.port !== undefined) changes.port = result.data.port;
				if (result.data.timeoutMs !== undefined) changes.timeout_ms = result.data.timeoutMs;
				if (result.data.intervalSeconds !== undefined)
					changes.interval_seconds = result.data.intervalSeconds;
				if (result.data.isEnabled !== undefined) changes.is_enabled = result.data.isEnabled;

				let monitor = await TcpMonitor.updateById(ctx.db, tcpMonitorId, changes);
				return apiSuccess({ monitor: serializeTcpMonitor(monitor) });
			},
		},

		/** DELETE /api/v1/tcp-monitors/:tcpMonitorId — deletes a TCP monitor. */
		tcpMonitorDestroy: {
			middleware: [requireApiKey("tcp-monitors:write")],
			handler: async (ctx) => {
				let { tcpMonitorId } = s.parse(TcpMonitorIdParams, ctx.params);
				let existing = await TcpMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, tcpMonitorId);
				if (!existing) return apiError("NOT_FOUND", "TCP monitor not found", NotFound);

				await TcpMonitor.deleteById(ctx.db, tcpMonitorId);
				return apiSuccess({ deleted: true });
			},
		},

		/** GET /api/v1/tcp-monitors/:tcpMonitorId/results — paginated check-result history. */
		tcpMonitorResults: {
			middleware: [requireApiKey("tcp-monitors:read")],
			handler: async (ctx) => {
				let { tcpMonitorId } = s.parse(TcpMonitorIdParams, ctx.params);
				let monitor = await TcpMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, tcpMonitorId);
				if (!monitor) return apiError("NOT_FOUND", "TCP monitor not found", NotFound);

				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params)) return apiError("BAD_REQUEST", params.error.message, BadRequest);

				let page = await Pagination.byKeyset(TcpMonitor.resultsQuery(ctx.db, tcpMonitorId), {
					orderBy: newestFirst("checked_at"),
					cursor: params.data.cursor,
					limit: params.data.perPage,
				});

				if (isFailure(page)) {
					if (page.error instanceof InvalidCursorError) {
						return apiError("BAD_REQUEST", page.error.message, BadRequest);
					}
					return apiError("INTERNAL", page.error.message, InternalServerError);
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
