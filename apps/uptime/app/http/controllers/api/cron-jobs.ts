/**
 * API v1 collection endpoints for cron-job monitors: `GET /api/v1/cron-jobs` lists a
 * team's cron jobs and `POST /api/v1/cron-jobs` creates one. Requires
 * `cron-jobs:read`/`cron-jobs:write` via `requireApiKey`. Does not cover
 * `POST /api/v1/cron-jobs/:cronJobId/ping` — that endpoint is deliberately public and
 * lives in `app/http/controllers/api/cron-job-ping.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Schedule } from "@pkg/cron";
import { BadRequest, Created } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import type { SelectCronJobMonitor } from "~/database/schema";

import CronJobMonitor from "~/app/data/cron-job";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

/** Maps a cron-job monitor row to its public camelCase JSON shape. */
function serializeCronJob(monitor: SelectCronJobMonitor) {
	return {
		id: monitor.id,
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

const CreateCronJobSchema = s.object({
	name: s.string().pipe(checks.minLength(1), checks.maxLength(100)),
	description: s.optional(s.string().pipe(checks.maxLength(500))),
	cronExpression: s.string().pipe(checks.minLength(1)),
	gracePeriodSeconds: s.defaulted(s.number().pipe(checks.min(60), checks.max(86_400)), 300),
	timezone: s.defaulted(s.string(), "UTC"),
	alertOnLate: s.defaulted(s.boolean(), false),
	enabled: s.defaulted(s.boolean(), true),
});

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const cronJobsRoutes = {
	cronJobsIndex: routes.api.v1.cronJobs.index,
	cronJobsCreate: routes.api.v1.cronJobs.create,
};

export default createController(cronJobsRoutes, {
	actions: {
		/** GET /api/v1/cron-jobs — lists the team's cron-job monitors. */
		cronJobsIndex: {
			middleware: [requireApiKey("cron-jobs:read")],
			handler: async (ctx) => {
				let db = getServiceContainer().get(Database);
				let cronJobs = await CronJobMonitor.listByTeam(db, ctx.apiTeam.id);
				return apiSuccess({ cronJobs: cronJobs.map(serializeCronJob) });
			},
		},

		/** POST /api/v1/cron-jobs — creates a cron-job monitor for the team. */
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

				// The failure's message names the reason, the field at fault, and the
				// character index inside the expression the client sent.
				let schedule = Schedule.parse(result.data.cronExpression);
				if (isFailure(schedule)) {
					return apiError("VALIDATION_ERROR", schedule.error.message, BadRequest);
				}

				let db = getServiceContainer().get(Database);
				let cronJob = await CronJobMonitor.create(db, ctx.apiTeam.id, {
					name: result.data.name,
					description: result.data.description ?? null,
					// Stored normalized, so one schedule has one spelling in the database.
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
