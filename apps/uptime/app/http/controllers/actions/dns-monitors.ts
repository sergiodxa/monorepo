/**
 * Form actions for a DNS monitor: create, update, delete, the manual check, and the three
 * record-level actions a domain monitor needs — reviewing what discovery found, toggling one
 * stored record, and re-importing a zone file. Each follows the validate → mutate → flash →
 * redirect pattern: on validation failure the visitor is sent back to the form with an error
 * toast; on success, to the monitor (or list).
 *
 * The four actions that touch records or resolve anything answer `501` for now, because the
 * sweep and the record table they act on are still being built. Each says so at its own
 * definition, with the reason a placeholder answer would be worse than none.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { notFound, notImplemented, unprocessableEntity } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";

import DnsMonitor, { MAX_DNS_MONITORS_PER_TEAM } from "~/app/data/dns-monitor";
import {
	CreateDnsMonitorSchema,
	DnsMonitorIdSchema,
	UpdateDnsMonitorSchema,
} from "~/app/http/validators/dns-monitor";
import routes from "~/routes/web";

/** POST /actions/:team/create-dns-monitor */
export const createDnsMonitor = createAction(routes.actions.monitor.dns.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateDnsMonitorSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: ctx.i18next.t("actions.createDnsMonitor.errors.generic"),
		});
		return redirect(routes.app.team.dnsMonitors.new.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);

	let existingCount = await DnsMonitor.countByTeam(db, ctx.team.id);
	if (existingCount >= MAX_DNS_MONITORS_PER_TEAM) {
		return unprocessableEntity(
			ctx.i18next.t("actions.createDnsMonitor.errors.limitExceeded", {
				limit: MAX_DNS_MONITORS_PER_TEAM,
			}),
		);
	}

	let monitor = await DnsMonitor.create(db, ctx.team.id, result.data);

	session?.flash("toast", {
		intent: "success",
		message: ctx.i18next.t("actions.createDnsMonitor.success.created", { name: monitor.name }),
	});
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
			message: ctx.i18next.t("actions.updateDnsMonitor.errors.generic"),
		});
		return redirect(
			ctx.request.headers.get("Referer") ??
				routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let db = getServiceContainer().get(Database);
	let { monitor_id, ...values } = result.data;
	let existing = await DnsMonitor.findByIdForTeam(db, ctx.team.id, monitor_id);
	if (!existing) return notFound("Not Found");

	await DnsMonitor.updateById(db, monitor_id, values);

	session?.flash("toast", {
		intent: "success",
		message: ctx.i18next.t("actions.updateDnsMonitor.success", { name: existing.name }),
	});
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
		message: ctx.i18next.t("actions.deleteDnsMonitor.success", { name: existing.name }),
	});
	return redirect(routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/**
 * POST /actions/:team/check-dns-monitor — triggers an immediate on-demand check.
 *
 * Stubbed at `501` while the domain sweep is built (ADR-026 phase 2.1). A domain monitor
 * sweeps every supported type at every known name; resolving the apex `A` alone and
 * reporting `ok` in the meantime would tell the visitor their DNS is unchanged on the
 * strength of one query out of the set they asked us to watch.
 *
 * When it returns, this must meter one ping keyed on the result row it writes. Under the
 * old shape it ran a lookup inline and ingested nothing at all, which was an unbilled
 * resolver call behind a button anybody can hold down.
 */
export const checkDnsMonitor = createAction(routes.actions.monitor.dns.check, async (ctx) => {
	let result = await validate(ctx.formData, DnsMonitorIdSchema);

	if (isFailure(result)) {
		return redirect(routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
	if (!monitor) return notFound("Not Found");

	return notImplemented("Not Implemented");
});

/**
 * POST /actions/:team/review-dns-monitor — persists which discovered records are watched.
 *
 * Stubbed at `501` until the review screen exists (ADR-026 phase 2.5). A record the visitor
 * declines is stored disabled rather than dropped, so this settles every record on the
 * monitor at once and cannot be approximated by a partial write.
 */
export const reviewDnsMonitor = createAction(routes.actions.monitor.dns.review, async () => {
	return notImplemented("Not Implemented");
});

/**
 * POST /actions/:team/toggle-dns-monitor-record — flips one stored record between watched
 * and not.
 *
 * Stubbed at `501` until the record table is written and read (ADR-026 phase 1.3).
 */
export const toggleDnsMonitorRecord = createAction(
	routes.actions.monitor.dns.toggleRecord,
	async () => {
		return notImplemented("Not Implemented");
	},
);

/**
 * POST /actions/:team/import-dns-monitor-zone-file — re-parses a freshly pasted zone file
 * for an existing monitor.
 *
 * Stubbed at `501` until the parser exists (ADR-026 phase 1.1). The pasted text is never
 * stored, so this is the only way names discovered by an earlier import can be refreshed.
 */
export const importDnsMonitorZoneFile = createAction(
	routes.actions.monitor.dns.importZoneFile,
	async () => {
		return notImplemented("Not Implemented");
	},
);
