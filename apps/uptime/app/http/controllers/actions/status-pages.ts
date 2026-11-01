/**
 * Form actions for status-page create/update/delete. A refused create or update renders its
 * form again with every posted value and an issue beside each field to fix, answered as 400;
 * create/update also curate the five attached monitor-type id lists after saving the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { FormSubmission } from "~/app/http/validators/form-submission";

import { translateIssues } from "~/app/http/validators/form-submission";
import {
	CreateStatusPageSchema,
	StatusPageIdSchema,
	UpdateStatusPageSchema,
} from "~/app/http/validators/status-page";
import routes from "~/routes/web";

/** The fields the form can flag; an issue elsewhere reads as the form's own. */
const ISSUE_FIELDS = new Set(["name", "slug", "title"]);

/** The submission as the form page renders it again, each schema issue in the page's own words. */
function pageSubmission(
	t: (key: string) => string,
	values: FormData,
	issues: ReadonlyArray<{
		message: string;
		path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>;
	}>,
): FormSubmission {
	return {
		values,
		issues: translateIssues(issues, (field) =>
			field !== undefined && ISSUE_FIELDS.has(field)
				? { field, message: t(`page.statusPages.form.issues.${field}`) }
				: { field: undefined, message: t("page.statusPages.form.issues.generic") },
		),
	};
}

/** The issue a slug another page already uses renders under the slug field. */
function slugTaken(t: (key: string) => string, values: FormData): FormSubmission {
	return {
		values,
		issues: [{ message: t("page.statusPages.form.issues.slugTaken"), path: ["slug"] }],
	};
}

/** POST /actions/:team/create-status-page */
export const createStatusPage = createAction(routes.actions.statusPage.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateStatusPageSchema);
	let session = ctx.get(Session);

	/** Renders the new-page form again, loading the page only on this path. */
	let sendBack = async (submission: FormSubmission) => {
		let { renderNewStatusPagePage } =
			await import("~/app/http/controllers/app/team/status-page-new");
		return renderNewStatusPagePage(submission);
	};

	if (isFailure(result)) {
		return sendBack(pageSubmission(ctx.intl.t, ctx.formData, result.error.issues));
	}

	let {
		monitor_ids,
		dns_monitor_ids,
		tcp_monitor_ids,
		flow_monitor_ids,
		cron_job_ids,
		description,
		logo_url,
		...values
	} = result.data;

	if (await ctx.models.statusPages.isSlugTaken(values.slug)) {
		return sendBack(slugTaken(ctx.intl.t, ctx.formData));
	}

	let page = unwrap(
		await ctx.models.statusPages.create({
			...values,
			team_id: ctx.team.id,
			description: description || null,
			logo_url: logo_url || null,
			custom_domain: null,
		}),
	);

	await Promise.all([
		ctx.models.statusPages.setMonitors(page.id, monitor_ids),
		ctx.models.statusPages.setDnsMonitors(page.id, dns_monitor_ids),
		ctx.models.statusPages.setTcpMonitors(page.id, tcp_monitor_ids),
		ctx.models.statusPages.setFlowMonitors(page.id, flow_monitor_ids),
		ctx.models.statusPages.setCronJobs(page.id, cron_job_ids),
	]);

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("page.statusPages.toasts.created", { name: page.name }),
	});
	return redirect(routes.app.team.statusPages.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** POST /actions/:team/update-status-page */
export const updateStatusPage = createAction(routes.actions.statusPage.update, async (ctx) => {
	let result = await validate(ctx.formData, UpdateStatusPageSchema);
	let session = ctx.get(Session);

	let statusPageId = isFailure(result)
		? ctx.formData.get("status_page_id")
		: result.data.status_page_id;
	let existing =
		typeof statusPageId === "string"
			? await ctx.models.statusPages.inTeam(ctx.team.id).where({ id: statusPageId }).first()
			: null;
	if (!existing) return notFound("Not Found");

	/** Renders this page's edit form again, loading the page only on this path. */
	let sendBack = async (submission: FormSubmission) => {
		let { renderEditStatusPagePage } =
			await import("~/app/http/controllers/app/team/status-page-edit");
		return renderEditStatusPagePage(existing, submission);
	};

	if (isFailure(result)) {
		return sendBack(pageSubmission(ctx.intl.t, ctx.formData, result.error.issues));
	}

	let {
		status_page_id,
		monitor_ids,
		dns_monitor_ids,
		tcp_monitor_ids,
		flow_monitor_ids,
		cron_job_ids,
		description,
		logo_url,
		...values
	} = result.data;

	if (await ctx.models.statusPages.isSlugTaken(values.slug, status_page_id)) {
		return sendBack(slugTaken(ctx.intl.t, ctx.formData));
	}

	unwrap(
		await ctx.models.statusPages.update(status_page_id, {
			...values,
			description: description || null,
			logo_url: logo_url || null,
		}),
	);

	await Promise.all([
		ctx.models.statusPages.setMonitors(status_page_id, monitor_ids),
		ctx.models.statusPages.setDnsMonitors(status_page_id, dns_monitor_ids),
		ctx.models.statusPages.setTcpMonitors(status_page_id, tcp_monitor_ids),
		ctx.models.statusPages.setFlowMonitors(status_page_id, flow_monitor_ids),
		ctx.models.statusPages.setCronJobs(status_page_id, cron_job_ids),
	]);

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("page.statusPages.toasts.updated", { name: values.name }),
	});
	return redirect(routes.app.team.statusPages.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** DELETE /actions/:team/delete-status-page */
export const deleteStatusPage = createAction(routes.actions.statusPage.delete, async (ctx) => {
	let result = await validate(ctx.formData, StatusPageIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.statusPages.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let existing = await ctx.models.statusPages
		.inTeam(ctx.team.id)
		.where({ id: result.data.status_page_id })
		.first();
	if (!existing) return notFound("Not Found");

	unwrap(await ctx.models.statusPages.delete(result.data.status_page_id));

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("page.statusPages.toasts.deleted", { name: existing.name }),
	});
	return redirect(routes.app.team.statusPages.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});
