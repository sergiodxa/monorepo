/**
 * Form actions for cron-job monitor create/update/delete. Each follows the validate →
 * mutate → flash → redirect pattern: on validation failure the visitor is sent back to
 * the form with an error toast, translated and — for a rejected cron expression — naming
 * why the parser refused it; on success, to the monitor (or list).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Schedule } from "@pkg/cron";
import { redirect } from "@pkg/http/response";
import { notFound } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import CronJobMonitor from "~/app/data/cron-job";
import {
	CreateCronJobSchema,
	CronJobIdSchema,
	UpdateCronJobSchema,
} from "~/app/http/validators/cron-job";
import { invalidCronMessage } from "~/app/lib/cron-text";
import routes from "~/routes/web";

/** POST /actions/:team/create-cron-job */
export const createCronJob = createAction(routes.actions.cronJob.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateCronJobSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: ctx.i18next.t("actions.createCronJob.errors.generic"),
		});
		return redirect(routes.app.team.cronJobs.new.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let { description, is_enabled, ...values } = result.data;

	let schedule = Schedule.parse(values.cron_expression);
	if (isFailure(schedule)) {
		session?.flash("toast", {
			intent: "error",
			message: invalidCronMessage(schedule.error, ctx.i18next.t),
		});
		return redirect(routes.app.team.cronJobs.new.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let monitor = await CronJobMonitor.create(db, ctx.team.id, {
		...values,
		// Stored normalized, so one schedule has one spelling in the database and in logs.
		cron_expression: schedule.data.toString(),
		description: description || null,
		enabled_at: is_enabled ? Date.now() : null,
	});

	session?.flash("toast", {
		intent: "success",
		message: ctx.i18next.t("actions.createCronJob.success", { name: monitor.name }),
	});
	return redirect(
		routes.app.team.cronJobs.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
});

/** POST /actions/:team/update-cron-job */
export const updateCronJob = createAction(routes.actions.cronJob.update, async (ctx) => {
	let result = await validate(ctx.formData, UpdateCronJobSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: ctx.i18next.t("actions.updateCronJob.errors.generic"),
		});
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

	let schedule = Schedule.parse(values.cron_expression);
	if (isFailure(schedule)) {
		session?.flash("toast", {
			intent: "error",
			message: invalidCronMessage(schedule.error, ctx.i18next.t),
		});
		return redirect(
			routes.app.team.cronJobs.edit.href({ team: ctx.team.slug, monitorId: monitor_id }),
			{ status: redirect.Status.SeeOther },
		);
	}

	// Compared normalized, so re-saving the same schedule spelled differently isn't
	// treated as a reschedule.
	let cronExpression = schedule.data.toString();
	let wasEnabled = existing.enabled_at !== null;
	let scheduleChanged =
		existing.cron_expression !== cronExpression || existing.timezone !== values.timezone;

	await CronJobMonitor.updateById(db, monitor_id, {
		...values,
		cron_expression: cronExpression,
		description: description || null,
		enabled_at: is_enabled ? (wasEnabled ? existing.enabled_at : Date.now()) : null,
		next_expected_at: is_enabled
			? scheduleChanged || !wasEnabled
				? CronJobMonitor.calculateNextExpected(cronExpression, values.timezone)
				: existing.next_expected_at
			: null,
	});

	session?.flash("toast", {
		intent: "success",
		message: ctx.i18next.t("actions.updateCronJob.success", { name: values.name }),
	});
	return redirect(
		routes.app.team.cronJobs.show.href({ team: ctx.team.slug, monitorId: monitor_id }),
		{ status: redirect.Status.SeeOther },
	);
});

/** DELETE /actions/:team/delete-cron-job */
export const deleteCronJob = createAction(routes.actions.cronJob.delete, async (ctx) => {
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

	session?.flash("toast", {
		intent: "success",
		message: ctx.i18next.t("actions.deleteCronJob.success", { name: existing.name }),
	});
	return redirect(routes.app.team.cronJobs.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});
