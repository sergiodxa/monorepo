/**
 * Form actions for HTTP monitor create/update/delete/play. Each follows the
 * validate → mutate → flash → redirect pattern: on validation failure the visitor is
 * sent back to the form with an error toast; on success, to the monitor (or list).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { notFound } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";

import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import { CreateMonitorSchema, UpdateMonitorSchema } from "~/app/http/validators/monitor";
import routes from "~/routes/web";

const MonitorIdSchema = f.object({ monitor_id: f.field(s.string()) });

/** POST /actions/:team/create-monitor */
export const createMonitor = createAction(routes.actions.monitor.http.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateMonitorSchema);
	let session = ctx.get(Session);
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the monitor details and try again.",
		});
		return redirect(routes.app.team.monitors.new.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let monitor = await Monitor.create(db, ctx.team.id, viewer.id, result.data);
	// Kicks off a first check right away; skipped without a subscription, like every check.
	await Monitor.ping(db, monitor.id, ctx.team.owner_id);

	session?.flash("toast", { intent: "success", message: `Monitor "${monitor.name}" created.` });
	return redirect(
		routes.app.team.monitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
});

/** POST /actions/:team/update-monitor */
export const updateMonitor = createAction(routes.actions.monitor.http.update, async (ctx) => {
	let result = await validate(ctx.formData, UpdateMonitorSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the monitor details and try again.",
		});
		return redirect(
			ctx.request.headers.get("Referer") ??
				routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
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

	if (ctx.team.owner_id !== ctx.membership.subject_id && ctx.membership.role !== "admin") {
		return notFound("Not Found");
	}

	let db = getServiceContainer().get(Database);
	let existing = await Monitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
	if (!existing) return notFound("Not Found");

	await Monitor.deleteById(db, result.data.monitor_id);

	session?.flash("toast", { intent: "success", message: `Monitor "${existing.name}" deleted.` });
	return redirect(routes.app.team.monitors.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** POST /actions/:team/play-monitor — triggers an on-demand check. */
export const playMonitor = createAction(routes.actions.monitor.http.play, async (ctx) => {
	let result = await validate(ctx.formData, MonitorIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.monitors.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
	if (!monitor) return notFound("Not Found");

	let queued = await Monitor.ping(db, monitor.id, ctx.team.owner_id);

	// Nothing was enqueued without a subscription, so don't claim a check is coming.
	session?.flash(
		"toast",
		queued
			? { intent: "success", message: `Check queued for "${monitor.name}".` }
			: { intent: "error", message: "An active subscription is required to run a check." },
	);
	return redirect(
		routes.app.team.monitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
});
