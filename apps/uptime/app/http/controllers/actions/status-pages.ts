/**
 * Form actions for status-page create/update/delete. Each follows the validate →
 * mutate → flash → redirect pattern; create/update also curate the four attached
 * monitor-type id lists after saving the page's own fields.
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
import { createAction } from "remix/router";
import { Session } from "remix/session";

import StatusPage from "~/app/data/status-page";
import {
	CreateStatusPageSchema,
	StatusPageIdSchema,
	UpdateStatusPageSchema,
} from "~/app/http/validators/status-page";
import routes from "~/routes/web";

/** POST /actions/:team/create-status-page */
export const createStatusPage = createAction(routes.actions.statusPage.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateStatusPageSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the status page details and try again.",
		});
		return redirect(routes.app.team.statusPages.new.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let {
		monitor_ids,
		dns_monitor_ids,
		tcp_monitor_ids,
		cron_job_ids,
		description,
		logo_url,
		...values
	} = result.data;

	if (await StatusPage.isSlugTaken(db, values.slug)) {
		session?.flash("toast", {
			intent: "error",
			message: `Slug "${values.slug}" is already taken.`,
		});
		return redirect(routes.app.team.statusPages.new.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let page = await StatusPage.create(db, ctx.team.id, {
		...values,
		description: description || null,
		logo_url: logo_url || null,
		custom_domain: null,
	});

	await Promise.all([
		StatusPage.setMonitors(db, page.id, monitor_ids),
		StatusPage.setDnsMonitors(db, page.id, dns_monitor_ids),
		StatusPage.setTcpMonitors(db, page.id, tcp_monitor_ids),
		StatusPage.setCronJobs(db, page.id, cron_job_ids),
	]);

	session?.flash("toast", { intent: "success", message: `Status page "${page.name}" created.` });
	return redirect(routes.app.team.statusPages.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** POST /actions/:team/update-status-page */
export const updateStatusPage = createAction(routes.actions.statusPage.update, async (ctx) => {
	let result = await validate(ctx.formData, UpdateStatusPageSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the status page details and try again.",
		});
		return redirect(
			ctx.request.headers.get("Referer") ??
				routes.app.team.statusPages.index.href({ team: ctx.team.slug }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let db = getServiceContainer().get(Database);
	let {
		status_page_id,
		monitor_ids,
		dns_monitor_ids,
		tcp_monitor_ids,
		cron_job_ids,
		description,
		logo_url,
		...values
	} = result.data;

	let existing = await StatusPage.findByIdForTeam(db, ctx.team.id, status_page_id);
	if (!existing) return notFound("Not Found");

	if (await StatusPage.isSlugTaken(db, values.slug, status_page_id)) {
		session?.flash("toast", {
			intent: "error",
			message: `Slug "${values.slug}" is already taken.`,
		});
		return redirect(
			routes.app.team.statusPages.edit.href({ team: ctx.team.slug, statusPageId: status_page_id }),
			{ status: redirect.Status.SeeOther },
		);
	}

	await StatusPage.updateById(db, status_page_id, {
		...values,
		description: description || null,
		logo_url: logo_url || null,
	});

	await Promise.all([
		StatusPage.setMonitors(db, status_page_id, monitor_ids),
		StatusPage.setDnsMonitors(db, status_page_id, dns_monitor_ids),
		StatusPage.setTcpMonitors(db, status_page_id, tcp_monitor_ids),
		StatusPage.setCronJobs(db, status_page_id, cron_job_ids),
	]);

	session?.flash("toast", { intent: "success", message: "Status page updated." });
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

	let db = getServiceContainer().get(Database);
	let existing = await StatusPage.findByIdForTeam(db, ctx.team.id, result.data.status_page_id);
	if (!existing) return notFound("Not Found");

	await StatusPage.deleteById(db, result.data.status_page_id);

	session?.flash("toast", {
		intent: "success",
		message: `Status page "${existing.name}" deleted.`,
	});
	return redirect(routes.app.team.statusPages.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});
