/**
 * Form actions for TCP monitor create/update/delete/manual-check. Each follows the
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
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";
import { Resend } from "resend";

import type { TcpCheckStatus } from "~/app/services/tcp-check";

import TcpMonitor from "~/app/data/tcp-monitor";
import {
	CreateTcpMonitorSchema,
	TcpMonitorIdSchema,
	UpdateTcpMonitorSchema,
} from "~/app/http/validators/tcp-monitor";
import { notifyTcpResult } from "~/app/services/alerts";
import { checkTcpConnection } from "~/app/services/tcp-check";
import routes from "~/routes/web";

/** POST /actions/:team/create-tcp-monitor */
export const createTcpMonitor = createAction(routes.actions.createTcpMonitor, async (ctx) => {
	let result = await validate(ctx.formData, CreateTcpMonitorSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the TCP monitor details and try again.",
		});
		return redirect(routes.app.team.tcpMonitors.new.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let monitor = await TcpMonitor.create(db, ctx.team.id, result.data);

	session?.flash("toast", { intent: "success", message: `TCP monitor "${monitor.name}" created.` });
	return redirect(
		routes.app.team.tcpMonitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
});

/** POST /actions/:team/update-tcp-monitor */
export const updateTcpMonitor = createAction(routes.actions.updateTcpMonitor, async (ctx) => {
	let result = await validate(ctx.formData, UpdateTcpMonitorSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the TCP monitor details and try again.",
		});
		return redirect(
			ctx.request.headers.get("Referer") ??
				routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let db = getServiceContainer().get(Database);
	let { monitor_id, ...values } = result.data;
	let existing = await TcpMonitor.findByIdForTeam(db, ctx.team.id, monitor_id);
	if (!existing) return notFound("Not Found");

	await TcpMonitor.updateById(db, monitor_id, values);

	session?.flash("toast", { intent: "success", message: "TCP monitor updated." });
	return redirect(
		routes.app.team.tcpMonitors.show.href({ team: ctx.team.slug, monitorId: monitor_id }),
		{ status: redirect.Status.SeeOther },
	);
});

/** DELETE /actions/:team/delete-tcp-monitor */
export const deleteTcpMonitor = createAction(routes.actions.deleteTcpMonitor, async (ctx) => {
	let result = await validate(ctx.formData, TcpMonitorIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.tcpMonitors.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let existing = await TcpMonitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
	if (!existing) return notFound("Not Found");

	await TcpMonitor.deleteById(db, result.data.monitor_id);

	session?.flash("toast", {
		intent: "success",
		message: `TCP monitor "${existing.name}" deleted.`,
	});
	return redirect(routes.app.team.tcpMonitors.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** POST /actions/:team/check-tcp-monitor — triggers an immediate on-demand check. */
export const checkTcpMonitor = createAction(routes.actions.checkTcpMonitor, async (ctx) => {
	let result = await validate(ctx.formData, TcpMonitorIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.tcpMonitors.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let monitor = await TcpMonitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
	if (!monitor) return notFound("Not Found");

	let checkResult = await checkTcpConnection(monitor.host, monitor.port, monitor.timeout_ms);
	await TcpMonitor.recordCheckResult(db, monitor.id, checkResult);
	await notifyTcpResult(
		db,
		getServiceContainer().get(Resend),
		monitor,
		monitor.last_status as TcpCheckStatus | null,
		checkResult,
	);

	session?.flash("toast", { intent: "success", message: `Checked "${monitor.name}".` });
	return redirect(
		routes.app.team.tcpMonitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
});
