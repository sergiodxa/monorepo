/**
 * Data-access model for DNS monitors: team-scoped CRUD over `dns_monitors`, the claim each
 * sweep runs to take the monitors whose `interval_seconds` has come round, the
 * `dns_monitor_results` history, and the single `recordCheckResult` write path both the
 * scheduled job and "Check now" use, so history and cached fields move together.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";

import type { InsertDnsMonitor, SelectDnsMonitor, SelectDnsMonitorResult } from "~/database/schema";

import DnsMonitorRecord from "~/app/data/dns-monitor-record";
import { claimDue, nextDueAtOnEnable, nextDueAtPatch } from "~/app/lib/scheduling";
import { dnsMonitorResults, dnsMonitors } from "~/database/schema";

/** Per-team limit from `docs/dns-monitors.md`. */
export const MAX_DNS_MONITORS_PER_TEAM = 20;

/** Most-recent results shown on a monitor's detail page. */
const RESULT_HISTORY_LIMIT = 50;

/**
 * What a claimed monitor's check reads, projected so `team_id` (whose cost), `name` (the
 * alert body) and `zone_file_imported_at` (how names were found) cost no second read. Only
 * non-boolean columns: values arrive as the database holds them, booleans as 0/1.
 */
const CLAIM_COLUMNS = [
	"id",
	"team_id",
	"name",
	"domain",
	"zone_file_imported_at",
	"last_status",
] as const;

/** A DNS monitor claimed for a check, projected to the columns the check reads. */
export type ClaimedDnsMonitor = Pick<SelectDnsMonitor, (typeof CLAIM_COLUMNS)[number]>;

/**
 * What a completed check reports to this table: one status, the slowest query's latency,
 * and the per-record counters. Owned by the table, so its shape moves only when what a
 * result row means moves; omitted counters fall back to the columns' zero defaults.
 */
export interface DnsCheckOutcome {
	status: SelectDnsMonitorResult["status"];
	/** The slowest single query, which is what a latency chart plots. */
	responseTimeMs: number | null;
	errorMessage?: string | null;
	recordsChecked?: number;
	recordsChanged?: number;
	recordsMissing?: number;
	recordsNew?: number;
	/** Queries that failed, leaving their records at the state the check found them in. */
	queriesFailed?: number;
}

export default class DnsMonitor {
	/**
	 * Creates a DNS monitor for a team, enabled unless the caller says otherwise (matching
	 * the column's own default) and scheduled for its first check on the next cron tick, so a
	 * new monitor reports a status straight away.
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
	 * Claims every DNS monitor whose next check is due as of `scheduledAt`, across every team,
	 * advancing each one's next due time as it does — see `claimDue` for the semantics all
	 * three monitor types share.
	 */
	static async claimDue(db: Database, scheduledAt: number) {
		return await claimDue(db, dnsMonitors, CLAIM_COLUMNS, scheduledAt);
	}

	/** Finds a single DNS monitor scoped to a team; `null` for any id outside it. */
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

	/**
	 * Deletes a DNS monitor, its check-result history and its tracked records. All three,
	 * because the retention sweep visits history alone while `dns_monitor_records` holds
	 * configuration, so a row left behind here would outlive its monitor forever.
	 */
	static async deleteById(db: Database, monitorId: string) {
		await DnsMonitorRecord.deleteByMonitor(db, monitorId);
		await db.deleteMany(dnsMonitorResults, { where: { dns_monitor_id: monitorId } });
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
	 * "last checked" fields in one call. Counters a caller omits stay at the column default
	 * of zero, a truthful "this check measured none of that".
	 *
	 * @returns The history row's id. It is the only thing about a completed check that is
	 * unique and already persisted, which is what makes it the idempotency key the ping meter
	 * bills against: a redelivery of the same recorded check meters once.
	 */
	static async recordCheckResult(
		db: Database,
		monitorId: string,
		result: DnsCheckOutcome,
	): Promise<string> {
		let checkedAt = Date.now();
		let id = generateUUID();

		await db.create(
			dnsMonitorResults,
			{
				id,
				dns_monitor_id: monitorId,
				status: result.status,
				records_checked: result.recordsChecked ?? 0,
				records_changed: result.recordsChanged ?? 0,
				records_missing: result.recordsMissing ?? 0,
				records_new: result.recordsNew ?? 0,
				queries_failed: result.queriesFailed ?? 0,
				response_time_ms: result.responseTimeMs,
				error_message: result.errorMessage ?? null,
				checked_at: checkedAt,
			},
			{ touch: true, returnRow: true },
		);

		await db.update(
			dnsMonitors,
			monitorId,
			{ last_checked_at: checkedAt, last_status: result.status },
			{ touch: true },
		);

		return id;
	}
}
