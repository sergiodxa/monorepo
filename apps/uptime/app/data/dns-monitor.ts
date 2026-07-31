/**
 * Data-access model for DNS monitors. Exposes CRUD over the `dns_monitors` table
 * scoped to a team, the claim each sweep runs to take the monitors whose configured
 * `interval_seconds` has come round, its `dns_monitor_results` history, and the single
 * `recordCheckResult` write path both the scheduled job and the manual "Check now"
 * action use, so a check's history-insert and cached-fields-update never drift apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";

import type { DnsCheckResult } from "~/app/services/dns-check";
import type { InsertDnsMonitor, SelectDnsMonitor } from "~/database/schema";

import { claimDue, nextDueAtOnEnable, nextDueAtPatch } from "~/app/lib/scheduling";
import { dnsMonitorResults, dnsMonitors } from "~/database/schema";

/** Per-team limit from `docs/dns-monitors.md`. */
export const MAX_DNS_MONITORS_PER_TEAM = 20;

/** Most-recent results shown on a monitor's detail page. */
const RESULT_HISTORY_LIMIT = 50;

/**
 * What a claimed monitor's check needs to read. Adding a column the check uses is one edit
 * here: {@link ClaimedDnsMonitor} and {@link DnsMonitor.claimDue}'s return type both follow.
 */
const CLAIM_COLUMNS = [
	"id",
	"domain",
	"record_type",
	"expected_value",
	"last_value",
	"last_status",
] as const;

/** A DNS monitor claimed for a check, projected to the columns the check reads. */
export type ClaimedDnsMonitor = Pick<SelectDnsMonitor, (typeof CLAIM_COLUMNS)[number]>;

export default class DnsMonitor {
	/**
	 * Creates a DNS monitor for a team, enabled unless the caller says otherwise (matching
	 * the column's own default) and scheduled for its first check on the next cron tick, so
	 * a new monitor reports a status straight away instead of after one silent interval.
	 */
	static async create(db: Database, teamId: string, input: InsertDnsMonitor) {
		return await db.create(
			dnsMonitors,
			{
				id: generateUUID(),
				team_id: teamId,
				...input,
				next_due_at: nextDueAtOnEnable(input.is_enabled ?? true),
			},
			{ touch: true, returnRow: true },
		);
	}

	/** Lists every DNS monitor for a team, most recently created first. */
	static async listByTeam(db: Database, teamId: string) {
		return await db.findMany(dnsMonitors, {
			where: { team_id: teamId },
			orderBy: ["created_at", "desc"],
		});
	}

	/** Counts a team's DNS monitors, for the {@link MAX_DNS_MONITORS_PER_TEAM} limit. */
	static async countByTeam(db: Database, teamId: string) {
		return await db.count(dnsMonitors, { where: { team_id: teamId } });
	}

	/**
	 * Claims every DNS monitor whose next check is due as of `scheduledAt`, across every
	 * team, advancing each one's next due time as it does — see `claimDue` for the semantics
	 * all three monitor types share.
	 *
	 * This replaced a `listEnabled` that returned every enabled monitor on a fixed hourly
	 * sweep, which ignored `interval_seconds` entirely even though the column is editable,
	 * shown in the UI, and billed against.
	 */
	static async claimDue(db: Database, scheduledAt: number) {
		return await claimDue(db, dnsMonitors, CLAIM_COLUMNS, scheduledAt);
	}

	/** Finds a single DNS monitor scoped to a team, or `null` when it doesn't belong to it. */
	static async findByIdForTeam(db: Database, teamId: string, monitorId: string) {
		return await db.findOne(dnsMonitors, { where: { id: monitorId, team_id: teamId } });
	}

	/**
	 * Updates a DNS monitor's editable fields, keeping `next_due_at` consistent with them:
	 * scheduling lives entirely in that column, so an update that changes whether or how
	 * often a monitor should be checked has to move it in the same write.
	 */
	static async updateById(db: Database, monitorId: string, changes: Partial<InsertDnsMonitor>) {
		let patch = await nextDueAtPatch(db, dnsMonitors, monitorId, {
			enabled: changes.is_enabled,
			intervalSeconds: changes.interval_seconds,
		});

		return await db.update(dnsMonitors, monitorId, { ...changes, ...patch }, { touch: true });
	}

	/** Deletes a DNS monitor and its check-result history. */
	static async deleteById(db: Database, monitorId: string) {
		let results = await db.findMany(dnsMonitorResults, { where: { dns_monitor_id: monitorId } });
		for (let result of results) await db.delete(dnsMonitorResults, result.id);
		return await db.delete(dnsMonitors, monitorId);
	}

	/** Lists a monitor's most recent check results, newest first. */
	static async listResults(db: Database, monitorId: string, limit: number = RESULT_HISTORY_LIMIT) {
		return await db.findMany(dnsMonitorResults, {
			where: { dns_monitor_id: monitorId },
			orderBy: ["checked_at", "desc"],
			limit,
		});
	}

	/**
	 * Records a check's outcome: inserts a history row and updates the monitor's cached
	 * "last checked" fields (including `last_value`, which becomes the next check's
	 * change-detection baseline) in one call.
	 */
	static async recordCheckResult(db: Database, monitorId: string, result: DnsCheckResult) {
		let checkedAt = Date.now();

		await db.create(
			dnsMonitorResults,
			{
				id: generateUUID(),
				dns_monitor_id: monitorId,
				status: result.status,
				resolved_value: result.resolvedValue,
				response_time_ms: result.responseTimeMs,
				error_message: result.errorMessage ?? null,
				checked_at: checkedAt,
			},
			{ touch: true, returnRow: true },
		);

		await db.update(
			dnsMonitors,
			monitorId,
			{
				last_checked_at: checkedAt,
				last_status: result.status,
				last_value: result.resolvedValue,
			},
			{ touch: true },
		);
	}
}
