/**
 * Form actions for status-page create/update/delete. Each follows the validate →
 * mutate → flash → redirect pattern; create/update also curate the five attached
 * monitor-type id lists after saving the page's own fields.
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
		session?.flash("toast", {
			intent: "error",
			message: `Slug "${values.slug}" is already taken.`,
		});
		return redirect(routes.app.team.statusPages.new.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
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

	let existing = await ctx.models.statusPages
		.inTeam(ctx.team.id)
		.where({ id: status_page_id })
		.first();
	if (!existing) return notFound("Not Found");

	if (await ctx.models.statusPages.isSlugTaken(values.slug, status_page_id)) {
		session?.flash("toast", {
			intent: "error",
			message: `Slug "${values.slug}" is already taken.`,
		});
		return redirect(
			routes.app.team.statusPages.edit.href({ team: ctx.team.slug, statusPageId: status_page_id }),
			{ status: redirect.Status.SeeOther },
		);
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

	let existing = await ctx.models.statusPages
		.inTeam(ctx.team.id)
		.where({ id: result.data.status_page_id })
		.first();
	if (!existing) return notFound("Not Found");

	unwrap(await ctx.models.statusPages.delete(result.data.status_page_id));

	session?.flash("toast", {
		intent: "success",
		message: `Status page "${existing.name}" deleted.`,
	});
	return redirect(routes.app.team.statusPages.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});
