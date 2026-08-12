/**
 * Form actions for flow monitor create/update/delete. Each follows the validate → mutate →
 * flash → redirect pattern: on validation failure the visitor is sent back to the form with an
 * error toast; on success, to the list.
 *
 * One thing here is not shaped like the other monitor types' actions. A flow's source has to be
 * checked against the team's **verified domains** before it is stored, because a spec reaching a
 * domain the team does not own is a monitor that can never run — so saving it would mean an
 * hourly `error` result and a customer wondering why. That check is `inspectFlowSource`, the
 * same function the sweep applies, and its message is flashed verbatim: it already names the
 * host and the policy, and rewording it here would give the form and the check two vocabularies
 * for one rule.
 *
 * {@link checkFlowMonitor} is the one action here that performs billable work: it runs the flow
 * inline, so unlike the HTTP monitors' "run check" — which only enqueues, and is billed by the
 * job that later carries it out — nothing downstream of this request would ever meter it. The
 * entitlement gate, the Analytics Engine data point, and the meter events all live there.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { notFound } from "@pkg/http/response/html";
import { ok } from "@pkg/http/response/json";
import { PolarClient } from "@pkg/polar";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { waitUntil } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
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
	return redirect(routes.app.team.flowMonitors.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
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
	return redirect(editHref, { status: redirect.Status.SeeOther });
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
 * POST /actions/:team/check-flow-monitor — runs the flow now.
 *
 * A run this performs is the same work the scheduled sweep performs, so it is gated the same way
 * and metered the same way: one ping per HTTP request it made, keyed on the result row this run
 * wrote. Everything that returns before {@link runFlowCheck} — a rejected form, a monitor this
 * team does not own, an owner without entitlement — performed no requests and bills nothing.
 *
 * Unlike the create and update actions, this does **not** pre-check the source with
 * `inspectFlowSource`. It does not need to: `runFlowCheck` applies the same rule and records the
 * refusal as an `error` result, which is the more useful outcome here — somebody who asked to run
 * a broken monitor gets a stored result explaining why, rather than only a toast.
 *
 * A caller that asked for JSON gets the outcome in the body rather than a redirect and a flash it
 * would never render. That is the path that matters here: a flow can take most of thirty seconds,
 * so the hydrated page keeps its button pending and toasts the result when it lands, instead of
 * holding a navigation open for half a minute. The redirect below is the no-JS baseline, and the
 * two report the same thing.
 */
export const checkFlowMonitor = createAction(routes.actions.monitor.flow.check, async (ctx) => {
	let result = await validate(ctx.formData, FlowMonitorIdSchema);
	let session = ctx.get(Session);
	let listHref = routes.app.team.flowMonitors.index.href({ team: ctx.team.slug });

	if (isFailure(result)) return redirect(listHref, { status: redirect.Status.SeeOther });

	let db = getServiceContainer().get(Database);
	let monitor = await FlowMonitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
	if (!monitor) return notFound("Not Found");

	let editHref = routes.app.team.flowMonitors.edit.href({
		team: ctx.team.slug,
		monitorId: monitor.id,
	});

	/**
	 * `stateFor`, not `isActive`: an owner whose entitlement cannot be determined still gets their
	 * run, because refusing a paying customer over an inconclusive lookup is the worse of the two
	 * mistakes. The same reading every other manual check takes.
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
		return redirect(editHref, { status: redirect.Status.SeeOther });
	}

	let verifiedDomains = await TeamDomain.verifiedHostnamesForTeam(db, ctx.team.id);
	let checkResult = await runFlowCheck({ source: monitor.source, verifiedDomains });
	let resultId = await FlowMonitor.recordCheckResult(db, monitor.id, checkResult);

	/**
	 * Written here, between the history row and the meter, exactly where the sweep writes it — a
	 * run the visitor asked for is the same event as one the cron asked for, so nothing reading the
	 * dataset should be able to tell which produced a row.
	 */
	writePingResult({
		monitorId: monitor.id,
		teamId: ctx.team.id,
		type: "flow",
		status: checkResult.status,
		responseTimeMs: checkResult.durationMs ?? 0,
	});

	/**
	 * One event per request the run made, keyed exactly as the sweep keys them, so a manual run and
	 * a scheduled one can never be handed the same id and neither can be billed twice. Deferred
	 * rather than awaited, like every meter event on a response path — the visitor is waiting on a
	 * result this request already has, and ingestion is best-effort and logs its own failures.
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
		waitUntil(ingestPings(getServiceContainer().get(PolarClient), pings));
	}

	/**
	 * The whole result, not a summary: the hydrated page renders the failing test and its line
	 * into the toast, which is the one thing a flow knows that no other monitor type does. The
	 * result row already holds the same values, so nothing here is the only copy.
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
	return redirect(editHref, { status: redirect.Status.SeeOther });
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
