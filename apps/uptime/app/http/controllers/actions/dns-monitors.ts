/**
 * Form actions for a DNS monitor: create, update, delete, the manual
 * check, and the record-level review, toggle, and zone-file re-import.
 * Each follows validate → mutate → flash → redirect: an error toast and
 * the form on failure, the monitor (or list) on success.
 * Create and import both sweep, so both enforce the parser's size cap and
 * the per-monitor name cap before resolving anything. The manual check
 * runs the same sweep as the scheduled job, so it is gated, reported, and
 * billed the same way; a pasted zone file survives only as parsed records.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { notFound, unprocessableEntity } from "@sdxc/http/response/html";
import { logger } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
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
 * The two failure modes lead to different fixes — an oversized paste must be trimmed, while
 * too many names must be split across monitors — and both are decided before any query runs.
 */
interface ZoneFileRefusal {
	messageKey: string;
	values: Record<string, string | number>;
}

/**
 * Parses a pasted zone file and checks it against both import limits.
 *
 * @returns The declared records and the names they add to, or the refusal to flash. An empty
 * paste always yields records instead, meaning the monitor covers its apex alone — the
 * commonest, legitimate way to create one.
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
	 * Discovery runs inline because the next screen reviews what it found, and an empty
	 * review would read as "your domain publishes nothing." A resolver that cannot be
	 * reached still leaves a usable monitor, since its next scheduled check finds the same records.
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
 * POST /actions/:team/check-dns-monitor — triggers an immediate on-demand check, gated,
 * reported, and billed the same way the scheduled sweep is. Everything that returns before
 * {@link runDnsCheck} swept nothing, so only work actually done reaches the meter.
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
	 * `stateFor` returns a state even when entitlement cannot be determined, and an owner in
	 * that case still gets their check: refusing a paying customer over an inconclusive lookup
	 * is the worse of the two mistakes, the same reading every other manual check takes.
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
		 * A check no query answered has no latency to report, and the result column is nullable
		 * for exactly that; the dataset's doubles instead spell "no measurement" as zero,
		 * matching the rest of the dataset.
		 */
		responseTimeMs: check.responseTimeMs ?? 0,
	});

	/**
	 * One ping covers the whole sweep, keyed on the history row it just wrote — queries cost
	 * nothing extra since the resolver is free, and the key keeps this event from colliding
	 * with the scheduled sweep's. Deferred, since the visitor already has the result to show.
	 */
	waitUntil(
		ingestPings(ctx.billing, [
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
	 * The findings come from the diff this check produced: the diff knows what moved at the
	 * moment of the transition, more precise than anything reconstructed after the fact.
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
 * POST /actions/:team/review-dns-monitor — persists which discovered records are watched, by
 * settling every record on the monitor at once. A declined record is stored disabled, which
 * keeps it representable and stops the next check from rediscovering it as new.
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
	 * The submitted ids are intersected with the monitor's own records: the form is a list of
	 * checkboxes, so an id from somewhere else decides nothing.
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
 * and not, looked up through the monitor's own list. That lookup is how its name reaches the
 * toast and how a record from another team's monitor is refused: a foreign id matches nothing.
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
 * POST /actions/:team/import-dns-monitor-zone-file — re-parses a freshly pasted zone file for
 * an existing monitor. The pasted text is never stored, so this is the only way names found
 * by an earlier import get refreshed; already-tracked records keep their owner's watched flag.
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
