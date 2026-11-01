/**
 * Form actions for TCP monitor create/update/delete/manual-check, each following the
 * validate → mutate → flash → redirect pattern. A refused create or update instead draws its
 * form again with the submitted values and the fields to fix, answering 422.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ValidationError } from "@sdxc/validate";

import { redirect } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { waitUntil } from "cloudflare:workers";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { TcpCheckStatus } from "~/app/services/tcp-check";
import type { TcpMonitorField, TcpMonitorSubmission } from "~/resources/views/tcp-monitors/form";

import {
	CreateTcpMonitorSchema,
	TcpMonitorIdSchema,
	UpdateTcpMonitorSchema,
} from "~/app/http/validators/tcp-monitor";
import abilities from "~/app/policies/abilities";
import { notifyTcpResult } from "~/app/services/alerts/dispatch";
import { writePingResult } from "~/app/services/analytics";
import { ingestPings } from "~/app/services/ping-meter";
import { checkTcpConnection } from "~/app/services/tcp-check";
import EditTcpMonitorPage from "~/resources/views/tcp-monitors/edit-page";
import NewTcpMonitorPage from "~/resources/views/tcp-monitors/new-page";
import routes from "~/routes/web";

/** Every field the TCP monitor form posts, in the order it draws them. */
const FORM_FIELDS: readonly TcpMonitorField[] = [
	"name",
	"host",
	"port",
	"interval_seconds",
	"timeout_ms",
];

/**
 * What a refused form carried, read back for the form to draw again: each field as typed, the
 * switch as it was left, and the fields the schema named in its issues.
 */
function submissionOf(formData: FormData, error: ValidationError): TcpMonitorSubmission {
	let named = new Set(
		error.issues.map((issue) => {
			let [segment] = issue.path ?? [];
			return String(typeof segment === "object" ? segment.key : segment);
		}),
	);
	let values: TcpMonitorSubmission["values"] = {
		is_enabled: formData.has("is_enabled"),
	};
	for (let field of FORM_FIELDS) {
		let value = formData.get(field);
		if (typeof value === "string") values[field] = value;
	}

	return { values, invalid: FORM_FIELDS.filter((field) => named.has(field)) };
}

/** POST /actions/:team/create-tcp-monitor */
export const createTcpMonitor = createAction(routes.actions.monitor.tcp.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateTcpMonitorSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return ctx.render(<NewTcpMonitorPage submission={submissionOf(ctx.formData, result.error)} />, {
			status: 422,
		});
	}

	let monitor = unwrap(
		await ctx.models.tcpMonitors.create({ team_id: ctx.team.id, ...result.data }),
	);

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
		let monitorId = ctx.formData.get("monitor_id");
		let monitor =
			typeof monitorId === "string"
				? await ctx.models.tcpMonitors.inTeam(ctx.team.id).find(monitorId)
				: null;
		if (!monitor) return notFound("Not Found");

		await ctx.access.load(abilities.tcpMonitors.delete);
		return ctx.render(
			<EditTcpMonitorPage
				monitor={monitor}
				canDelete={ctx.access.can(abilities.tcpMonitors.delete)}
				submission={submissionOf(ctx.formData, result.error)}
			/>,
			{ status: 422 },
		);
	}

	let { monitor_id, ...values } = result.data;
	let existing = await ctx.models.tcpMonitors.inTeam(ctx.team.id).find(monitor_id);
	if (!existing) return notFound("Not Found");

	unwrap(await ctx.models.tcpMonitors.update(monitor_id, values));

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

	let existing = await ctx.models.tcpMonitors.inTeam(ctx.team.id).find(result.data.monitor_id);
	if (!existing) return notFound("Not Found");

	unwrap(await ctx.models.tcpMonitors.delete(result.data.monitor_id));

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

	let monitor = await ctx.models.tcpMonitors.inTeam(ctx.team.id).find(result.data.monitor_id);
	if (!monitor) return notFound("Not Found");

	/**
	 * Gated by `checks.run`, so an owner whose state cannot be determined still
	 * gets their check — refusing a paying customer over an inconclusive lookup is the worse
	 * mistake. The same reading every other manual check takes.
	 */
	await ctx.access.load(abilities.checks.run);
	if (!ctx.access.can(abilities.checks.run)) {
		session?.flash("toast", {
			intent: "error",
			message: ctx.intl.t("actions.checks.subscriptionRequired"),
		});
		return redirect(
			routes.app.team.tcpMonitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let checkResult = await checkTcpConnection(monitor.host, monitor.port, monitor.timeout_ms);
	let resultId = await ctx.models.tcpMonitors.recordCheckResult(monitor.id, checkResult);

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
		ingestPings(ctx.billing, [
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
		ctx.models,
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
