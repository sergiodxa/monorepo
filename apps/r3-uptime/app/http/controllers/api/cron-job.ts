/**
 * API v1 item endpoints for a single cron-job monitor: get/update/delete, requiring
 * `cron-jobs:read`/`cron-jobs:write` via `requireApiKey`. Updating the cron
 * expression (or the timezone alone) recomputes `nextExpectedAt`. Does not cover the
 * public ping endpoint — see `app/http/controllers/api/cron-job-ping.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, NotFound } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { InsertCronJobMonitor, SelectCronJobMonitor } from "~/database/schema";

import CronJobMonitor from "~/app/data/cron-job";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

const CronJobIdParams = s.object({ cronJobId: s.string() });

/** Maps a cron-job monitor row to the OLD APP's exact camelCase JSON shape. */
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

const UpdateCronJobSchema = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(100))),
	description: s.optional(s.string().pipe(checks.maxLength(500))),
	cronExpression: s.optional(s.string().pipe(checks.minLength(1))),
	gracePeriodSeconds: s.optional(s.number().pipe(checks.min(60), checks.max(86_400))),
	timezone: s.optional(s.string()),
	alertOnLate: s.optional(s.boolean()),
	enabled: s.optional(s.boolean()),
});

/** GET /api/v1/cron-jobs/:cronJobId — a single cron-job monitor. */
export const cronJobShow = createAction(routes.api.v1.cronJobShow, async (ctx) => {
	let { cronJobId } = s.parse(CronJobIdParams, ctx.params);
	let db = getServiceContainer().get(Database);
	let cronJob = await CronJobMonitor.findByIdForTeam(db, ctx.apiTeam.id, cronJobId);
	if (!cronJob) return apiError("NOT_FOUND", "Cron job not found", NotFound);
	return apiSuccess({ cronJob: serializeCronJob(cronJob) });
});

/** PUT /api/v1/cron-jobs/:cronJobId — updates a cron-job monitor's editable fields. */
export const cronJobUpdate = createAction(routes.api.v1.cronJobUpdate, async (ctx) => {
	let { cronJobId } = s.parse(CronJobIdParams, ctx.params);
	let db = getServiceContainer().get(Database);
	let existing = await CronJobMonitor.findByIdForTeam(db, ctx.apiTeam.id, cronJobId);
	if (!existing) return apiError("NOT_FOUND", "Cron job not found", NotFound);

	let result = await validate(ctx.request, UpdateCronJobSchema);
	if (isFailure(result)) {
		return apiError(
			"VALIDATION_ERROR",
			result.error.issues.map((issue) => issue.message).join(", "),
			BadRequest,
		);
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
		try {
			CronJobMonitor.validateCronExpression(result.data.cronExpression, timezone);
		} catch {
			return apiError("VALIDATION_ERROR", "Invalid cron expression", BadRequest);
		}
		changes.cron_expression = result.data.cronExpression;
		changes.next_expected_at = CronJobMonitor.calculateNextExpected(
			result.data.cronExpression,
			timezone,
		);
	} else if (result.data.timezone !== undefined && result.data.timezone !== existing.timezone) {
		changes.next_expected_at = CronJobMonitor.calculateNextExpected(
			existing.cron_expression,
			result.data.timezone,
		);
	}

	let cronJob = await CronJobMonitor.updateById(db, cronJobId, changes);
	return apiSuccess({ cronJob: serializeCronJob(cronJob) });
});

/** DELETE /api/v1/cron-jobs/:cronJobId — deletes a cron-job monitor. */
export const cronJobDestroy = createAction(routes.api.v1.cronJobDestroy, async (ctx) => {
	let { cronJobId } = s.parse(CronJobIdParams, ctx.params);
	let db = getServiceContainer().get(Database);
	let existing = await CronJobMonitor.findByIdForTeam(db, ctx.apiTeam.id, cronJobId);
	if (!existing) return apiError("NOT_FOUND", "Cron job not found", NotFound);

	await CronJobMonitor.deleteById(db, cronJobId);
	return apiSuccess({ deleted: true });
});
