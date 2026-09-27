/**
 * API v1 item endpoints for a single cron-job monitor: get/update/delete, requiring
 * `cron-jobs:read`/`cron-jobs:write` via `requireApiKey`. Updating the cron
 * expression (or the timezone alone) recomputes `nextExpectedAt`. Does not cover the
 * public ping endpoint — see `app/http/controllers/api/cron-job-ping.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Schedule } from "@sdxc/cron";
import * as s from "@sdxc/json-schema";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { InsertCronJobMonitor, SelectCronJobMonitor } from "~/database/schema";

import CronJobMonitor from "~/app/data/cron-job";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { CRON_JOB_ID_PARAMS, UPDATE_CRON_JOB_BODY } from "~/app/http/openapi/cron-jobs";
import { apiProblems, invalidField, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { encodeId } from "~/app/services/typed-id";
import { cronJobRoutes } from "~/routes/api-groups";

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

export default createController(cronJobRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/cron-jobs/:cronJobId — a single cron-job monitor. */
		cronJobShow: {
			middleware: [requireApiKey("cron-jobs:read")],
			handler: async (ctx) => {
				let { cronJobId } = s.parse(CRON_JOB_ID_PARAMS, ctx.params);
				let cronJob = await CronJobMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, cronJobId);
				if (!cronJob)
					return apiProblems.notFound({
						detail: "Cron job not found",
						instance: problemInstance(),
					});
				return apiSuccess({ cronJob: serializeCronJob(cronJob) });
			},
		},

		/**
		 * PUT /api/v1/cron-jobs/:cronJobId — updates a cron-job monitor's editable fields. A
		 * rejected cron expression's error names the reason, field, and character index
		 * verbatim; an accepted one is stored normalized, so one schedule has one spelling.
		 */
		cronJobUpdate: {
			middleware: [requireApiKey("cron-jobs:write")],
			handler: async (ctx) => {
				let { cronJobId } = s.parse(CRON_JOB_ID_PARAMS, ctx.params);
				let existing = await CronJobMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, cronJobId);
				if (!existing)
					return apiProblems.notFound({
						detail: "Cron job not found",
						instance: problemInstance(),
					});

				let result = await validate(ctx.request, UPDATE_CRON_JOB_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let changes: Partial<InsertCronJobMonitor> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;
				if (result.data.description !== undefined) changes.description = result.data.description;
				if (result.data.gracePeriodSeconds !== undefined)
					changes.grace_period_seconds = result.data.gracePeriodSeconds;
				if (result.data.timezone !== undefined) changes.timezone = result.data.timezone;
				if (result.data.alertOnLate !== undefined) changes.alert_on_late = result.data.alertOnLate;
				if (result.data.enabled !== undefined)
					changes.enabled_at = result.data.enabled ? Date.now() : null;

				if (result.data.cronExpression !== undefined) {
					let timezone = result.data.timezone ?? existing.timezone;
					let schedule = Schedule.parse(result.data.cronExpression);
					if (isFailure(schedule)) {
						return invalidField(schedule.error.message, "/cronExpression");
					}
					changes.cron_expression = schedule.data.toString();
					changes.next_expected_at = CronJobMonitor.calculateNextExpected(
						changes.cron_expression,
						timezone,
					);
				} else if (
					result.data.timezone !== undefined &&
					result.data.timezone !== existing.timezone
				) {
					changes.next_expected_at = CronJobMonitor.calculateNextExpected(
						existing.cron_expression,
						result.data.timezone,
					);
				}

				let cronJob = await CronJobMonitor.updateById(ctx.db, cronJobId, changes);
				return apiSuccess({ cronJob: serializeCronJob(cronJob) });
			},
		},

		/** DELETE /api/v1/cron-jobs/:cronJobId — deletes a cron-job monitor. */
		cronJobDestroy: {
			middleware: [requireApiKey("cron-jobs:write")],
			handler: async (ctx) => {
				let { cronJobId } = s.parse(CRON_JOB_ID_PARAMS, ctx.params);
				let existing = await CronJobMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, cronJobId);
				if (!existing)
					return apiProblems.notFound({
						detail: "Cron job not found",
						instance: problemInstance(),
					});

				await CronJobMonitor.deleteById(ctx.db, cronJobId);
				return apiSuccess({ deleted: true });
			},
		},
	},
});
