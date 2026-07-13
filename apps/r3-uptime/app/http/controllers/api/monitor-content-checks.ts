/**
 * API v1 endpoints for a monitor's content checks: list/create under
 * `monitors:read`/`monitors:write`, and delete a single check by id, all scoped to a
 * monitor owned by the caller's team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, Created, NotFound } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import type { SelectMonitorContentCheck } from "~/database/schema";

import ContentCheck from "~/app/data/content-check";
import Monitor from "~/app/data/monitor";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

const CONTENT_CHECK_TYPES = ["contains", "not_contains", "regex"] as const;

const MonitorIdParams = s.object({ monitorId: s.string() });
const ContentCheckParams = s.object({ monitorId: s.string(), contentCheckId: s.string() });

/** Maps a content-check row to the OLD APP's exact camelCase JSON shape. */
function serializeContentCheck(check: SelectMonitorContentCheck) {
	return {
		id: check.id,
		monitorId: check.monitor_id,
		type: check.type,
		value: check.value,
		caseSensitive: check.case_sensitive,
		isEnabled: check.is_enabled,
		createdAt: check.created_at,
		updatedAt: check.updated_at,
	};
}

const CreateContentCheckSchema = s
	.object({
		type: s.enum_(CONTENT_CHECK_TYPES),
		value: s.string().pipe(checks.minLength(1)),
		caseSensitive: s.defaulted(s.boolean(), false),
		isEnabled: s.defaulted(s.boolean(), true),
	})
	.refine((value) => {
		if (value.type !== "regex") return true;
		try {
			new RegExp(value.value);
			return true;
		} catch {
			return false;
		}
	}, "Invalid regular expression");

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const monitorContentChecksRoutes = {
	monitorContentChecksIndex: routes.api.v1.monitors.contentChecks.index,
	monitorContentChecksCreate: routes.api.v1.monitors.contentChecks.create,
	monitorContentCheckDestroy: routes.api.v1.monitors.contentChecks.destroy,
};

export default createController(monitorContentChecksRoutes, {
	actions: {
		/** GET /api/v1/monitors/:monitorId/content-checks — lists a monitor's content checks. */
		monitorContentChecksIndex: {
			middleware: [requireApiKey("monitors:read")],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let monitor = await Monitor.findByIdForTeam(db, ctx.apiTeam.id, monitorId);
				if (!monitor) return apiError("NOT_FOUND", "Monitor not found", NotFound);

				let contentChecks = await ContentCheck.listByMonitor(db, monitorId);
				return apiSuccess({ contentChecks: contentChecks.map(serializeContentCheck) });
			},
		},

		/** POST /api/v1/monitors/:monitorId/content-checks — creates a content check. */
		monitorContentChecksCreate: {
			middleware: [requireApiKey("monitors:write")],
			handler: async (ctx) => {
				let { monitorId } = s.parse(MonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let monitor = await Monitor.findByIdForTeam(db, ctx.apiTeam.id, monitorId);
				if (!monitor) return apiError("NOT_FOUND", "Monitor not found", NotFound);

				let result = await validate(ctx.request, CreateContentCheckSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let contentCheck = await ContentCheck.create(db, monitorId, {
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
				let { monitorId, contentCheckId } = s.parse(ContentCheckParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let monitor = await Monitor.findByIdForTeam(db, ctx.apiTeam.id, monitorId);
				if (!monitor) return apiError("NOT_FOUND", "Monitor not found", NotFound);

				let contentCheck = await ContentCheck.findByIdForMonitor(db, monitorId, contentCheckId);
				if (!contentCheck) return apiError("NOT_FOUND", "Content check not found", NotFound);

				await ContentCheck.deleteById(db, contentCheckId);
				return apiSuccess({ success: true });
			},
		},
	},
});
