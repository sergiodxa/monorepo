/**
 * Form actions for flow monitor create/update/delete, each following validate → mutate →
 * flash → redirect. A flow's source is checked against the team's verified domains before
 * storage, using the same `inspectFlowSource` the sweep applies, so form and sweep share one
 * message for one rule. {@link checkFlowMonitor} runs the flow inline and meters it directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { notFound } from "@pkg/http/response/html";
import { ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { waitUntil } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { BillablePing } from "~/app/services/ping-meter";

import FlowMonitor from "~/app/data/flow-monitor";
import Subscription from "~/app/data/subscription";
import TeamDomain from "~/app/data/team-domain";
import {
	CreateFlowMonitorSchema,
	FlowMonitorIdSchema,
	UpdateFlowMonitorSchema,
} from "~/app/http/validators/flow-monitor";
import { writePingResult } from "~/app/services/analytics";
import { inspectFlowSource, runFlowCheck } from "~/app/services/flow-check";
import { ingestPings } from "~/app/services/ping-meter";
import routes from "~/routes/web";

/** POST /actions/:team/create-flow-monitor */
export const createFlowMonitor = createAction(routes.actions.monitor.flow.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateFlowMonitorSchema);
	let session = ctx.get(Session);
	let newHref = routes.app.team.flowMonitors.new.href({ team: ctx.team.slug });

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the flow monitor details and try again.",
		});
		return redirect(newHref, { status: redirect.Status.SeeOther });
	}

	let db = getServiceContainer().get(Database);
	let verifiedDomains = await TeamDomain.verifiedHostnamesForTeam(db, ctx.team.id);
	let inspection = inspectFlowSource(result.data.source, verifiedDomains);
	if (!inspection.ok) {
		session?.flash("toast", { intent: "error", message: inspection.message });
		return redirect(newHref, { status: redirect.Status.SeeOther });
	}

	let monitor = await FlowMonitor.create(db, ctx.team.id, {
		name: result.data.name,
		source: result.data.source,
		is_enabled: result.data.is_enabled,
		interval_seconds: Number(result.data.interval_seconds),
	});

	session?.flash("toast", {
		intent: "success",
		message: `Flow monitor "${monitor.name}" created.`,
	});
	return redirect(
		routes.app.team.flowMonitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
});

/** POST /actions/:team/update-flow-monitor */
export const updateFlowMonitor = createAction(routes.actions.monitor.flow.update, async (ctx) => {
	let result = await validate(ctx.formData, UpdateFlowMonitorSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the flow monitor details and try again.",
		});
		return redirect(
			ctx.request.headers.get("Referer") ??
				routes.app.team.flowMonitors.index.href({ team: ctx.team.slug }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let db = getServiceContainer().get(Database);
	let { monitor_id, interval_seconds, ...values } = result.data;
	let existing = await FlowMonitor.findByIdForTeam(db, ctx.team.id, monitor_id);
	if (!existing) return notFound("Not Found");

	let showHref = routes.app.team.flowMonitors.show.href({
		team: ctx.team.slug,
		monitorId: monitor_id,
	});
	let editHref = routes.app.team.flowMonitors.edit.href({
		team: ctx.team.slug,
		monitorId: monitor_id,
	});

	let verifiedDomains = await TeamDomain.verifiedHostnamesForTeam(db, ctx.team.id);
	let inspection = inspectFlowSource(values.source, verifiedDomains);
	if (!inspection.ok) {
		session?.flash("toast", { intent: "error", message: inspection.message });
		return redirect(editHref, { status: redirect.Status.SeeOther });
	}

	await FlowMonitor.updateById(db, monitor_id, {
		...values,
		interval_seconds: Number(interval_seconds),
	});

	session?.flash("toast", { intent: "success", message: "Flow monitor updated." });
	return redirect(showHref, { status: redirect.Status.SeeOther });
});

/** DELETE /actions/:team/delete-flow-monitor */
export const deleteFlowMonitor = createAction(routes.actions.monitor.flow.delete, async (ctx) => {
	let result = await validate(ctx.formData, FlowMonitorIdSchema);
	let session = ctx.get(Session);
	let listHref = routes.app.team.flowMonitors.index.href({ team: ctx.team.slug });

	if (isFailure(result)) {
		return redirect(listHref, { status: redirect.Status.SeeOther });
	}

	let db = getServiceContainer().get(Database);
	let existing = await FlowMonitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
	if (!existing) return notFound("Not Found");

	await FlowMonitor.deleteById(db, result.data.monitor_id);

	session?.flash("toast", {
		intent: "success",
		message: `Flow monitor "${existing.name}" deleted.`,
	});
	return redirect(listHref, { status: redirect.Status.SeeOther });
});

/**
 * POST /actions/:team/check-flow-monitor — runs the flow now, gated and metered like the
 * scheduled sweep, so nothing before {@link runFlowCheck} bills. JSON callers get the outcome
 * inline since a run can take near thirty seconds, and the hydrated page toasts it directly.
 */
export const checkFlowMonitor = createAction(routes.actions.monitor.flow.check, async (ctx) => {
	let result = await validate(ctx.formData, FlowMonitorIdSchema);
	let session = ctx.get(Session);
	let listHref = routes.app.team.flowMonitors.index.href({ team: ctx.team.slug });

	if (isFailure(result)) return redirect(listHref, { status: redirect.Status.SeeOther });

	let db = getServiceContainer().get(Database);
	let monitor = await FlowMonitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
	if (!monitor) return notFound("Not Found");

	let showHref = routes.app.team.flowMonitors.show.href({
		team: ctx.team.slug,
		monitorId: monitor.id,
	});

	/**
	 * `stateFor` lets an owner whose entitlement cannot be determined still get their run, since
	 * refusing a paying customer over an inconclusive lookup is the worse mistake — the same
	 * reading every other manual check takes.
	 */
	if ((await Subscription.stateFor(db, ctx.team.owner_id)) === "inactive") {
		if (wantsJson(ctx.request)) {
			return ok({
				status: null,
				reason: ctx.i18next.t("actions.checks.subscriptionRequired"),
				testsPassed: 0,
				testsTotal: 0,
				requestsMade: 0,
				durationMs: null,
				failedTest: null,
				failedAtLine: null,
				detail: null,
			});
		}
		session?.flash("toast", {
			intent: "error",
			message: ctx.i18next.t("actions.checks.subscriptionRequired"),
		});
		return redirect(showHref, { status: redirect.Status.SeeOther });
	}

	let verifiedDomains = await TeamDomain.verifiedHostnamesForTeam(db, ctx.team.id);
	let checkResult = await runFlowCheck({ source: monitor.source, verifiedDomains });
	let resultId = await FlowMonitor.recordCheckResult(db, monitor.id, checkResult);

	/**
	 * Written here, between the history row and the meter, exactly where the sweep writes it, so a
	 * manual run and a scheduled one land as the same event and look identical in the dataset.
	 */
	writePingResult({
		monitorId: monitor.id,
		teamId: ctx.team.id,
		type: "flow",
		status: checkResult.status,
		responseTimeMs: checkResult.durationMs ?? 0,
	});

	/**
	 * One event per request made, keyed exactly as the sweep keys them, so a manual run and a
	 * scheduled one can never collide or double-bill. The call is deferred past the response
	 * because the visitor already has the result, and ingestion is best-effort, logging failures.
	 */
	if (checkResult.requestsMade > 0) {
		let pings: BillablePing[] = [];
		for (let index = 0; index < checkResult.requestsMade; index++) {
			pings.push({
				externalId: `ping:${resultId}:${index}`,
				ownerId: ctx.team.owner_id,
				teamId: ctx.team.id,
				monitorId: monitor.id,
				type: "flow",
			});
		}
		waitUntil(ingestPings(ctx.billing, pings));
	}

	/**
	 * The whole result: the hydrated page renders the failing test and its line into the toast,
	 * detail unique to a flow's check. The result row already holds the same values, so the two
	 * stay identical.
	 */
	if (wantsJson(ctx.request)) {
		return ok({
			status: checkResult.status,
			reason: null,
			testsPassed: checkResult.testsPassed,
			testsTotal: checkResult.testsTotal,
			requestsMade: checkResult.requestsMade,
			durationMs: checkResult.durationMs,
			failedTest: checkResult.failedTest,
			failedAtLine: checkResult.failedAtLine,
			detail: checkResult.failureDetail ?? checkResult.errorMessage,
		});
	}

	session?.flash("toast", {
		intent: checkResult.status === "up" ? "success" : "error",
		message: `Ran "${monitor.name}": ${checkResult.testsPassed}/${checkResult.testsTotal} passed.`,
	});
	return redirect(showHref, { status: redirect.Status.SeeOther });
});

/**
 * Did the caller ask for JSON?
 *
 * Gated on an explicit `Accept` so a browser form post — and every other caller — keeps the
 * redirect, exactly as the HTTP monitors' run action decides it.
 */
function wantsJson(request: Request): boolean {
	return request.headers.get("accept")?.includes("application/json") ?? false;
}
