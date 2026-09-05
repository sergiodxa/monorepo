/**
 * API v1 collection endpoints for cron-job monitors: `GET /api/v1/cron-jobs` lists a
 * team's cron jobs and `POST /api/v1/cron-jobs` creates one. Requires
 * `cron-jobs:read`/`cron-jobs:write` via `requireApiKey`. Does not cover
 * `POST /api/v1/cron-jobs/:cronJobId/ping`, which lives in
 * `app/http/controllers/api/cron-job-ping.ts` and requires `cron-jobs:ping`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Schedule } from "@sdxc/cron";
import { BadRequest, Created, InternalServerError, Ok } from "@sdxc/http/status-code";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/router";

import type { SelectCronJobMonitor } from "~/database/schema";

import CronJobMonitor from "~/app/data/cron-job";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import {
	DEFAULT_TIMEZONE,
	isSupportedTimezone,
	UNKNOWN_TIMEZONE_MESSAGE,
} from "~/app/lib/timezones";
import { apiError, apiSuccess } from "~/app/services/api-response";
import { apiPage, NEWEST_FIRST, PAGING } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";
import routes from "~/routes/web";

/** Maps a cron-job monitor row to its public camelCase JSON shape. */
function serializeCronJob(monitor: SelectCronJobMonitor) {
	return {
		id: encodeId("cron", monitor.id),
		name: monitor.name,
		description: monitor.description,
		cronExpression: monitor.cron_expression,
		gracePeriodSeconds: monitor.grace_period_seconds,
		timezone: monitor.timezone,
		status: monitor.status,
		alertOnLate: monitor.alert_on_late,
		lastPingAt: monitor.last_ping_at,
		nextExpectedAt: monitor.next_expected_at,
		enabledAt: monitor.enabled_at,
		createdAt: monitor.created_at,
		updatedAt: monitor.updated_at,
	};
}

/**
 * `timezone` is checked against the runtime's IANA list rather than taken as free text: the
 * zone decides when a job counts as late, so an unmatched value would schedule it against the
 * wrong wall clock.
 */
const CreateCronJobSchema = s.object({
	name: s.string().pipe(checks.minLength(1), checks.maxLength(100)),
	description: s.optional(s.string().pipe(checks.maxLength(500))),
	cronExpression: s.string().pipe(checks.minLength(1)),
	gracePeriodSeconds: s.defaulted(s.number().pipe(checks.min(60), checks.max(86_400)), 300),
	timezone: s.defaulted(
		s.string().refine(isSupportedTimezone, UNKNOWN_TIMEZONE_MESSAGE),
		DEFAULT_TIMEZONE,
	),
	alertOnLate: s.defaulted(s.boolean(), false),
	enabled: s.defaulted(s.boolean(), true),
});

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const cronJobsRoutes = {
	cronJobsIndex: routes.api.v1.cronJobs.index,
	cronJobsCreate: routes.api.v1.cronJobs.create,
};

export default createController(cronJobsRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/cron-jobs — lists the team's cron-job monitors. */
		cronJobsIndex: {
			middleware: [requireApiKey("cron-jobs:read")],
			handler: async (ctx) => {
				let db = getServiceContainer().get(Database);

				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params)) return apiError("BAD_REQUEST", params.error.message, BadRequest);

				// Chaining returns new queries, so the same one both counts and pages.
				let query = CronJobMonitor.listByTeamQuery(db, ctx.apiTeam.id);

				let page = await Pagination.byKeyset(query, {
					orderBy: NEWEST_FIRST,
					cursor: params.data.cursor,
					limit: params.data.perPage,
				});

				if (isFailure(page)) {
					if (page.error instanceof InvalidCursorError) {
						return apiError("BAD_REQUEST", page.error.message, BadRequest);
					}
					return apiError("INTERNAL", page.error.message, InternalServerError);
				}

				return apiPage({ cronJobs: page.data.items.map(serializeCronJob) }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
					total: await query.count(),
				});
			},
		},

		/**
		 * POST /api/v1/cron-jobs — creates a cron-job monitor for the team. The cron
		 * expression is stored normalized, so one schedule has a single spelling in the
		 * database.
		 */
		cronJobsCreate: {
			middleware: [requireApiKey("cron-jobs:write")],
			handler: async (ctx) => {
				let result = await validate(ctx.request, CreateCronJobSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let schedule = Schedule.parse(result.data.cronExpression);
				if (isFailure(schedule)) {
					return apiError("VALIDATION_ERROR", schedule.error.message, BadRequest);
				}

				let db = getServiceContainer().get(Database);
				let cronJob = await CronJobMonitor.create(db, ctx.apiTeam.id, {
					name: result.data.name,
					description: result.data.description ?? null,
					cron_expression: schedule.data.toString(),
					grace_period_seconds: result.data.gracePeriodSeconds,
					timezone: result.data.timezone,
					alert_on_late: result.data.alertOnLate,
					enabled_at: result.data.enabled ? Date.now() : null,
				});

				return apiSuccess({ cronJob: serializeCronJob(cronJob) }, Created);
			},
		},
	},
});
