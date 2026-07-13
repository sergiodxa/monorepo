/**
 * Form actions for cron-job monitor create/update/delete. Each follows the validate →
 * mutate → flash → redirect pattern: on validation failure the visitor is sent back to
 * the form with an error toast; on success, to the monitor (or list).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { notFound } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";

import CronJobMonitor from "~/app/data/cron-job";
import {
	CreateCronJobSchema,
	CronJobIdSchema,
	UpdateCronJobSchema,
} from "~/app/http/validators/cron-job";
import routes from "~/routes/web";

const INVALID_CRON_MESSAGE = "Please enter a valid cron expression.";
const GENERIC_ERROR_MESSAGE = "Please check the cron job details and try again.";

/** POST /actions/:team/create-cron-job */
export const createCronJob = createAction(routes.actions.createCronJob, async (ctx) => {
	let result = await validate(ctx.formData, CreateCronJobSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", { intent: "error", message: GENERIC_ERROR_MESSAGE });
		return redirect(routes.app.team.cronJobs.new.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let { description, is_enabled, ...values } = result.data;

	try {
		CronJobMonitor.validateCronExpression(values.cron_expression, values.timezone);
	} catch {
		session?.flash("toast", { intent: "error", message: INVALID_CRON_MESSAGE });
		return redirect(routes.app.team.cronJobs.new.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let monitor = await CronJobMonitor.create(db, ctx.team.id, {
		...values,
		description: description || null,
		enabled_at: is_enabled ? Date.now() : null,
	});

	session?.flash("toast", { intent: "success", message: `Cron job "${monitor.name}" created.` });
	return redirect(
		routes.app.team.cronJobs.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
});

/** POST /actions/:team/update-cron-job */
export const updateCronJob = createAction(routes.actions.updateCronJob, async (ctx) => {
	let result = await validate(ctx.formData, UpdateCronJobSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", { intent: "error", message: GENERIC_ERROR_MESSAGE });
		return redirect(
			ctx.request.headers.get("Referer") ??
				routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let { monitor_id, description, is_enabled, ...values } = result.data;

	let db = getServiceContainer().get(Database);
	let existing = await CronJobMonitor.findByIdForTeam(db, ctx.team.id, monitor_id);
	if (!existing) return notFound("Not Found");

	try {
		CronJobMonitor.validateCronExpression(values.cron_expression, values.timezone);
	} catch {
		session?.flash("toast", { intent: "error", message: INVALID_CRON_MESSAGE });
		return redirect(
			routes.app.team.cronJobs.edit.href({ team: ctx.team.slug, monitorId: monitor_id }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let wasEnabled = existing.enabled_at !== null;
	let scheduleChanged =
		existing.cron_expression !== values.cron_expression || existing.timezone !== values.timezone;

	await CronJobMonitor.updateById(db, monitor_id, {
		...values,
		description: description || null,
		enabled_at: is_enabled ? (wasEnabled ? existing.enabled_at : Date.now()) : null,
		next_expected_at: is_enabled
			? scheduleChanged || !wasEnabled
				? CronJobMonitor.calculateNextExpected(values.cron_expression, values.timezone)
				: existing.next_expected_at
			: null,
	});

	session?.flash("toast", { intent: "success", message: "Cron job updated." });
	return redirect(
		routes.app.team.cronJobs.show.href({ team: ctx.team.slug, monitorId: monitor_id }),
		{ status: redirect.Status.SeeOther },
	);
});

/** DELETE /actions/:team/delete-cron-job */
export const deleteCronJob = createAction(routes.actions.deleteCronJob, async (ctx) => {
	let result = await validate(ctx.formData, CronJobIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.cronJobs.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let existing = await CronJobMonitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
	if (!existing) return notFound("Not Found");

	await CronJobMonitor.deleteById(db, result.data.monitor_id);

	session?.flash("toast", { intent: "success", message: `Cron job "${existing.name}" deleted.` });
	return redirect(routes.app.team.cronJobs.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});
