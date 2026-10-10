/**
 * API v1 item endpoints for a single cron-job monitor: get/update/delete, requiring
 * `cron-jobs:read`/`cron-jobs:write` via `requireApiKey`. Updating the cron
 * expression (or the timezone alone) recomputes `nextExpectedAt`. Does not cover the
 * public ping endpoint — see `app/http/controllers/api/cron-job-ping.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { Schedule } from "@sdxc/cron";
import * as s from "@sdxc/json-schema";
import { issuesFrom } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { InsertCronJobMonitor, SelectCronJobMonitor } from "~/database/schema";

import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import {
	CRON_JOB_ID_PARAMS,
	UPDATE_CRON_JOB_BODY,
	WRITABLE_CRON_JOB,
} from "~/app/http/openapi/cron-jobs";
import { calculateNextExpected } from "~/app/models/cron-job-monitors";
import { apiProblems, invalidField, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { readApiUpdate } from "~/app/services/api-update";
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

/**
 * The cron job's writable members as the API reads them, the target a `PATCH` merge
 * patch applies to. `enabled` stands for `enabledAt`.
 */
function writableCronJob(monitor: SelectCronJobMonitor) {
	return {
		name: monitor.name,
		description: monitor.description,
		cronExpression: monitor.cron_expression,
		gracePeriodSeconds: monitor.grace_period_seconds,
		timezone: monitor.timezone,
		alertOnLate: monitor.alert_on_late,
		enabled: monitor.enabled_at !== null,
	};
}

/**
 * Applies a `PATCH` merge patch to one cron job. Only changed members are written. A
 * rejected cron expression's error names the reason, field, and character index verbatim;
 * an accepted one is stored normalized, and a new schedule or zone recomputes `nextExpectedAt`.
 *
 * @param ctx - The request, after `requireApiKey("cron-jobs:write")`.
 * @returns The updated job; a 404 for a job outside the team, before the body is read.
 */
async function patchCronJob(ctx: RequestContext): Promise<Response> {
	let { cronJobId } = s.parse(CRON_JOB_ID_PARAMS, ctx.params);
	let existing = await ctx.models.cronJobMonitors
		.inTeam(ctx.apiTeam.id)
		.where({ id: cronJobId })
		.first();
	if (!existing)
		return apiProblems.notFound({ detail: "Cron job not found", instance: problemInstance() });

	let update = await readApiUpdate(ctx.request, writableCronJob(existing), WRITABLE_CRON_JOB);
	if (update instanceof Response) return update;
	let { value, changed } = update;

	let changes: Partial<InsertCronJobMonitor> = {};
	if (changed.has("name")) changes.name = value.name;
	if (changed.has("description")) changes.description = value.description ?? null;
	if (changed.has("gracePeriodSeconds")) changes.grace_period_seconds = value.gracePeriodSeconds;
	if (changed.has("timezone")) changes.timezone = value.timezone;
	if (changed.has("alertOnLate")) changes.alert_on_late = value.alertOnLate;
	if (changed.has("enabled")) changes.enabled_at = value.enabled ? Date.now() : null;

	if (changed.has("cronExpression")) {
		let schedule = Schedule.parse(value.cronExpression);
		if (isFailure(schedule)) return invalidField(schedule.error.message, "/cronExpression");
		changes.cron_expression = schedule.data.toString();
		changes.next_expected_at = calculateNextExpected(changes.cron_expression, value.timezone);
	} else if (changed.has("timezone")) {
		changes.next_expected_at = calculateNextExpected(existing.cron_expression, value.timezone);
	}

	let cronJob = unwrap(await ctx.models.cronJobMonitors.update(cronJobId, changes));
	return apiSuccess({ cronJob: serializeCronJob(cronJob) });
}

export default createController(cronJobRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/cron-jobs/:cronJobId — a single cron-job monitor. */
		cronJobShow: {
			middleware: [requireApiKey("cron-jobs:read")],
			handler: async (ctx) => {
				let { cronJobId } = s.parse(CRON_JOB_ID_PARAMS, ctx.params);
				let cronJob = await ctx.models.cronJobMonitors
					.inTeam(ctx.apiTeam.id)
					.where({ id: cronJobId })
					.first();
				if (!cronJob)
					return apiProblems.notFound({
						detail: "Cron job not found",
						instance: problemInstance(),
					});
				return apiSuccess({ cronJob: serializeCronJob(cronJob) });
			},
		},

		/** PATCH /api/v1/cron-jobs/:cronJobId — merge-patches a cron-job monitor. */
		cronJobPatch: {
			middleware: [requireApiKey("cron-jobs:write")],
			handler: patchCronJob,
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
				let existing = await ctx.models.cronJobMonitors
					.inTeam(ctx.apiTeam.id)
					.where({ id: cronJobId })
					.first();
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
					changes.next_expected_at = calculateNextExpected(changes.cron_expression, timezone);
				} else if (
					result.data.timezone !== undefined &&
					result.data.timezone !== existing.timezone
				) {
					changes.next_expected_at = calculateNextExpected(
						existing.cron_expression,
						result.data.timezone,
					);
				}

				let cronJob = unwrap(await ctx.models.cronJobMonitors.update(cronJobId, changes));
				return apiSuccess({ cronJob: serializeCronJob(cronJob) });
			},
		},

		/** DELETE /api/v1/cron-jobs/:cronJobId — deletes a cron-job monitor. */
		cronJobDestroy: {
			middleware: [requireApiKey("cron-jobs:write")],
			handler: async (ctx) => {
				let { cronJobId } = s.parse(CRON_JOB_ID_PARAMS, ctx.params);
				let existing = await ctx.models.cronJobMonitors
					.inTeam(ctx.apiTeam.id)
					.where({ id: cronJobId })
					.first();
				if (!existing)
					return apiProblems.notFound({
						detail: "Cron job not found",
						instance: problemInstance(),
					});

				unwrap(await ctx.models.cronJobMonitors.delete(cronJobId));
				return apiSuccess({ deleted: true });
			},
		},
	},
});
