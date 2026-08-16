/**
 * Form actions for a DNS monitor: create, update, delete, the manual check, and the three
 * record-level actions a domain monitor needs — reviewing what discovery found, toggling one
 * stored record, and re-importing a zone file. Each follows the validate → mutate → flash →
 * redirect pattern: on validation failure the visitor is sent back to the form with an error
 * toast; on success, to the monitor (or list).
 *
 * Two of them do billable work. Creating a monitor and importing a zone file both sweep, so
 * both refuse a paste larger than the parser's cap or a zone with more names than one check
 * can cover, before any of it is resolved. The manual check is metered: it performs the same
 * sweep the scheduled job performs, so it is gated by the same entitlement check, written to
 * the same Analytics Engine dataset, and billed as one ping keyed on the history row it
 * wrote — which it never was under the old shape, leaving a full sweep behind a button
 * anybody can hold down.
 *
 * A pasted zone file is parsed and dropped. Nothing here writes it anywhere: what survives a
 * request is the records it declared and the fact that an import happened.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { notFound, unprocessableEntity } from "@pkg/http/response/html";
import { logger } from "@pkg/logger";
import { PolarClient } from "@pkg/polar";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { waitUntil } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { DnsCheckStatus } from "~/app/services/dns-check";
import type { ZoneFileRecord } from "~/app/services/zone-file";

import DnsMonitor, { MAX_DNS_MONITORS_PER_TEAM } from "~/app/data/dns-monitor";
import DnsMonitorRecord from "~/app/data/dns-monitor-record";
import Subscription from "~/app/data/subscription";
import {
	CreateDnsMonitorSchema,
	DnsMonitorIdSchema,
	ImportDnsMonitorZoneFileSchema,
	ReviewDnsMonitorSchema,
	ToggleDnsMonitorRecordSchema,
	UpdateDnsMonitorSchema,
} from "~/app/http/validators/dns-monitor";
import { dnsAlertResultFromDiff, notifyDnsResult } from "~/app/services/alerts";
import { writePingResult } from "~/app/services/analytics";
import {
	MAX_TRACKED_NAMES_PER_MONITOR,
	discoveryNames,
	importDiscovery,
	runDnsCheck,
} from "~/app/services/dns-discovery";
import { ingestPings } from "~/app/services/ping-meter";
import { MAX_ZONE_FILE_BYTES, parseZoneFile } from "~/app/services/zone-file";
import routes from "~/routes/web";

/** The paste cap as the toast states it, so the copy and the parser cannot disagree. */
const ZONE_FILE_LIMIT_LABEL = `${MAX_ZONE_FILE_BYTES / 1024} KiB`;

/**
 * A refusal to import: which toast to flash, in place of the records an import would return.
 *
 * The two failures are told apart because they lead to different fixes — a paste over the
 * size cap has to be trimmed, while a zone with too many names has to be split across
 * monitors — and both must be decided before a single query is sent.
 */
interface ZoneFileRefusal {
	messageKey: string;
	values: Record<string, string | number>;
}

/**
 * Parses a pasted zone file and checks it against both import limits.
 *
 * @returns The declared records and the names they add to, or the refusal to flash. An empty
 * paste is not a refusal: it means the monitor covers its apex alone, which is a legitimate
 * (and the commonest) way to create one.
 */
function readZoneFile(
	zoneFile: string | undefined,
	domain: string,
): { records: ZoneFileRecord[]; names: string[] } | { refusal: ZoneFileRefusal } {
	if (zoneFile === undefined || zoneFile.trim() === "") {
		return { records: [], names: discoveryNames(domain) };
	}

	let parsed = parseZoneFile(zoneFile, domain);
	if (isFailure(parsed)) {
		return {
			refusal: {
				messageKey: "actions.importDnsMonitorZoneFile.errors.tooLarge",
				values: { limit: ZONE_FILE_LIMIT_LABEL },
			},
		};
	}

	let names = discoveryNames(domain, parsed.data.records);
	if (names.length > MAX_TRACKED_NAMES_PER_MONITOR) {
		return {
			refusal: {
				messageKey: "actions.importDnsMonitorZoneFile.errors.tooManyNames",
				values: { limit: MAX_TRACKED_NAMES_PER_MONITOR },
			},
		};
	}

	return { records: parsed.data.records, names };
}

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

	let { zone_file, ...values } = result.data;
	/** Read before the row is written, so a refused paste leaves no half-configured monitor. */
	let zone = readZoneFile(zone_file, values.domain);
	if ("refusal" in zone) {
		session?.flash("toast", {
			intent: "error",
			message: ctx.i18next.t(zone.refusal.messageKey, zone.refusal.values),
		});
		return redirect(routes.app.team.dnsMonitors.new.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let importedAt = zone.records.length > 0 ? Date.now() : null;
	let monitor = await DnsMonitor.create(db, ctx.team.id, {
		...values,
		zone_file_imported_at: importedAt,
	});

	/**
	 * Discovery runs inline because the next screen is the review of what it found, and an
	 * empty review screen would read as "your domain publishes nothing". A resolver that
	 * cannot be reached still leaves a usable monitor — its next scheduled check discovers
	 * the same records — so a failure here is not allowed to undo the creation.
	 */
	try {
		await importDiscovery(db, monitor.id, zone.names, zone.records);
	} catch (error) {
		logger.error("action.create_dns_monitor.discovery_failed", {
			monitorId: monitor.id,
			error: error instanceof Error ? error.message : String(error),
		});
	}

	session?.flash("toast", {
		intent: "success",
		message: ctx.i18next.t("actions.createDnsMonitor.success.created", { name: monitor.name }),
	});
	return redirect(
		routes.app.team.dnsMonitors.review.href({ team: ctx.team.slug, monitorId: monitor.id }),
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
 * A sweep this runs is the same work the scheduled job runs, so it is gated, reported and
 * billed the same way. Everything that returns before {@link runDnsCheck} — a rejected form,
 * a monitor this team does not own, an owner without entitlement — swept nothing and bills
 * nothing; only work actually done reaches the meter.
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

	let check = await runDnsCheck(db, monitor.id, monitor.domain);

	/**
	 * Written between the history row and the meter, exactly where the scheduled sweep writes
	 * it — a check the visitor asked for is the same event as one the cron asked for, so
	 * nothing reading the dataset should be able to tell which produced a row.
	 */
	writePingResult({
		monitorId: monitor.id,
		teamId: ctx.team.id,
		type: "dns",
		status: check.status,
		/**
		 * A check no query answered has no latency to report and the result column is nullable
		 * for exactly that, but the dataset's doubles are not — zero is how the rest of the
		 * dataset already spells "no measurement", so it is what goes in.
		 */
		responseTimeMs: check.responseTimeMs ?? 0,
	});

	/**
	 * One ping for the whole sweep, keyed on the history row it just wrote. One per *query*
	 * would charge for a cost we never incur — the public resolver is free to us — and the id
	 * is what makes the event impossible to collide with the scheduled sweep's, since no two
	 * checks ever share a row. Deferred rather than awaited, like every meter event on a
	 * response path: the visitor is waiting on a result this request already has.
	 */
	waitUntil(
		ingestPings(getServiceContainer().get(PolarClient), [
			{
				externalId: `ping:${check.resultId}`,
				ownerId: ctx.team.owner_id,
				teamId: ctx.team.id,
				monitorId: monitor.id,
				type: "dns",
			},
		]),
	);

	/**
	 * The findings come from the diff this check produced rather than from the record rows it
	 * just wrote: the diff knows what moved at the moment of the transition, which is more
	 * precise than anything reconstructed after the fact.
	 */
	await notifyDnsResult(
		db,
		ctx.email,
		monitor,
		monitor.last_status as DnsCheckStatus | null,
		dnsAlertResultFromDiff(check.status, check.diff),
	);

	session?.flash("toast", {
		intent: "success",
		message: ctx.i18next.t("actions.checkDnsMonitor.success.checked", { name: monitor.name }),
	});
	return redirect(
		routes.app.team.dnsMonitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
});

/**
 * POST /actions/:team/review-dns-monitor — persists which discovered records are watched.
 *
 * It settles every record on the monitor at once rather than writing only the checked ones,
 * because a record the visitor declined is stored disabled instead of being dropped. Dropping
 * it would make the very next check rediscover it as new and alert on it forever, and would
 * leave the user's decision not to watch something unrepresentable.
 */
export const reviewDnsMonitor = createAction(routes.actions.monitor.dns.review, async (ctx) => {
	let result = await validate(ctx.formData, ReviewDnsMonitorSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: ctx.i18next.t("actions.reviewDnsMonitor.errors.generic"),
		});
		return redirect(
			ctx.request.headers.get("Referer") ??
				routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let db = getServiceContainer().get(Database);
	let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
	if (!monitor) return notFound("Not Found");

	/**
	 * The submitted ids are intersected with the monitor's own records rather than trusted:
	 * the form is a list of checkboxes, and an id from somewhere else must decide nothing.
	 */
	let submitted = new Set(result.data.record_ids);
	let records = await DnsMonitorRecord.listByMonitor(db, monitor.id);
	let enabled = records.filter((record) => submitted.has(record.id)).map((record) => record.id);
	let disabled = records.filter((record) => !submitted.has(record.id)).map((record) => record.id);

	await DnsMonitorRecord.setEnabled(db, monitor.id, enabled, true);
	await DnsMonitorRecord.setEnabled(db, monitor.id, disabled, false);

	session?.flash("toast", {
		intent: "success",
		message: ctx.i18next.t("actions.reviewDnsMonitor.success.saved", { count: enabled.length }),
	});
	return redirect(
		routes.app.team.dnsMonitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
		{ status: redirect.Status.SeeOther },
	);
});

/**
 * POST /actions/:team/toggle-dns-monitor-record — flips one stored record between watched
 * and not.
 *
 * The record is looked up through the monitor's own list, which is both how its name reaches
 * the toast and how a record belonging to another team's monitor is refused: an id that is
 * not in this monitor's set matches nothing here and nothing in the write below.
 */
export const toggleDnsMonitorRecord = createAction(
	routes.actions.monitor.dns.toggleRecord,
	async (ctx) => {
		let result = await validate(ctx.formData, ToggleDnsMonitorRecordSchema);
		let session = ctx.get(Session);

		if (isFailure(result)) {
			session?.flash("toast", {
				intent: "error",
				message: ctx.i18next.t("actions.toggleDnsMonitorRecord.errors.generic"),
			});
			return redirect(
				ctx.request.headers.get("Referer") ??
					routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }),
				{ status: redirect.Status.SeeOther },
			);
		}

		let db = getServiceContainer().get(Database);
		let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
		if (!monitor) return notFound("Not Found");

		let records = await DnsMonitorRecord.listByMonitor(db, monitor.id);
		let record = records.find((row) => row.id === result.data.record_id);
		if (!record) return notFound("Not Found");

		await DnsMonitorRecord.setEnabled(db, monitor.id, [record.id], result.data.is_enabled);

		session?.flash("toast", {
			intent: "success",
			message: ctx.i18next.t(
				result.data.is_enabled
					? "actions.toggleDnsMonitorRecord.success.enabled"
					: "actions.toggleDnsMonitorRecord.success.disabled",
				{ name: `${record.name} ${record.record_type}` },
			),
		});
		return redirect(
			routes.app.team.dnsMonitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
			{ status: redirect.Status.SeeOther },
		);
	},
);

/**
 * POST /actions/:team/import-dns-monitor-zone-file — re-parses a freshly pasted zone file
 * for an existing monitor.
 *
 * The pasted text is never stored, so this is the only way names discovered by an earlier
 * import can be refreshed. What it adds is names: records already tracked keep the watched
 * flag their owner chose for them, so re-importing is safe to repeat.
 */
export const importDnsMonitorZoneFile = createAction(
	routes.actions.monitor.dns.importZoneFile,
	async (ctx) => {
		let result = await validate(ctx.formData, ImportDnsMonitorZoneFileSchema);
		let session = ctx.get(Session);

		if (isFailure(result)) {
			session?.flash("toast", {
				intent: "error",
				message: ctx.i18next.t("actions.importDnsMonitorZoneFile.errors.generic"),
			});
			return redirect(
				ctx.request.headers.get("Referer") ??
					routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }),
				{ status: redirect.Status.SeeOther },
			);
		}

		let db = getServiceContainer().get(Database);
		let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, result.data.monitor_id);
		if (!monitor) return notFound("Not Found");

		let zone = readZoneFile(result.data.zone_file, monitor.domain);
		if ("refusal" in zone) {
			session?.flash("toast", {
				intent: "error",
				message: ctx.i18next.t(zone.refusal.messageKey, zone.refusal.values),
			});
			return redirect(
				routes.app.team.dnsMonitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
				{ status: redirect.Status.SeeOther },
			);
		}

		let discovery = await importDiscovery(db, monitor.id, zone.names, zone.records);
		await DnsMonitor.updateById(db, monitor.id, { zone_file_imported_at: Date.now() });

		session?.flash("toast", {
			intent: "success",
			message: ctx.i18next.t("actions.importDnsMonitorZoneFile.success.imported", {
				count: discovery.names.length,
			}),
		});
		return redirect(
			routes.app.team.dnsMonitors.review.href({ team: ctx.team.slug, monitorId: monitor.id }),
			{ status: redirect.Status.SeeOther },
		);
	},
);
