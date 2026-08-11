/**
 * Form actions for DNS monitor create/update/delete/manual-check. Each follows the
 * validate → mutate → flash → redirect pattern: on validation failure the visitor is
 * sent back to the form with an error toast; on success, to the monitor (or list).
 *
 * The manual check is the one action here that performs billable work: it resolves DNS
 * inline, so unlike the HTTP monitors' "run check" — which only enqueues, and is billed by
 * the job that later carries it out — nothing downstream of this request would ever meter
 * it. All of that lives in {@link checkDnsMonitor}: the entitlement gate that decides
 * whether the lookup happens at all, the Analytics Engine data point recording it, and the
 * meter event for the one that did.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { notFound, unprocessableEntity } from "@pkg/http/response/html";
import { PolarClient } from "@pkg/polar";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { waitUntil } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";

import type { DnsCheckStatus, DnsRecordType } from "~/app/services/dns-check";

import DnsMonitor, { MAX_DNS_MONITORS_PER_TEAM } from "~/app/data/dns-monitor";
import Subscription from "~/app/data/subscription";
import {
	CreateDnsMonitorSchema,
	DnsMonitorIdSchema,
	UpdateDnsMonitorSchema,
} from "~/app/http/validators/dns-monitor";
import { notifyDnsResult } from "~/app/services/alerts";
import { writePingResult } from "~/app/services/analytics";
import { checkDns } from "~/app/services/dns-check";
import { ingestPings } from "~/app/services/ping-meter";
import routes from "~/routes/web";

/** POST /actions/:team/create-dns-monitor */
export const createDnsMonitor = createAction(routes.actions.monitor.dns.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateDnsMonitorSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the DNS monitor details and try again.",
		});
		return redirect(routes.app.team.dnsMonitors.new.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);

	let existingCount = await DnsMonitor.countByTeam(db, ctx.team.id);
	if (existingCount >= MAX_DNS_MONITORS_PER_TEAM) {
		return unprocessableEntity(
			`A team supports at most ${MAX_DNS_MONITORS_PER_TEAM} DNS monitors.`,
		);
	}

	let { expected_value, ...values } = result.data;
	let monitor = await DnsMonitor.create(db, ctx.team.id, {
		...values,
		expected_value: expected_value || null,
	});

	session?.flash("toast", { intent: "success", message: `DNS monitor "${monitor.name}" created.` });
	return redirect(
		routes.app.team.dnsMonitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
});

/** POST /actions/:team/update-dns-monitor */
export const updateDnsMonitor = createAction(routes.actions.monitor.dns.update, async (ctx) => {
	let result = await validate(ctx.formData, UpdateDnsMonitorSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the DNS monitor details and try again.",
		});
		return redirect(
			ctx.request.headers.get("Referer") ??
				routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let db = getServiceContainer().get(Database);
	let { monitor_id, expected_value, ...values } = result.data;
	let existing = await DnsMonitor.findByIdForTeam(db, ctx.team.id, monitor_id);
	if (!existing) return notFound("Not Found");

	await DnsMonitor.updateById(db, monitor_id, {
		...values,
		expected_value: expected_value || null,
	});

	session?.flash("toast", { intent: "success", message: "DNS monitor updated." });
	return redirect(
		routes.app.team.dnsMonitors.show.href({ team: ctx.team.slug, monitorId: monitor_id }),
		{ status: redirect.Status.SeeOther },
	);
});

/** DELETE /actions/:team/delete-dns-monitor */
export const deleteDnsMonitor = createAction(routes.actions.monitor.dns.delete, async (ctx) => {
	let result = await validate(ctx.formData, DnsMonitorIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let existing = await DnsMonitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
	if (!existing) return notFound("Not Found");

	await DnsMonitor.deleteById(db, result.data.monitor_id);

	session?.flash("toast", {
		intent: "success",
		message: `DNS monitor "${existing.name}" deleted.`,
	});
	return redirect(routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/**
 * POST /actions/:team/check-dns-monitor — triggers an immediate on-demand check.
 *
 * A lookup this performs is one ping, the same as one the scheduled sweep performs, so it
 * is gated the same way and metered the same way. Everything that returns before
 * {@link checkDns} — a rejected form, a monitor this team does not own, an owner without
 * entitlement — performed no lookup and bills nothing; only work actually done reaches the
 * meter.
 */
export const checkDnsMonitor = createAction(routes.actions.monitor.dns.check, async (ctx) => {
	let result = await validate(ctx.formData, DnsMonitorIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
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
			routes.app.team.dnsMonitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let checkResult = await checkDns(
		monitor.domain,
		monitor.record_type as DnsRecordType,
		monitor.expected_value,
		monitor.last_value,
	);
	let resultId = await DnsMonitor.recordCheckResult(db, monitor.id, checkResult);

	/**
	 * Written here, between the history row and the meter, exactly where the scheduled sweep
	 * writes it — a check the visitor asked for is the same event as one the cron asked for,
	 * so nothing reading the dataset should be able to tell which produced a row. Without
	 * this the check was billed and stored in D1 but absent from every chart and aggregate
	 * built on Analytics Engine.
	 *
	 * DNS's own `ok`/`changed`/`error` vocabulary goes in as-is, matching the sweep: nothing
	 * reads a status without filtering to one ping type first.
	 */
	writePingResult({
		monitorId: monitor.id,
		teamId: ctx.team.id,
		type: "dns",
		status: checkResult.status,
		responseTimeMs: checkResult.responseTimeMs,
	});

	/**
	 * Keyed on the history row this check just wrote, which is the same key the scheduled
	 * sweep bills a DNS check under: it is unique, already persisted, and belongs to exactly
	 * one lookup, so a manual check and a scheduled one can never be handed the same id and
	 * neither can be billed twice. Deferred rather than awaited, like every meter event on a
	 * response path — the visitor is waiting on a result this request already has, and
	 * ingestion is best-effort and logs its own failures.
	 */
	waitUntil(
		ingestPings(getServiceContainer().get(PolarClient), [
			{
				externalId: `ping:${resultId}`,
				ownerId: ctx.team.owner_id,
				teamId: ctx.team.id,
				monitorId: monitor.id,
				type: "dns",
			},
		]),
	);

	await notifyDnsResult(
		db,
		ctx.email,
		monitor,
		monitor.last_status as DnsCheckStatus | null,
		checkResult,
	);

	session?.flash("toast", { intent: "success", message: `Checked "${monitor.name}".` });
	return redirect(
		routes.app.team.dnsMonitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
});
