/**
 * Form actions for DNS monitor create/update/delete/manual-check. Each follows the
 * validate → mutate → flash → redirect pattern: on validation failure the visitor is
 * sent back to the form with an error toast; on success, to the monitor (or list).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/fetch-router";

import { redirect } from "@pkg/http/response";
import { notFound, unprocessableEntity } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { Session } from "remix/session";
import { Resend } from "resend";

import type { DnsCheckStatus, DnsRecordType } from "~/app/services/dns-check";

import DnsMonitor, { MAX_DNS_MONITORS_PER_TEAM } from "~/app/data/dns-monitor";
import {
	CreateDnsMonitorSchema,
	DnsMonitorIdSchema,
	UpdateDnsMonitorSchema,
} from "~/app/http/validators/dns-monitor";
import { notifyDnsResult } from "~/app/services/alerts";
import { checkDns } from "~/app/services/dns-check";
import routes from "~/routes/web";

/** POST /actions/:team/create-dns-monitor */
export async function createDnsMonitor(ctx: RequestContext<{ team: string }>) {
	let result = await validate(ctx.formData, CreateDnsMonitorSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the DNS monitor details and try again.",
		});
		return redirect(routes.app.team.dnsMonitorNew.href({ team: ctx.team.slug }), {
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
		routes.app.team.dnsMonitorShow.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
}

/** POST /actions/:team/update-dns-monitor */
export async function updateDnsMonitor(ctx: RequestContext<{ team: string }>) {
	let result = await validate(ctx.formData, UpdateDnsMonitorSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the DNS monitor details and try again.",
		});
		return redirect(
			ctx.request.headers.get("Referer") ?? routes.app.team.dashboard.href({ team: ctx.team.slug }),
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
		routes.app.team.dnsMonitorShow.href({ team: ctx.team.slug, monitorId: monitor_id }),
		{ status: redirect.Status.SeeOther },
	);
}

/** DELETE /actions/:team/delete-dns-monitor */
export async function deleteDnsMonitor(ctx: RequestContext<{ team: string }>) {
	let result = await validate(ctx.formData, DnsMonitorIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.dnsMonitors.href({ team: ctx.team.slug }), {
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
	return redirect(routes.app.team.dnsMonitors.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
}

/** POST /actions/:team/check-dns-monitor — triggers an immediate on-demand check. */
export async function checkDnsMonitor(ctx: RequestContext<{ team: string }>) {
	let result = await validate(ctx.formData, DnsMonitorIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.dnsMonitors.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
	if (!monitor) return notFound("Not Found");

	let checkResult = await checkDns(
		monitor.domain,
		monitor.record_type as DnsRecordType,
		monitor.expected_value,
		monitor.last_value,
	);
	await DnsMonitor.recordCheckResult(db, monitor.id, checkResult);
	await notifyDnsResult(
		db,
		getServiceContainer().get(Resend),
		monitor,
		monitor.last_status as DnsCheckStatus | null,
		checkResult,
	);

	session?.flash("toast", { intent: "success", message: `Checked "${monitor.name}".` });
	return redirect(
		routes.app.team.dnsMonitorShow.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
}
