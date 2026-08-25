/**
 * Data-access model for TCP monitors. Exposes CRUD over the `tcp_monitors` table
 * scoped to a team, the claim each sweep runs to take the monitors whose configured
 * `interval_seconds` has come round, its `tcp_monitor_results` history, and the single
 * `recordCheckResult` write path both the scheduled job and the manual "Check now"
 * action use, so a check's history-insert and cached-fields-update never drift apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";

import type { TcpCheckResult } from "~/app/services/tcp-check";
import type { InsertTcpMonitor, SelectTcpMonitor } from "~/database/schema";

import { claimDue, nextDueAtOnEnable, nextDueAtPatch } from "~/app/lib/scheduling";
import { tcpMonitorResults, tcpMonitors } from "~/database/schema";

/** Most-recent results shown on a monitor's detail page. */
const RESULT_HISTORY_LIMIT = 50;

/**
 * What a claimed monitor's check needs to read. Adding a column the check uses is one edit
 * here: {@link ClaimedTcpMonitor} and {@link TcpMonitor.claimDue}'s return type both follow.
 * `team_id` rides along so the sweep can apportion its cost across teams (ADR-007 §5).
 */
const CLAIM_COLUMNS = ["id", "team_id", "host", "port", "timeout_ms", "last_status"] as const;

/** A TCP monitor claimed for a check, projected to the columns the check reads. */
export type ClaimedTcpMonitor = Pick<SelectTcpMonitor, (typeof CLAIM_COLUMNS)[number]>;

export default class TcpMonitor {
	/**
	 * Creates a TCP monitor for a team, enabled unless the caller says otherwise (matching the
	 * column's own default) and due immediately, so a new monitor reports its first status on
	 * the next cron tick.
	 */
	static async create(db: Database, teamId: string, input: InsertTcpMonitor) {
		return await db.create(
			tcpMonitors,
			{
				id: generateUUID(),
				team_id: teamId,
				...input,
				next_due_at: nextDueAtOnEnable(input.is_enabled ?? true),
			},
			{ touch: true, returnRow: true },
		);
	}

	/** Lists every TCP monitor for a team, most recently created first. */
	static async listByTeam(db: Database, teamId: string) {
		return await db.findMany(tcpMonitors, {
			where: { team_id: teamId },
			orderBy: ["created_at", "desc"],
		});
	}

	/**
	 * Claims every TCP monitor whose next check is due as of `scheduledAt`, across every team,
	 * advancing each one's next due time as it does — see `claimDue` for the semantics all
	 * three monitor types share.
	 */
	static async claimDue(db: Database, scheduledAt: number) {
		return await claimDue(db, tcpMonitors, CLAIM_COLUMNS, scheduledAt);
	}

	/** Finds a single TCP monitor scoped to a team, or `null` when it doesn't belong to it. */
	static async findByIdForTeam(db: Database, teamId: string, monitorId: string) {
		return await db.findOne(tcpMonitors, { where: { id: monitorId, team_id: teamId } });
	}

	/**
	 * Updates a TCP monitor's editable fields, keeping `next_due_at` consistent with them:
	 * scheduling lives entirely in that column, so an update that changes whether or how
	 * often a monitor should be checked has to move it in the same write.
	 */
	static async updateById(db: Database, monitorId: string, changes: Partial<InsertTcpMonitor>) {
		let patch = await nextDueAtPatch(db, tcpMonitors, monitorId, {
			enabled: changes.is_enabled,
			intervalSeconds: changes.interval_seconds,
		});

		return await db.update(tcpMonitors, monitorId, { ...changes, ...patch }, { touch: true });
	}

	/** Deletes a TCP monitor and its check-result history. */
	static async deleteById(db: Database, monitorId: string) {
		let results = await db.findMany(tcpMonitorResults, { where: { tcp_monitor_id: monitorId } });
		for (let result of results) await db.delete(tcpMonitorResults, result.id);
		return await db.delete(tcpMonitors, monitorId);
	}

	/** Lists a monitor's most recent check results, newest first. */
	static async listResults(db: Database, monitorId: string, limit: number = RESULT_HISTORY_LIMIT) {
		return await db.findMany(tcpMonitorResults, {
			where: { tcp_monitor_id: monitorId },
			orderBy: ["checked_at", "desc"],
			limit,
		});
	}

	/** Lists a monitor's most recent check results, newest first, with offset pagination. */
	static async listResultsPage(
		db: Database,
		monitorId: string,
		options: { limit: number; offset: number },
	) {
		let rows = await db.findMany(tcpMonitorResults, {
			where: { tcp_monitor_id: monitorId },
			orderBy: ["checked_at", "desc"],
			limit: options.limit + 1,
			offset: options.offset,
		});

		let hasMore = rows.length > options.limit;
		return { results: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
	}

	/**
	 * Records a check's outcome: inserts a history row and updates the monitor's cached fields.
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
		result: TcpCheckResult,
	): Promise<string> {
		let checkedAt = Date.now();
		let id = generateUUID();

		await db.create(
			tcpMonitorResults,
			{
				id,
				tcp_monitor_id: monitorId,
				status: result.status,
				response_time_ms: result.responseTimeMs,
				error_message: result.errorMessage ?? null,
				checked_at: checkedAt,
			},
			{ touch: true, returnRow: true },
		);

		await db.update(
			tcpMonitors,
			monitorId,
			{
				last_checked_at: checkedAt,
				last_status: result.status,
				last_response_time_ms: result.responseTimeMs,
			},
			{ touch: true },
		);

		return id;
	}
}
