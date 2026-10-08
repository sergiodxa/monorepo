/**
 * Hourly sweep that looks up the registration of every DNS monitor whose lookup is due
 * (ADR-035): one RDAP query per domain, paced per registry, persisted with its next lookup
 * time, and handed to `notify` when the outcome warrants an alert. Lookups are not metered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createJobHandler } from "@sdxc/jobs";
import { isSuccess } from "@sdxc/result";

import type { ClaimedRegistration } from "~/app/data/dns-monitor";
import type { NotifyMessage } from "~/app/lib/notify-queue";

import DnsMonitor from "~/app/data/dns-monitor";
import jobs from "~/app/jobs";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { enqueueNotifications } from "~/app/lib/notify-queue";
import { apportionCostByTeam } from "~/app/services/cost";
import {
	rdapClient,
	registrationOutcome,
	shouldAlertOnRegistration,
} from "~/app/services/domain-registration";
import { classifyExpiry } from "~/app/services/expiry";

/**
 * The most monitors one delivery looks up. Each costs one or two registry requests and a D1
 * write, so this stays well under the per-invocation subrequest ceiling, and a backlog drains
 * across the following hours.
 */
const MAX_LOOKUPS_PER_SWEEP = 200;

/** Lookups in flight against one registry, which rate-limits without saying where its limit is. */
const LOOKUPS_PER_REGISTRY = 2;

/** One looked-up monitor: the alert it warrants, if any, and the error code when the lookup failed. */
interface LookedUp {
	notification: NotifyMessage | null;
	error: string | null;
}

export default createJobHandler(jobs.checkDomainRegistrations, async (ctx) => {
	let monitors = await DnsMonitor.claimRegistrationDue(
		ctx.database,
		Date.now(),
		MAX_LOOKUPS_PER_SWEEP,
	);
	apportionCostByTeam(monitors.map((monitor) => monitor.team_id));

	let groups = await groupByRegistry(monitors);

	/** Registries run side by side; within one, lookups run {@link LOOKUPS_PER_REGISTRY} at a time. */
	let settled = (
		await Promise.all(
			groups.map((group) =>
				mapWithConcurrency(group, (monitor) => check(ctx.database, monitor), LOOKUPS_PER_REGISTRY),
			),
		)
	).flat();

	let notifications: NotifyMessage[] = [];
	let failedLookups = 0;
	let errors = 0;

	for (let outcome of settled) {
		if (!outcome.ok) {
			errors++;
			ctx.log.warn("checks.monitor_failed", {
				"monitor.id": outcome.item.id,
				error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
			});
			continue;
		}

		if (outcome.value.error !== null) failedLookups++;
		if (outcome.value.notification !== null) notifications.push(outcome.value.notification);
	}

	await enqueueNotifications(notifications);

	ctx.log.set({
		checks: {
			total: monitors.length,
			registries: groups.length,
			lookups_failed: failedLookups,
			failed: errors,
			notified: notifications.length,
		},
	});
});

/**
 * Splits the monitors by the registry that answers for them, so each registry's lookups are
 * paced on their own. A domain whose registry cannot be named lands in a group of its own
 * kind, where its lookup reports why.
 */
async function groupByRegistry(monitors: ClaimedRegistration[]): Promise<ClaimedRegistration[][]> {
	let groups = new Map<string, ClaimedRegistration[]>();

	for (let monitor of monitors) {
		let server = await rdapClient().server(monitor.domain);
		let key = isSuccess(server) && server.data !== null ? server.data.host : "";
		groups.set(key, [...(groups.get(key) ?? []), monitor]);
	}

	return [...groups.values()];
}

/**
 * Looks one monitor's domain up, persists the outcome, and builds the notification it
 * warrants. The days left are counted from the stored date after the write, so a failed
 * lookup inside the warning window still reminds.
 */
async function check(db: Database, monitor: ClaimedRegistration): Promise<LookedUp> {
	let now = Date.now();
	let lookup = await rdapClient().domain(monitor.domain);
	let patch = registrationOutcome(monitor, lookup, now);

	await DnsMonitor.recordRegistration(db, monitor.id, patch);

	let expiresAt =
		patch.registration_expires_at === undefined
			? monitor.registration_expires_at
			: patch.registration_expires_at;
	let { daysUntilExpiry } = classifyExpiry(expiresAt, monitor.registration_warning_days);
	let eppStatuses = isSuccess(lookup) ? lookup.data.status : [];

	let alert = shouldAlertOnRegistration(
		monitor.registration_status,
		patch.registration_status,
		daysUntilExpiry,
		eppStatuses,
	);

	return {
		error: isSuccess(lookup) ? null : lookup.error.code,
		notification: alert
			? {
					monitorType: "registration",
					monitorId: monitor.id,
					previousStatus: monitor.registration_status,
					newStatus: patch.registration_status,
				}
			: null,
	};
}
