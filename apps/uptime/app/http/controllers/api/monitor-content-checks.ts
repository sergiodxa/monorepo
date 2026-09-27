/**
 * API v1 endpoints for a monitor's content checks: list/create under
 * `monitors:read`/`monitors:write`, and delete a single check by id, all scoped to a
 * monitor owned by the caller's team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Created } from "@sdxc/http/status-code";
import * as s from "@sdxc/json-schema";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { SelectMonitorContentCheck } from "~/database/schema";

import ContentCheck from "~/app/data/content-check";
import Monitor from "~/app/data/monitor";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import idempotent from "~/app/http/middleware/idempotency";
import requireApiKey from "~/app/http/middleware/require-api-key";
import {
	CONTENT_CHECK_PARAMS,
	CREATE_CONTENT_CHECK_BODY,
	MONITOR_ID_PARAMS,
} from "~/app/http/openapi/monitors";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { apiPage, NEWEST_FIRST, PAGING } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";
import { monitorContentChecksRoutes } from "~/routes/api-groups";

/** Maps a content-check row to its public camelCase JSON shape. */
function serializeContentCheck(check: SelectMonitorContentCheck) {
	return {
		id: encodeId("chk", check.id),
		monitorId: encodeId("mon", check.monitor_id),
		type: check.type,
		value: check.value,
		caseSensitive: check.case_sensitive,
		isEnabled: check.is_enabled,
		createdAt: check.created_at,
		updatedAt: check.updated_at,
	};
}

export default createController(monitorContentChecksRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/monitors/:monitorId/content-checks — lists a monitor's content checks. */
		monitorContentChecksIndex: {
			middleware: [requireApiKey("monitors:read")],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MONITOR_ID_PARAMS, ctx.params);
				let monitor = await Monitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, monitorId);
				if (!monitor)
					return apiProblems.notFound({ detail: "Monitor not found", instance: problemInstance() });

				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				// Chaining returns new queries, so the same one both counts and pages.
				let query = ContentCheck.byMonitorQuery(ctx.db, monitorId);

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

				return apiPage({ contentChecks: page.data.items.map(serializeContentCheck) }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
					total: await query.count(),
				});
			},
		},

		/** POST /api/v1/monitors/:monitorId/content-checks — creates a content check. */
		monitorContentChecksCreate: {
			middleware: [requireApiKey("monitors:write"), idempotent],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MONITOR_ID_PARAMS, ctx.params);
				let monitor = await Monitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, monitorId);
				if (!monitor)
					return apiProblems.notFound({ detail: "Monitor not found", instance: problemInstance() });

				let result = await validate(ctx.request, CREATE_CONTENT_CHECK_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let contentCheck = await ContentCheck.create(ctx.db, monitorId, {
					type: result.data.type,
					value: result.data.value,
					case_sensitive: result.data.caseSensitive,
					is_enabled: result.data.isEnabled,
				});

				return apiSuccess({ contentCheck: serializeContentCheck(contentCheck) }, Created);
			},
		},

		/** DELETE /api/v1/monitors/:monitorId/content-checks/:contentCheckId — deletes a content check. */
		monitorContentCheckDestroy: {
			middleware: [requireApiKey("monitors:write")],
			handler: async (ctx) => {
				let { monitorId, contentCheckId } = s.parse(CONTENT_CHECK_PARAMS, ctx.params);
				let monitor = await Monitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, monitorId);
				if (!monitor)
					return apiProblems.notFound({ detail: "Monitor not found", instance: problemInstance() });

				let contentCheck = await ContentCheck.findByIdForMonitor(ctx.db, monitorId, contentCheckId);
				if (!contentCheck)
					return apiProblems.notFound({
						detail: "Content check not found",
						instance: problemInstance(),
					});

				await ContentCheck.deleteById(ctx.db, contentCheckId);
				return apiSuccess({ success: true });
			},
		},
	},
});
