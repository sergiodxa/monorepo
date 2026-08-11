/**
 * Data-access model for DNS monitors. Exposes CRUD over the `dns_monitors` table
 * scoped to a team, the claim each sweep runs to take the monitors whose configured
 * `interval_seconds` has come round, its `dns_monitor_results` history, and the single
 * `recordCheckResult` write path both the scheduled job and the manual "Check now"
 * action use, so a check's history-insert and cached-fields-update never drift apart.
 *
 * A monitor watches a domain rather than a record type: what it tracks lives in
 * `dns_monitor_records`, which is why deleting one has to reach into that table too.
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
 * What a claimed monitor's check needs to read. Adding a column the check uses is one edit
 * here: {@link ClaimedDnsMonitor} and {@link DnsMonitor.claimDue}'s return type both follow.
 *
 * `team_id` is not read by the check itself: the sweep apportions its own cost across the
 * teams whose monitors it swept (ADR-007 §5), and the `RETURNING` projection is where that
 * denominator costs nothing.
 *
 * `name` is here because a sweep's findings identify the monitor by name in the alert body,
 * and `zone_file_imported_at` because it is the only monitor-level fact left about how the
 * tracked names were discovered: a sweep that finds no tracked names must tell "no zone file
 * was ever imported, so this monitor covers the apex alone" apart from "an import ran and
 * produced nothing", and those two deserve different reports. Both would otherwise be a
 * second read per claimed monitor for columns the claim already had in hand.
 *
 * Only non-boolean columns belong here — `claimDue` returns values as the database holds
 * them, so `is_enabled` would arrive as 0/1 despite its declared type.
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
 * What a completed check reports to this table: one status for the monitor, the slowest
 * query's latency, and the per-record counters the sweep counted.
 *
 * Declared here rather than imported from whichever service performed the check, because it
 * is this table's write contract and not that service's return type. The two are free to
 * differ — a sweep carries findings, values and per-query timings that no column stores —
 * and pinning the column list to a service's shape would make every change to what a check
 * computes a change to what a result row means.
 *
 * The counters are optional so a caller with nothing to report writes zeros rather than
 * inventing numbers, per the columns' own defaults.
 */
export interface DnsCheckOutcome {
	status: SelectDnsMonitorResult["status"];
	/** The slowest single query, not the sum: this feeds a latency chart, not a cost one. */
	responseTimeMs: number | null;
	errorMessage?: string | null;
	recordsChecked?: number;
	recordsChanged?: number;
	recordsMissing?: number;
	recordsNew?: number;
	/** Queries that did not answer, and whose records were therefore not diffed at all. */
	queriesFailed?: number;
}

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

	/**
	 * Deletes a DNS monitor, its check-result history and its tracked records.
	 *
	 * All three, because nothing else ever will: `dns_monitor_records` is configuration
	 * rather than history, so the retention sweep does not visit it, and a row left behind
	 * would be a record belonging to a monitor that no longer exists — invisible, undeletable,
	 * and counted by anything that counts records.
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
	 * "last checked" fields in one call.
	 *
	 * Counters a caller omits stay at the column default of zero, which is a truthful "this
	 * check measured none of that" rather than a missing value.
	 *
	 * @returns The history row's id. It is the only thing about a completed check that is
	 * unique and already persisted, which is what makes it the idempotency key the ping
	 * meter bills against: a redelivered sweep that somehow re-recorded the same check
	 * would ingest a different id and double-bill, whereas anything derived from the clock
	 * or a fresh random value could never dedupe at all.
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
