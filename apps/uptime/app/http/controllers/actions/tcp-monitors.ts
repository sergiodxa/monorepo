/**
 * Form actions for TCP monitor create/update/delete/manual-check, each following the
 * validate → mutate → flash → redirect pattern. The manual check opens the connection
 * inline as billable work, so {@link checkTcpMonitor} carries the entitlement gate, the
 * Analytics Engine point, and the meter event for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { notFound } from "@pkg/http/response/html";
import { PolarClient } from "@pkg/polar";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { waitUntil } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { TcpCheckStatus } from "~/app/services/tcp-check";

import Subscription from "~/app/data/subscription";
import TcpMonitor from "~/app/data/tcp-monitor";
import {
	CreateTcpMonitorSchema,
	TcpMonitorIdSchema,
	UpdateTcpMonitorSchema,
} from "~/app/http/validators/tcp-monitor";
import { notifyTcpResult } from "~/app/services/alerts";
import { writePingResult } from "~/app/services/analytics";
import { ingestPings } from "~/app/services/ping-meter";
import { checkTcpConnection } from "~/app/services/tcp-check";
import routes from "~/routes/web";

/** POST /actions/:team/create-tcp-monitor */
export const createTcpMonitor = createAction(routes.actions.monitor.tcp.create, async (ctx) => {
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
export const updateTcpMonitor = createAction(routes.actions.monitor.tcp.update, async (ctx) => {
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
export const deleteTcpMonitor = createAction(routes.actions.monitor.tcp.delete, async (ctx) => {
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

/**
 * POST /actions/:team/check-tcp-monitor — triggers an immediate on-demand check, gated and
 * metered exactly like the scheduled sweep. Everything that returns before
 * {@link checkTcpConnection} performs no check and bills nothing.
 */
export const checkTcpMonitor = createAction(routes.actions.monitor.tcp.check, async (ctx) => {
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

	/**
	 * Reads entitlement via `stateFor`, so an owner whose state cannot be determined still
	 * gets their check — refusing a paying customer over an inconclusive lookup is the worse
	 * mistake. The same reading every other manual check takes.
	 */
	if ((await Subscription.stateFor(db, ctx.team.owner_id)) === "inactive") {
		session?.flash("toast", {
			intent: "error",
			message: ctx.i18next.t("actions.checks.subscriptionRequired"),
		});
		return redirect(
			routes.app.team.tcpMonitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let checkResult = await checkTcpConnection(monitor.host, monitor.port, monitor.timeout_ms);
	let resultId = await TcpMonitor.recordCheckResult(db, monitor.id, checkResult);

	/**
	 * Written here, at the same point the scheduled sweep writes it, so a manual and a
	 * cron check produce indistinguishable rows. Doubles aren't nullable, so a refused or
	 * timed-out check reports zero latency, the dataset's existing spelling for "no measurement".
	 */
	writePingResult({
		monitorId: monitor.id,
		teamId: ctx.team.id,
		type: "tcp",
		status: checkResult.status,
		responseTimeMs: checkResult.responseTimeMs ?? 0,
	});

	/**
	 * Keyed on the history row this check just wrote, which is unique and already persisted,
	 * so a manual check and a scheduled one can never be billed twice. Deferred like every
	 * meter event on a response path: ingestion is best-effort and logs its own failures.
	 */
	waitUntil(
		ingestPings(getServiceContainer().get(PolarClient), [
			{
				externalId: `ping:${resultId}`,
				ownerId: ctx.team.owner_id,
				teamId: ctx.team.id,
				monitorId: monitor.id,
				type: "tcp",
			},
		]),
	);

	await notifyTcpResult(
		db,
		ctx.email,
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
