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
import { Created } from "@sdxc/http/status-code";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { SelectCronJobMonitor } from "~/database/schema";

import catchValidationError from "~/app/http/middleware/catch-validation-error";
import idempotent from "~/app/http/middleware/idempotency";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { CREATE_CRON_JOB_BODY } from "~/app/http/openapi/cron-jobs";
import { apiProblems, invalidField, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { apiPage, NEWEST_FIRST, PAGING } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";
import { cronJobsRoutes } from "~/routes/api-groups";

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

export default createController(cronJobsRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/cron-jobs — lists the team's cron-job monitors. */
		cronJobsIndex: {
			middleware: [requireApiKey("cron-jobs:read")],
			handler: async (ctx) => {
				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				// Chaining returns new queries, so the same one both counts and pages.
				let query = ctx.models.cronJobMonitors.inTeam(ctx.apiTeam.id);

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
			middleware: [requireApiKey("cron-jobs:write"), idempotent],
			handler: async (ctx) => {
				let result = await validate(ctx.request, CREATE_CRON_JOB_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let schedule = Schedule.parse(result.data.cronExpression);
				if (isFailure(schedule)) {
					return invalidField(schedule.error.message, "/cronExpression");
				}

				let cronJob = unwrap(
					await ctx.models.cronJobMonitors.create({
						team_id: ctx.apiTeam.id,
						name: result.data.name,
						description: result.data.description ?? null,
						cron_expression: schedule.data.toString(),
						grace_period_seconds: result.data.gracePeriodSeconds,
						timezone: result.data.timezone,
						alert_on_late: result.data.alertOnLate,
						enabled_at: result.data.enabled ? Date.now() : null,
					}),
				);

				return apiSuccess({ cronJob: serializeCronJob(cronJob) }, Created);
			},
		},
	},
});
