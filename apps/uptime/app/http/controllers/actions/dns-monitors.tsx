/**
 * Form actions for a DNS monitor: create, update, delete, the manual check, and
 * the record-level review, toggle, and zone-file re-import. A refused create, update or
 * import draws its form again with what was typed or pasted and the fields to fix, answering 422.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ValidationError } from "@sdxc/validate";

import { redirect } from "@sdxc/http/response";
import { notFound, unprocessableEntity } from "@sdxc/http/response/html";
import { currentLog } from "@sdxc/logger";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { waitUntil } from "cloudflare:workers";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { DnsCheckStatus } from "~/app/services/dns/check";
import type { ZoneFileRecord } from "~/app/services/zone-file";
import type { SelectDnsMonitor } from "~/database/schema";
import type { DnsMonitorField, DnsMonitorSubmission } from "~/resources/views/dns-monitors/form";

import {
	CreateDnsMonitorSchema,
	DnsMonitorIdSchema,
	ImportDnsMonitorZoneFileSchema,
	ReviewDnsMonitorSchema,
	ToggleDnsMonitorRecordSchema,
	UpdateDnsMonitorSchema,
} from "~/app/http/validators/dns-monitor";
import { MAX_DNS_MONITORS_PER_TEAM } from "~/app/models/dns-monitors";
import abilities from "~/app/policies/abilities";
import { dnsAlertResultFromDiff, notifyDnsResult } from "~/app/services/alerts/dispatch";
import { writePingResult } from "~/app/services/analytics";
import {
	MAX_TRACKED_NAMES_PER_MONITOR,
	discoveryNames,
	importDiscovery,
	runDnsCheck,
} from "~/app/services/dns/discovery";
import { checkRegistration } from "~/app/services/domain-registration";
import { enqueueNotifications } from "~/app/services/notify-queue";
import { ingestPings } from "~/app/services/ping-meter";
import { MAX_ZONE_FILE_BYTES, parseZoneFile } from "~/app/services/zone-file";
import EditDnsMonitorPage from "~/resources/views/dns-monitors/edit-page";
import NewDnsMonitorPage from "~/resources/views/dns-monitors/new-page";
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
 * @returns The declared records and the names they add to, or the refusal to flash. An empty paste always yields records instead, meaning the monitor covers its apex alone — the commonest, legitimate way to create one.
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

/** Every field a DNS monitor form posts, with the issue copy each shows when refused. */
const FORM_FIELD_ISSUES: Record<DnsMonitorField, string> = {
	name: "page.dnsMonitors.form.issues.name",
	domain: "page.dnsMonitors.form.issues.domain",
	interval_seconds: "page.dnsMonitors.form.issues.interval",
	zone_file: "actions.importDnsMonitorZoneFile.errors.generic",
	registration_warning_days: "page.dnsMonitors.form.issues.registrationWarningDays",
};

/**
 * What a refused form carried, read back for the form to draw again: each field as typed, the
 * switch as it was left, and a translated message on each field the schema named.
 */
function submissionOf(
	formData: FormData,
	error: ValidationError | null,
	translate: (key: string) => string,
): DnsMonitorSubmission {
	let named = new Set(
		(error?.issues ?? []).map((issue) => {
			let [segment] = issue.path ?? [];
			return String(typeof segment === "object" ? segment.key : segment);
		}),
	);
	let fields = Object.keys(FORM_FIELD_ISSUES) as DnsMonitorField[];
	let submission: DnsMonitorSubmission = {
		values: { is_enabled: formData.has("is_enabled") },
		issues: {},
	};

	for (let field of fields) {
		let value = formData.get(field);
		if (typeof value === "string") submission.values[field] = value;
		if (named.has(field)) submission.issues[field] = translate(FORM_FIELD_ISSUES[field]);
	}

	return submission;
}

/** POST /actions/:team/create-dns-monitor */
export const createDnsMonitor = createAction(routes.actions.monitor.dns.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateDnsMonitorSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return ctx.render(
			<NewDnsMonitorPage
				submission={submissionOf(ctx.formData, result.error, (key) => ctx.intl.t(key))}
			/>,
			{ status: 422 },
		);
	}

	let existingCount = await ctx.models.dnsMonitors.inTeam(ctx.team.id).count();
	if (existingCount >= MAX_DNS_MONITORS_PER_TEAM) {
		return unprocessableEntity(
			ctx.intl.t("actions.createDnsMonitor.errors.limitExceeded", {
				limit: MAX_DNS_MONITORS_PER_TEAM,
			}),
		);
	}

	let { zone_file, ...values } = result.data;
	/** Read before the row is written, so a refused paste leaves no half-configured monitor. */
	let zone = readZoneFile(zone_file, values.domain);
	if ("refusal" in zone) {
		let submission = submissionOf(ctx.formData, null, (key) => ctx.intl.t(key));
		submission.issues.zone_file = ctx.intl.t(zone.refusal.messageKey, zone.refusal.values);
		return ctx.render(<NewDnsMonitorPage submission={submission} />, { status: 422 });
	}

	let importedAt = zone.records.length > 0 ? Date.now() : null;
	let monitor = unwrap(
		await ctx.models.dnsMonitors.create({
			team_id: ctx.team.id,
			...values,
			zone_file_imported_at: importedAt,
		}),
	);

	/**
	 * Discovery runs inline because the next screen reviews what it found, and an empty
	 * review would read as "your domain publishes nothing." A resolver that cannot be
	 * reached still leaves a usable monitor, since its next scheduled check finds the same records.
	 */
	try {
		await importDiscovery(ctx.models, monitor.id, zone.names, zone.records);
	} catch (error) {
		currentLog()
			?.set({ monitor: { id: monitor.id, type: "dns" } })
			.warn("dns.discovery_failed", {
				message: error instanceof Error ? error.message : String(error),
			});
	}

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.createDnsMonitor.success.created", { name: monitor.name }),
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
		let monitorId = ctx.formData.get("monitor_id");
		let monitor =
			typeof monitorId === "string"
				? await ctx.models.dnsMonitors.inTeam(ctx.team.id).find(monitorId)
				: null;
		if (!monitor) return notFound("Not Found");

		await ctx.access.load(abilities.dnsMonitors.delete);
		return ctx.render(
			<EditDnsMonitorPage
				monitor={monitor}
				canDelete={ctx.access.can(abilities.dnsMonitors.delete)}
				submission={submissionOf(ctx.formData, result.error, (key) => ctx.intl.t(key))}
			/>,
			{ status: 422 },
		);
	}

	let { monitor_id, registration_warning_days, ...values } = result.data;
	let existing = await ctx.models.dnsMonitors.inTeam(ctx.team.id).find(monitor_id);
	if (!existing) return notFound("Not Found");

	let windowChanged =
		registration_warning_days !== undefined &&
		registration_warning_days !== existing.registration_warning_days;

	unwrap(
		await ctx.models.dnsMonitors.update(monitor_id, {
			...values,
			...(windowChanged ? { registration_warning_days } : {}),
		}),
	);

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.updateDnsMonitor.success", { name: existing.name }),
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

	let existing = await ctx.models.dnsMonitors.inTeam(ctx.team.id).find(result.data.monitor_id);
	if (!existing) return notFound("Not Found");

	unwrap(await ctx.models.dnsMonitors.delete(result.data.monitor_id));

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.deleteDnsMonitor.success", { name: existing.name }),
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

	let monitor = await ctx.models.dnsMonitors.inTeam(ctx.team.id).find(result.data.monitor_id);
	if (!monitor) return notFound("Not Found");

	/**
	 * `checks.run` refuses only a subscription known to be inactive, so an owner whose
	 * entitlement cannot be determined still gets their check: refusing a paying customer over an inconclusive lookup
	 * is the worse of the two mistakes, the same reading every other manual check takes.
	 */
	await ctx.access.load(abilities.checks.run);
	if (!ctx.access.can(abilities.checks.run)) {
		session?.flash("toast", {
			intent: "error",
			message: ctx.intl.t("actions.checks.subscriptionRequired"),
		});
		return redirect(
			routes.app.team.dnsMonitors.show.href({ team: ctx.team.slug, monitorId: monitor.id }),
			{ status: redirect.Status.SeeOther },
		);
	}

	/**
	 * The registration is looked up beside the sweep, so a visitor who just renewed sees the
	 * new date on the page this redirects to. The lookup is free, so nothing below meters it,
	 * and its alert goes through the queue the scheduled lookup uses.
	 */
	let [check, registration] = await Promise.all([
		runDnsCheck(ctx.models, monitor.id, monitor.domain),
		checkRegistration(ctx.models, monitor),
	]);
	if (registration.notification) await enqueueNotifications([registration.notification]);

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
		ctx.models,
		ctx.email,
		monitor,
		monitor.last_status as DnsCheckStatus | null,
		dnsAlertResultFromDiff(check.status, check.diff),
	);

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.checkDnsMonitor.success.checked", { name: monitor.name }),
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
			message: ctx.intl.t("actions.reviewDnsMonitor.errors.generic"),
		});
		return redirect(
			ctx.request.headers.get("Referer") ??
				routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let monitor = await ctx.models.dnsMonitors.inTeam(ctx.team.id).find(result.data.monitor_id);
	if (!monitor) return notFound("Not Found");

	/**
	 * The submitted ids are intersected with the monitor's own records: the form is a list of
	 * checkboxes, so an id from somewhere else decides nothing.
	 */
	let submitted = new Set(result.data.record_ids);
	let records = await ctx.models.dnsMonitorRecords.listByMonitor(monitor.id);
	let enabled = records.filter((record) => submitted.has(record.id)).map((record) => record.id);
	let disabled = records.filter((record) => !submitted.has(record.id)).map((record) => record.id);

	await ctx.models.dnsMonitorRecords.setEnabled(monitor.id, enabled, true);
	await ctx.models.dnsMonitorRecords.setEnabled(monitor.id, disabled, false);

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.reviewDnsMonitor.success.saved", { count: enabled.length }),
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
				message: ctx.intl.t("actions.toggleDnsMonitorRecord.errors.generic"),
			});
			return redirect(
				ctx.request.headers.get("Referer") ??
					routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }),
				{ status: redirect.Status.SeeOther },
			);
		}

		let monitor = await ctx.models.dnsMonitors.inTeam(ctx.team.id).find(result.data.monitor_id);
		if (!monitor) return notFound("Not Found");

		let records = await ctx.models.dnsMonitorRecords.listByMonitor(monitor.id);
		let record = records.find((row) => row.id === result.data.record_id);
		if (!record) return notFound("Not Found");

		await ctx.models.dnsMonitorRecords.setEnabled(monitor.id, [record.id], result.data.is_enabled);

		session?.flash("toast", {
			intent: "success",
			message: ctx.intl.t(
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

		let pasted = ctx.formData.get("zone_file");

		/** Draws the edit page again holding the refused paste and why it was refused. */
		let renderRefusedImport = async (monitor: SelectDnsMonitor, value: string, issue: string) => {
			await ctx.access.load(abilities.dnsMonitors.delete);
			return ctx.render(
				<EditDnsMonitorPage
					monitor={monitor}
					canDelete={ctx.access.can(abilities.dnsMonitors.delete)}
					zoneFile={{ value, issue }}
				/>,
				{ status: 422 },
			);
		};

		if (isFailure(result)) {
			let monitorId = ctx.formData.get("monitor_id");
			let monitor =
				typeof monitorId === "string"
					? await ctx.models.dnsMonitors.inTeam(ctx.team.id).find(monitorId)
					: null;
			if (!monitor) return notFound("Not Found");

			return await renderRefusedImport(
				monitor,
				typeof pasted === "string" ? pasted : "",
				ctx.intl.t("actions.importDnsMonitorZoneFile.errors.generic"),
			);
		}

		let monitor = await ctx.models.dnsMonitors.inTeam(ctx.team.id).find(result.data.monitor_id);
		if (!monitor) return notFound("Not Found");

		let zone = readZoneFile(result.data.zone_file, monitor.domain);
		if ("refusal" in zone) {
			return await renderRefusedImport(
				monitor,
				result.data.zone_file,
				ctx.intl.t(zone.refusal.messageKey, zone.refusal.values),
			);
		}

		let discovery = await importDiscovery(ctx.models, monitor.id, zone.names, zone.records);
		unwrap(await ctx.models.dnsMonitors.update(monitor.id, { zone_file_imported_at: Date.now() }));

		session?.flash("toast", {
			intent: "success",
			message: ctx.intl.t("actions.importDnsMonitorZoneFile.success.imported", {
				count: discovery.names.length,
			}),
		});
		return redirect(
			routes.app.team.dnsMonitors.review.href({ team: ctx.team.slug, monitorId: monitor.id }),
			{ status: redirect.Status.SeeOther },
		);
	},
);
