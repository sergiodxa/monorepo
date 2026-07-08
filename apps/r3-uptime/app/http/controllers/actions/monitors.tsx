/**
 * Form actions for HTTP monitor create/update/delete/play. Each follows the
 * validate → mutate → flash → redirect pattern: on validation failure the visitor is
 * sent back to the form with an error toast; on success, to the monitor (or list).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/fetch-router";

import { redirect } from "@pkg/http/response";
import { notFound } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { Database } from "remix/data-table";
import { Session } from "remix/session";

import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import { CreateMonitorSchema, UpdateMonitorSchema } from "~/app/http/validators/monitor";
import routes from "~/routes/web";

const MonitorIdSchema = f.object({ monitor_id: f.field(s.string()) });

/** POST /actions/:team/create-monitor */
export async function createMonitor(ctx: RequestContext<{ team: string }>) {
	let result = await validate(ctx.formData, CreateMonitorSchema);
	let session = ctx.get(Session);
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the monitor details and try again.",
		});
		return redirect(routes.app.team.monitorNew.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let monitor = await Monitor.create(db, ctx.team.id, viewer.id, result.data);
	await Monitor.ping(monitor.id);

	session?.flash("toast", { intent: "success", message: `Monitor "${monitor.name}" created.` });
	return redirect(
		routes.app.team.monitorShow.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
}

/** POST /actions/:team/update-monitor */
export async function updateMonitor(ctx: RequestContext<{ team: string }>) {
	let result = await validate(ctx.formData, UpdateMonitorSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the monitor details and try again.",
		});
		return redirect(
			ctx.request.headers.get("Referer") ?? routes.app.team.dashboard.href({ team: ctx.team.slug }),
			{
				status: redirect.Status.SeeOther,
			},
		);
	}

	let db = getServiceContainer().get(Database);
	let { monitor_id, ...changes } = result.data;
	let existing = await Monitor.findByIdForTeam(db, ctx.team.id, monitor_id);
	if (!existing) return notFound("Not Found");

	await Monitor.updateById(db, monitor_id, changes);

	session?.flash("toast", { intent: "success", message: "Monitor updated." });
	return redirect(
		routes.app.team.monitorShow.href({ team: ctx.team.slug, monitorId: monitor_id }),
		{
			status: redirect.Status.SeeOther,
		},
	);
}

/** DELETE /actions/:team/delete-monitor */
export async function deleteMonitor(ctx: RequestContext<{ team: string }>) {
	let result = await validate(ctx.formData, MonitorIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.httpMonitors.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	if (ctx.team.owner_id !== ctx.membership.subject_id && ctx.membership.role !== "admin") {
		return notFound("Not Found");
	}

	let db = getServiceContainer().get(Database);
	let existing = await Monitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
	if (!existing) return notFound("Not Found");

	await Monitor.deleteById(db, result.data.monitor_id);

	session?.flash("toast", { intent: "success", message: `Monitor "${existing.name}" deleted.` });
	return redirect(routes.app.team.httpMonitors.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
}

/** POST /actions/:team/play-monitor — triggers an on-demand check. */
export async function playMonitor(ctx: RequestContext<{ team: string }>) {
	let result = await validate(ctx.formData, MonitorIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.httpMonitors.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
	if (!monitor) return notFound("Not Found");

	await Monitor.ping(monitor.id);

	session?.flash("toast", { intent: "success", message: `Check queued for "${monitor.name}".` });
	return redirect(
		routes.app.team.monitorShow.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
}
