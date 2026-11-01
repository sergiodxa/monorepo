/**
 * Form actions for HTTP monitor create/update/delete/play. Create and update redraw their
 * form with the submitted values and per-field issues when validation fails; every action
 * that succeeds flashes a toast and redirects to the monitor (or list).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RegisteredAccess } from "@sdxc/authz";
import type { Translate } from "@sdxc/i18n";
import type { JobEnqueuer } from "@sdxc/jobs";
import type { ValidationError } from "@sdxc/validate";

import { redirect } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { ok } from "@sdxc/http/response/json";
import { isFailure, unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type {
	MonitorFormErrors,
	MonitorFormField,
	MonitorFormValues,
} from "~/resources/views/monitors/form";

import { renderEditMonitorPage } from "~/app/http/controllers/app/team/monitor-edit";
import { renderNewMonitorPage } from "~/app/http/controllers/app/team/monitor-new";
import { getViewer } from "~/app/http/middleware/auth";
import { CreateMonitorSchema, UpdateMonitorSchema } from "~/app/http/validators/monitor";
import jobs from "~/app/jobs";
import abilities from "~/app/policies/abilities";
import { trackSecondMonitorCreated } from "~/app/services/funnel-events";
import routes from "~/routes/web";

/**
 * The monitor count that means a team came back and added one — see
 * {@link trackSecondMonitorCreated} for why the second and not the first.
 */
const ACTIVATION_MONITOR_COUNT = 2;

const MonitorIdSchema = f.object({ monitor_id: f.field(s.string()) });

/** The fields the create and update forms post, in the order their issues are read. */
const MONITOR_FORM_FIELDS: readonly MonitorFormField[] = [
	"name",
	"url",
	"expected_status",
	"interval_seconds",
	"location_hint",
];

/** The status a redrawn form answers with: the request was understood, its values were not. */
const INVALID_FORM_STATUS = 400;

/** What a submission typed into each monitor field, as posted, so a redraw shows it unchanged. */
function submittedValues(form: FormData): MonitorFormValues {
	let values: MonitorFormValues = {};
	for (let field of MONITOR_FORM_FIELDS) {
		let value = form.get(field);
		if (typeof value === "string") values[field] = value;
	}
	return values;
}

/**
 * The translated message for each monitor field a validation failure names; issues on any
 * other field (the hidden `monitor_id`) name no visible field and are left out.
 */
function fieldErrors(error: ValidationError, t: Translate): MonitorFormErrors {
	let messages: Record<MonitorFormField, string> = {
		name: t("page.monitorForm.errors.name"),
		url: t("page.monitorForm.errors.url"),
		expected_status: t("page.monitorForm.errors.expectedStatus"),
		interval_seconds: t("page.monitorForm.errors.interval"),
		location_hint: t("page.monitorForm.errors.region"),
	};
	let errors: MonitorFormErrors = {};
	for (let issue of error.issues) {
		let segment = issue.path?.[0];
		let key = typeof segment === "object" && segment !== null ? segment.key : segment;
		let field = MONITOR_FORM_FIELDS.find((name) => name === key);
		if (field) errors[field] = messages[field];
	}
	return errors;
}

/**
 * Enqueues an on-demand check for a monitor, settling billing here so a queued check is
 * always one that's allowed to run. `checks.run` **fails open**: only a subscription
 * known to be `inactive` refuses.
 *
 * @returns Whether the check was enqueued, which is what lets the caller tell the visitor their check is going to happen.
 */
async function ping(
	access: RegisteredAccess,
	enqueuer: JobEnqueuer,
	monitorId: string,
): Promise<boolean> {
	await access.load(abilities.checks.run);
	if (!access.can(abilities.checks.run)) return false;

	await enqueuer.enqueue(jobs.checkHttp, {
		id: `${monitorId}:manual:${generateUUID()}`,
		monitorId,
		scheduledAt: Date.now(),
	});
	return true;
}

/**
 * POST /actions/:team/create-monitor. The first check is skipped without a
 * subscription, like every check.
 */
export const createMonitor = createAction(routes.actions.monitor.http.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateMonitorSchema);
	let session = ctx.get(Session);
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	if (isFailure(result)) {
		return renderNewMonitorPage(
			{ values: submittedValues(ctx.formData), errors: fieldErrors(result.error, ctx.intl.t) },
			{ status: INVALID_FORM_STATUS },
		);
	}

	let monitor = unwrap(
		await ctx.models.monitors.create({
			team_id: ctx.team.id,
			author_id: viewer.id,
			...result.data,
		}),
	);
	await ping(ctx.access, ctx.jobs, monitor.id);

	/**
	 * Counted after creation, so the number is the team's total including this one, and
	 * compared for equality rather than `>=` so the event fires exactly once per team no
	 * matter how many monitors they go on to add.
	 */
	let monitorCount = await ctx.models.monitors.inTeam(ctx.team.id).count();
	if (monitorCount === ACTIVATION_MONITOR_COUNT) {
		trackSecondMonitorCreated(ctx.log, {
			teamId: ctx.team.id,
			authorId: viewer.id,
			monitorType: "http",
			monitorCount,
		});
	}

	session?.flash("toast", { intent: "success", message: `Monitor "${monitor.name}" created.` });
	return redirect(
		routes.app.team.monitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
});

/**
 * POST /actions/:team/update-monitor. A failed submission redraws the edit page of the monitor
 * it names, and 404s when that monitor isn't the team's, as a valid one does.
 */
export const updateMonitor = createAction(routes.actions.monitor.http.update, async (ctx) => {
	let result = await validate(ctx.formData, UpdateMonitorSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		let monitorId = ctx.formData.get("monitor_id");
		let monitor =
			typeof monitorId === "string"
				? await ctx.models.monitors.inTeam(ctx.team.id).find(monitorId)
				: null;
		if (!monitor) return notFound("Not Found");

		return renderEditMonitorPage(
			monitor,
			{ values: submittedValues(ctx.formData), errors: fieldErrors(result.error, ctx.intl.t) },
			{ status: INVALID_FORM_STATUS },
		);
	}

	let { monitor_id, ...changes } = result.data;
	let existing = await ctx.models.monitors.inTeam(ctx.team.id).find(monitor_id);
	if (!existing) return notFound("Not Found");

	unwrap(await ctx.models.monitors.update(monitor_id, changes));

	session?.flash("toast", { intent: "success", message: "Monitor updated." });
	return redirect(
		routes.app.team.monitors.show.href({ team: ctx.team.slug, monitorId: monitor_id }),
		{
			status: redirect.Status.SeeOther,
		},
	);
});

/** DELETE /actions/:team/delete-monitor */
export const deleteMonitor = createAction(routes.actions.monitor.http.delete, async (ctx) => {
	let result = await validate(ctx.formData, MonitorIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.monitors.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let existing = await ctx.models.monitors.inTeam(ctx.team.id).find(result.data.monitor_id);
	if (!existing) return notFound("Not Found");

	unwrap(await ctx.models.monitors.delete(existing.id));

	session?.flash("toast", { intent: "success", message: `Monitor "${existing.name}" deleted.` });
	return redirect(routes.app.team.monitors.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/**
 * POST /actions/:team/play-monitor — triggers an on-demand check. The toast reflects
 * whether the check was actually queued, since nothing runs without a subscription.
 */
export const playMonitor = createAction(routes.actions.monitor.http.play, async (ctx) => {
	let result = await validate(ctx.formData, MonitorIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.monitors.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let monitor = await ctx.models.monitors.inTeam(ctx.team.id).find(result.data.monitor_id);
	if (!monitor) return notFound("Not Found");

	let queued = await ping(ctx.access, ctx.jobs, monitor.id);

	/**
	 * A JSON caller is a hydrated page that won't navigate, so the outcome goes in the
	 * body instead of a redirect and flash that would surface on some later, unrelated
	 * navigation. The status returned is the baseline before the queued check runs.
	 */
	if (ctx.request.headers.get("accept")?.includes("application/json")) {
		return ok({ queued, status: monitor.last_status, checkedAt: monitor.last_checked_at });
	}

	session?.flash(
		"toast",
		queued
			? {
					intent: "success",
					message: ctx.intl.t("actions.checks.queued", { name: monitor.name }),
				}
			: { intent: "error", message: ctx.intl.t("actions.checks.subscriptionRequired") },
	);
	return redirect(
		routes.app.team.monitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
});
