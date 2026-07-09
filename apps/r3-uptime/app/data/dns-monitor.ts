/**
 * Data-access model for DNS monitors. Exposes CRUD over the `dns_monitors` table
 * scoped to a team, its `dns_monitor_results` history, and the single
 * `recordCheckResult` write path both the scheduled job and the manual "Check now"
 * action use, so a check's history-insert and cached-fields-update never drift apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import type { DnsCheckResult } from "~/app/services/dns-check";
import type { InsertDnsMonitor } from "~/database/schema";

import { dnsMonitorResults, dnsMonitors } from "~/database/schema";

/** Per-team limit from `docs/dns-monitors.md`. */
export const MAX_DNS_MONITORS_PER_TEAM = 20;

/** Most-recent results shown on a monitor's detail page. */
const RESULT_HISTORY_LIMIT = 50;

export default class DnsMonitor {
	/** Creates a DNS monitor for a team, enabled immediately. */
	static async create(db: Database, teamId: string, input: InsertDnsMonitor) {
		return await db.create(
			dnsMonitors,
			{ id: crypto.randomUUID(), team_id: teamId, ...input },
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

	/** Lists every DNS monitor with checking enabled, across every team. */
	static async listEnabled(db: Database) {
		return await db.findMany(dnsMonitors, { where: { is_enabled: true } });
	}

	/** Finds a single DNS monitor scoped to a team, or `null` when it doesn't belong to it. */
	static async findByIdForTeam(db: Database, teamId: string, monitorId: string) {
		return await db.findOne(dnsMonitors, { where: { id: monitorId, team_id: teamId } });
	}

	/** Updates a DNS monitor's editable fields. */
	static async updateById(db: Database, monitorId: string, changes: Partial<InsertDnsMonitor>) {
		return await db.update(dnsMonitors, monitorId, changes, { touch: true });
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
				id: crypto.randomUUID(),
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
