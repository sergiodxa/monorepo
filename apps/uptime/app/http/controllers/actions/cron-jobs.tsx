/**
 * Form actions for cron-job monitor create/update/delete. A save that fails validation renders
 * its form again with what was typed and a translated issue beside each field — a rejected cron
 * expression names what is wrong with it — while a save that succeeds flashes and redirects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Form } from "@sdxc/ui";
import type { ValidationError } from "@sdxc/validate";

import { Schedule } from "@sdxc/cron";
import { redirect } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { iife } from "@sdxc/iife";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { FormSubmission } from "~/app/http/validators/form-submission";
import type { SelectCronJobMonitor } from "~/database/schema";

import {
	CreateCronJobSchema,
	CronJobIdSchema,
	UpdateCronJobSchema,
} from "~/app/http/validators/cron-job";
import { calculateNextExpected } from "~/app/models/cron-job-monitors";
import abilities from "~/app/policies/abilities";
import { invalidCronMessage } from "~/app/services/cron-text";
import EditCronJobPage from "~/resources/views/cron-jobs/edit-page";
import NewCronJobPage from "~/resources/views/cron-jobs/new-page";
import routes from "~/routes/web";

/**
 * The `page.cronJobs.form.errors.*` message for each field the schema checks. The grace period
 * has no inline slot in its stepper, so its issue renders at the top of the form instead.
 */
const FIELD_ERRORS: Record<string, string> = {
	name: "name",
	description: "description",
	cron_expression: "cronExpression",
	timezone: "timezone",
	grace_period_seconds: "gracePeriod",
};

/** Fields whose issue shows beside the field; every other issue shows above the form. */
const INLINE_FIELDS = new Set(["name", "description", "cron_expression", "timezone"]);

/**
 * The schema's issues as one translated message per field, in the order they were found.
 * Falls back to the generic message when no issue names a known field, so a refusal always
 * says something.
 */
function formIssues(
	issues: ValidationError["issues"],
	t: Translate,
	generic: string,
): Form.Issue[] {
	let fields = new Set<string>();
	for (let issue of issues) {
		let segment = issue.path?.[0];
		let name = typeof segment === "object" ? String(segment.key) : String(segment);
		if (name in FIELD_ERRORS) fields.add(name);
	}
	if (fields.size === 0) return [{ message: generic }];

	return [...fields].map((name) => {
		let message = t(`page.cronJobs.form.errors.${FIELD_ERRORS[name]}`);
		return INLINE_FIELDS.has(name) ? { message, path: [name] } : { message };
	});
}

/**
 * POST /actions/:team/create-cron-job. Normalizes `cron_expression` before storing, so one
 * schedule always has a single spelling; a rejected submit answers 422 with the form as typed.
 */
export const createCronJob = createAction(routes.actions.cronJob.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateCronJobSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		let submission: FormSubmission = {
			values: ctx.formData,
			issues: formIssues(
				result.error.issues,
				ctx.intl.t,
				ctx.intl.t("actions.createCronJob.errors.generic"),
			),
		};
		return ctx.render(<NewCronJobPage submission={submission} />, { status: 422 });
	}

	let { description, is_enabled, ...values } = result.data;

	let schedule = Schedule.parse(values.cron_expression);
	if (isFailure(schedule)) {
		let submission: FormSubmission = {
			values: ctx.formData,
			issues: [
				{ message: invalidCronMessage(schedule.error, ctx.intl.t), path: ["cron_expression"] },
			],
		};
		return ctx.render(<NewCronJobPage submission={submission} />, { status: 422 });
	}

	let monitor = unwrap(
		await ctx.models.cronJobMonitors.create({
			team_id: ctx.team.id,
			...values,
			cron_expression: schedule.data.toString(),
			description: description || null,
			enabled_at: is_enabled ? Date.now() : null,
		}),
	);

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.createCronJob.success", { name: monitor.name }),
	});
	return redirect(
		routes.app.team.cronJobs.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
});

/**
 * POST /actions/:team/update-cron-job. Compares the normalized cron expression so a re-saved
 * schedule under another spelling registers as unchanged; a rejected submit answers 422 with
 * the form as typed, or redirects back when the monitor it names is not the team's.
 */
export const updateCronJob = createAction(routes.actions.cronJob.update, async (ctx) => {
	let result = await validate(ctx.formData, UpdateCronJobSchema);
	let session = ctx.get(Session);

	/**
	 * Draws `monitor`'s edit page again holding the refused submission, answered as 422, with
	 * the danger zone shown to a member allowed to delete cron jobs.
	 */
	let renderRefusedEdit = async (monitor: SelectCronJobMonitor, submission: FormSubmission) => {
		await ctx.access.load(abilities.cronJobs.delete);
		return ctx.render(
			<EditCronJobPage
				monitor={monitor}
				canDelete={ctx.access.can(abilities.cronJobs.delete)}
				submission={submission}
			/>,
			{ status: 422 },
		);
	};

	if (isFailure(result)) {
		let monitorId = ctx.formData.get("monitor_id");
		let monitor =
			typeof monitorId === "string"
				? await ctx.models.cronJobMonitors.inTeam(ctx.team.id).where({ id: monitorId }).first()
				: null;
		if (monitor) {
			return renderRefusedEdit(monitor, {
				values: ctx.formData,
				issues: formIssues(
					result.error.issues,
					ctx.intl.t,
					ctx.intl.t("actions.updateCronJob.errors.generic"),
				),
			});
		}

		session?.flash("toast", {
			intent: "error",
			message: ctx.intl.t("actions.updateCronJob.errors.generic"),
		});
		return redirect(
			ctx.request.headers.get("Referer") ??
				routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let { monitor_id, description, is_enabled, ...values } = result.data;

	let existing = await ctx.models.cronJobMonitors
		.inTeam(ctx.team.id)
		.where({ id: monitor_id })
		.first();
	if (!existing) return notFound("Not Found");

	let schedule = Schedule.parse(values.cron_expression);
	if (isFailure(schedule)) {
		return renderRefusedEdit(existing, {
			values: ctx.formData,
			issues: [
				{ message: invalidCronMessage(schedule.error, ctx.intl.t), path: ["cron_expression"] },
			],
		});
	}

	let cronExpression = schedule.data.toString();
	let wasEnabled = existing.enabled_at !== null;
	let scheduleChanged =
		existing.cron_expression !== cronExpression || existing.timezone !== values.timezone;

	let nextExpectedAt = iife(() => {
		if (is_enabled)
			return scheduleChanged || !wasEnabled
				? calculateNextExpected(cronExpression, values.timezone)
				: existing.next_expected_at;
		return null;
	});
	let enabledAt = iife(() => {
		if (is_enabled) return wasEnabled ? existing.enabled_at : Date.now();
		return null;
	});
	unwrap(
		await ctx.models.cronJobMonitors.update(monitor_id, {
			...values,
			cron_expression: cronExpression,
			description: description || null,
			enabled_at: enabledAt,
			next_expected_at: nextExpectedAt,
		}),
	);

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.updateCronJob.success", { name: values.name }),
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

	let existing = await ctx.models.cronJobMonitors
		.inTeam(ctx.team.id)
		.where({ id: result.data.monitor_id })
		.first();
	if (!existing) return notFound("Not Found");

	unwrap(await ctx.models.cronJobMonitors.delete(result.data.monitor_id));

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.deleteCronJob.success", { name: existing.name }),
	});
	return redirect(routes.app.team.cronJobs.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});
