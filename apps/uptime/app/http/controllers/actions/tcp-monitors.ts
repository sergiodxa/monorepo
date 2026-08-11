/**
 * Form actions for TCP monitor create/update/delete/manual-check. Each follows the
 * validate → mutate → flash → redirect pattern: on validation failure the visitor is
 * sent back to the form with an error toast; on success, to the monitor (or list).
 *
 * The manual check is the one action here that performs billable work: it opens the
 * connection inline, so unlike the HTTP monitors' "run check" — which only enqueues, and is
 * billed by the job that later carries it out — nothing downstream of this request would
 * ever meter it. Both halves of that live in {@link checkTcpMonitor}: the entitlement gate
 * that decides whether the connection is attempted at all, and the meter event for the one
 * that was.
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
import { createAction } from "remix/fetch-router";
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
 * POST /actions/:team/check-tcp-monitor — triggers an immediate on-demand check.
 *
 * A connection this attempts is one ping, the same as one the scheduled sweep attempts, so
 * it is gated the same way and metered the same way. Everything that returns before
 * {@link checkTcpConnection} — a rejected form, a monitor this team does not own, an owner
 * without entitlement — performed no check and bills nothing; only work actually done
 * reaches the meter.
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
	 * `stateFor`, not `isActive`: an owner whose entitlement cannot be determined still gets
	 * their check, because refusing a paying customer over an inconclusive lookup is the
	 * worse of the two mistakes. The same reading every other manual check takes.
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
	 * Keyed on the history row this check just wrote, which is the same key the scheduled
	 * sweep bills a TCP check under: it is unique, already persisted, and belongs to exactly
	 * one connection attempt, so a manual check and a scheduled one can never be handed the
	 * same id and neither can be billed twice. Deferred rather than awaited, like every
	 * meter event on a response path — the visitor is waiting on a result this request
	 * already has, and ingestion is best-effort and logs its own failures.
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
