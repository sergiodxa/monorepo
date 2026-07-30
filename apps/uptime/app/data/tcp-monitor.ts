/**
 * Data-access model for TCP monitors. Exposes CRUD over the `tcp_monitors` table
 * scoped to a team, its `tcp_monitor_results` history, and the single
 * `recordCheckResult` write path both the scheduled job and the manual "Check now"
 * action use, so a check's history-insert and cached-fields-update never drift apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";

import type { TcpCheckResult } from "~/app/services/tcp-check";
import type { InsertTcpMonitor } from "~/database/schema";

import { tcpMonitorResults, tcpMonitors } from "~/database/schema";

/** Most-recent results shown on a monitor's detail page. */
const RESULT_HISTORY_LIMIT = 50;

export default class TcpMonitor {
	/** Creates a TCP monitor for a team, enabled immediately. */
	static async create(db: Database, teamId: string, input: InsertTcpMonitor) {
		return await db.create(
			tcpMonitors,
			{ id: generateUUID(), team_id: teamId, ...input },
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

	/** Lists every TCP monitor with checking enabled, across every team. */
	static async listEnabled(db: Database) {
		return await db.findMany(tcpMonitors, { where: { is_enabled: true } });
	}

	/** Finds a single TCP monitor scoped to a team, or `null` when it doesn't belong to it. */
	static async findByIdForTeam(db: Database, teamId: string, monitorId: string) {
		return await db.findOne(tcpMonitors, { where: { id: monitorId, team_id: teamId } });
	}

	/** Updates a TCP monitor's editable fields. */
	static async updateById(db: Database, monitorId: string, changes: Partial<InsertTcpMonitor>) {
		return await db.update(tcpMonitors, monitorId, changes, { touch: true });
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

	/** Records a check's outcome: inserts a history row and updates the monitor's cached fields. */
	static async recordCheckResult(db: Database, monitorId: string, result: TcpCheckResult) {
		let checkedAt = Date.now();

		await db.create(
			tcpMonitorResults,
			{
				id: generateUUID(),
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
	}
}
