/**
 * Form actions for flow monitor create/update/delete. A refused save renders its form again
 * with what was typed and an issue beside each field; a successful one flashes and redirects. A flow's source is checked against the team's verified domains before
 * storage, using the same `inspectFlowSource` the sweep applies, so form and sweep share one
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Form } from "@sdxc/ui";
import type { ValidationError } from "@sdxc/validate";

import { redirect } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { ok } from "@sdxc/http/response/json";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { waitUntil } from "cloudflare:workers";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { FormSubmission } from "~/app/http/validators/form-submission";
import type { SelectFlowMonitor } from "~/database/schema";

import {
	CreateFlowMonitorSchema,
	FlowMonitorIdSchema,
	UpdateFlowMonitorSchema,
} from "~/app/http/validators/flow-monitor";
import abilities from "~/app/policies/abilities";
import { writePingResult } from "~/app/services/analytics";
import { planFlowBilling, settleFlowBilling } from "~/app/services/flow-billing";
import { inspectFlowSource, runFlowCheck } from "~/app/services/flow-check";
import EditFlowMonitorPage from "~/resources/views/flow-monitors/edit-page";
import NewFlowMonitorPage from "~/resources/views/flow-monitors/new-page";
import routes from "~/routes/web";

/** The `page.flowMonitors.form.errors.*` message for each field the schema checks. */
const FIELD_ERRORS: Record<string, string> = {
	name: "name",
	source: "source",
	interval_seconds: "interval",
};

/**
 * The schema's issues as one translated message per field, in the order they were found,
 * falling back to a form-level message when none names a known field.
 */
function formIssues(issues: ValidationError["issues"], t: Translate): Form.Issue[] {
	let fields = new Set<string>();
	for (let issue of issues) {
		let segment = issue.path?.[0];
		let name = typeof segment === "object" ? String(segment.key) : String(segment);
		if (name in FIELD_ERRORS) fields.add(name);
	}
	if (fields.size === 0) return [{ message: t("page.flowMonitors.form.errors.generic") }];

	return [...fields].map((name) => ({
		message: t(`page.flowMonitors.form.errors.${FIELD_ERRORS[name]}`),
		path: [name],
	}));
}

/** POST /actions/:team/create-flow-monitor; a refused submit answers 422 with the form as typed. */
export const createFlowMonitor = createAction(routes.actions.monitor.flow.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateFlowMonitorSchema);
	let session = ctx.get(Session);

	let verifiedDomains = await ctx.models.teamDomains.verifiedHostnames(ctx.team.id);

	/** Draws the new-monitor page again holding the refused submission, answered as 422. */
	let sendBack = (submission: FormSubmission) =>
		ctx.render(<NewFlowMonitorPage verifiedDomains={verifiedDomains} submission={submission} />, {
			status: 422,
		});

	if (isFailure(result)) {
		return sendBack({
			values: ctx.formData,
			issues: formIssues(result.error.issues, ctx.intl.t),
		});
	}

	let inspection = inspectFlowSource(result.data.source, verifiedDomains);
	if (!inspection.ok) {
		return sendBack({
			values: ctx.formData,
			issues: [{ message: inspection.message, path: ["source"] }],
		});
	}

	let monitor = unwrap(
		await ctx.models.flowMonitors.create({
			team_id: ctx.team.id,
			name: result.data.name,
			source: result.data.source,
			is_enabled: result.data.is_enabled,
			interval_seconds: Number(result.data.interval_seconds),
		}),
	);

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("page.flowMonitors.toast.created", { name: monitor.name }),
	});
	return redirect(
		routes.app.team.flowMonitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
});

/**
 * POST /actions/:team/update-flow-monitor; a refused submit answers 422 with the form as typed,
 * or redirects back when the monitor it names is not the team's.
 */
export const updateFlowMonitor = createAction(routes.actions.monitor.flow.update, async (ctx) => {
	let result = await validate(ctx.formData, UpdateFlowMonitorSchema);
	let session = ctx.get(Session);

	/**
	 * Draws `monitor`'s edit page again holding the refused submission, answered as 422, with
	 * the danger zone shown to a member allowed to delete flow monitors.
	 */
	let sendBack = async (monitor: SelectFlowMonitor, submission: FormSubmission) => {
		await ctx.access.load(abilities.flowMonitors.delete);
		let verifiedDomains = await ctx.models.teamDomains.verifiedHostnames(ctx.team.id);
		return ctx.render(
			<EditFlowMonitorPage
				monitor={monitor}
				canDelete={ctx.access.can(abilities.flowMonitors.delete)}
				verifiedDomains={verifiedDomains}
				submission={submission}
			/>,
			{ status: 422 },
		);
	};

	if (isFailure(result)) {
		let monitorId = ctx.formData.get("monitor_id");
		let monitor =
			typeof monitorId === "string"
				? await ctx.models.flowMonitors.inTeam(ctx.team.id).find(monitorId)
				: null;
		if (monitor) {
			return sendBack(monitor, {
				values: ctx.formData,
				issues: formIssues(result.error.issues, ctx.intl.t),
			});
		}

		session?.flash("toast", {
			intent: "error",
			message: ctx.intl.t("page.flowMonitors.form.errors.generic"),
		});
		return redirect(
			ctx.request.headers.get("Referer") ??
				routes.app.team.flowMonitors.index.href({ team: ctx.team.slug }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let { monitor_id, interval_seconds, ...values } = result.data;
	let existing = await ctx.models.flowMonitors.inTeam(ctx.team.id).find(monitor_id);
	if (!existing) return notFound("Not Found");

	let showHref = routes.app.team.flowMonitors.show.href({
		team: ctx.team.slug,
		monitorId: monitor_id,
	});

	let verifiedDomains = await ctx.models.teamDomains.verifiedHostnames(ctx.team.id);
	let inspection = inspectFlowSource(values.source, verifiedDomains);
	if (!inspection.ok) {
		return sendBack(existing, {
			values: ctx.formData,
			issues: [{ message: inspection.message, path: ["source"] }],
		});
	}

	unwrap(
		await ctx.models.flowMonitors.update(monitor_id, {
			...values,
			interval_seconds: Number(interval_seconds),
		}),
	);

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("page.flowMonitors.toast.updated", { name: values.name }),
	});
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

	let existing = await ctx.models.flowMonitors.inTeam(ctx.team.id).find(result.data.monitor_id);
	if (!existing) return notFound("Not Found");

	unwrap(await ctx.models.flowMonitors.delete(result.data.monitor_id));

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("page.flowMonitors.toast.deleted", { name: existing.name }),
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

	let monitor = await ctx.models.flowMonitors.inTeam(ctx.team.id).find(result.data.monitor_id);
	if (!monitor) return notFound("Not Found");

	let showHref = routes.app.team.flowMonitors.show.href({
		team: ctx.team.slug,
		monitorId: monitor.id,
	});

	/**
	 * `checks.run` lets an owner whose entitlement cannot be determined still get their run, since
	 * refusing a paying customer over an inconclusive lookup is the worse mistake — the same
	 * reading every other manual check takes.
	 */
	await ctx.access.load(abilities.checks.run);
	if (!ctx.access.can(abilities.checks.run)) {
		if (wantsJson(ctx.request)) {
			return ok({
				status: null,
				reason: ctx.intl.t("actions.checks.subscriptionRequired"),
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
			message: ctx.intl.t("actions.checks.subscriptionRequired"),
		});
		return redirect(showHref, { status: redirect.Status.SeeOther });
	}

	let verifiedDomains = await ctx.models.teamDomains.verifiedHostnames(ctx.team.id);
	let checkResult = await runFlowCheck({ source: monitor.source, verifiedDomains });
	let resultId = await ctx.models.flowMonitors.recordCheckResult(monitor.id, checkResult, {
		teamId: ctx.team.id,
	});

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
	 * HTTP-only flows bill one ping per request; browser flows bill one flow-run event and
	 * record browser-seconds on the cost ledger. Deferred past the response
	 * because the visitor already has the result, and ingestion is best-effort.
	 */
	let billingPlan = planFlowBilling(checkResult, {
		resultId,
		ownerId: ctx.team.owner_id,
		teamId: ctx.team.id,
		monitorId: monitor.id,
	});
	if (billingPlan.pings.length > 0 || billingPlan.flowRuns.length > 0) {
		waitUntil(settleFlowBilling(ctx.billing, billingPlan));
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
