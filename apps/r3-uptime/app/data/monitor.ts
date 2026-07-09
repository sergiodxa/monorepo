/**
 * Data-access model for HTTP monitors. Exposes CRUD over the `monitors` table scoped
 * to a team, triggering an on-demand check via the `PING` workflow, and the scheduling
 * query the `scheduled` handler uses every minute to find monitors due for a check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { env } from "cloudflare:workers";
import { and, eq, inList } from "remix/data-table";

import type { InsertMonitor } from "~/database/schema";

import { monitorResults, monitors } from "~/database/schema";

/** A monitor due for a check, with the team owner id the usage/billing gate needs. */
export interface DueMonitor {
	monitorId: string;
	ownerId: string;
}

/** Aggregate uptime/response-time stats for a monitor (or a team's monitors). */
export interface MonitorStats {
	total: number;
	uptime: number | null;
	lastCheck: number | null;
	p99: number | null;
}

interface StatsRow {
	total: number;
	uptime: number | null;
	lastCheck: number | null;
}

export default class Monitor {
	/** Creates a monitor for a team, enabled immediately. */
	static async create(db: Database, teamId: string, authorId: string, input: InsertMonitor) {
		return await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: teamId,
				author_id: authorId,
				enabled_at: Date.now(),
				...input,
			},
			{ touch: true, returnRow: true },
		);
	}

	/** Lists every monitor for a team, most recently created first. */
	static async listByTeam(db: Database, teamId: string) {
		return await db.findMany(monitors, {
			where: { team_id: teamId },
			orderBy: ["created_at", "desc"],
		});
	}

	/** Counts a team's monitors. */
	static async countByTeam(db: Database, teamId: string) {
		return await db.count(monitors, { where: { team_id: teamId } });
	}

	/** Lists every monitor with SSL monitoring enabled, across every team. */
	static async listSslEnabled(db: Database) {
		return await db.findMany(monitors, { where: { ssl_monitoring_enabled: true } });
	}

	/** Finds a single monitor scoped to a team, or `null` when it doesn't belong to it. */
	static async findByIdForTeam(db: Database, teamId: string, monitorId: string) {
		return await db.findOne(monitors, { where: { id: monitorId, team_id: teamId } });
	}

	/** Finds every monitor in `monitorIds` that belongs to `teamId`. */
	static async findManyByIdsForTeam(db: Database, teamId: string, monitorIds: string[]) {
		if (monitorIds.length === 0) return [];
		return await db.findMany(monitors, {
			where: and(eq("team_id", teamId), inList("id", monitorIds)),
		});
	}

	/** Updates a monitor's editable fields. */
	static async updateById(db: Database, monitorId: string, changes: Partial<InsertMonitor>) {
		return await db.update(monitors, monitorId, changes, { touch: true });
	}

	/** Deletes a monitor. */
	static async deleteById(db: Database, monitorId: string) {
		return await db.delete(monitors, monitorId);
	}

	/** Starts a `PING` workflow instance for an on-demand or scheduled check. */
	static async ping(monitorId: string) {
		let instanceId = `${monitorId}-${Date.now()}`;
		return await env.PING.create({ id: instanceId, params: { monitorId } });
	}

	/**
	 * Finds every enabled monitor due for a check: one whose interval has elapsed since
	 * its last completed result (or that has never completed one). Runs as a single
	 * query joining the monitor's team owner and latest `monitor_results` row, since
	 * checking each monitor individually would be an N+1 query every minute.
	 */
	static async findDue(db: Database, scheduledAt: number): Promise<DueMonitor[]> {
		let result = await db.exec(
			`SELECT m.id AS monitorId, t.owner_id AS ownerId
			 FROM monitors m
			 JOIN teams t ON t.id = m.team_id
			 LEFT JOIN (
			   SELECT monitor_id, MAX(completed_at) AS last_completed_at
			   FROM monitor_results
			   WHERE completed_at IS NOT NULL
			   GROUP BY monitor_id
			 ) r ON r.monitor_id = m.id
			 WHERE m.enabled_at IS NOT NULL
			   AND (r.last_completed_at IS NULL OR r.last_completed_at + (m.interval_seconds * 1000) <= ?)`,
			[scheduledAt],
		);

		return (result.rows ?? []) as unknown as DueMonitor[];
	}

	/** Lists a monitor's most recent completed results, newest first, with pagination. */
	static async listResults(
		db: Database,
		monitorId: string,
		options: { limit: number; offset: number },
	) {
		let rows = await db.findMany(monitorResults, {
			where: { monitor_id: monitorId },
			orderBy: ["created_at", "desc"],
			limit: options.limit + 1,
			offset: options.offset,
		});

		let hasMore = rows.length > options.limit;
		return { results: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
	}

	/** Computes total checks, uptime percentage, last-check time, and p99 response time for one monitor. */
	static async getStatsById(db: Database, monitorId: string): Promise<MonitorStats> {
		return await Monitor.getStats(db, "r.monitor_id = ?", [monitorId]);
	}

	/** Computes total checks, uptime percentage, last-check time, and p99 response time across a team. */
	static async getStatsByTeamId(db: Database, teamId: string): Promise<MonitorStats> {
		return await Monitor.getStats(db, "m.team_id = ?", [teamId]);
	}

	private static async getStats(
		db: Database,
		scopeClause: string,
		scopeParams: string[],
	): Promise<MonitorStats> {
		let [statsResult, responseTimesResult] = await Promise.all([
			db.exec(
				`SELECT
					COUNT(*) AS total,
					SUM(CASE WHEN r.response_status = m.expected_status THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS uptime,
					MAX(r.completed_at) AS lastCheck
				 FROM monitor_results r
				 JOIN monitors m ON r.monitor_id = m.id
				 WHERE ${scopeClause} AND r.completed_at IS NOT NULL AND r.response_status IS NOT NULL`,
				scopeParams,
			),
			db.exec(
				`SELECT r.response_time_ms AS responseTimeMs
				 FROM monitor_results r
				 JOIN monitors m ON r.monitor_id = m.id
				 WHERE ${scopeClause} AND r.response_time_ms IS NOT NULL
				 ORDER BY r.response_time_ms ASC`,
				scopeParams,
			),
		]);

		let [row] = (statsResult.rows ?? []) as unknown as StatsRow[];
		let responseTimes = (
			(responseTimesResult.rows ?? []) as unknown as Array<{ responseTimeMs: number }>
		).map((r) => r.responseTimeMs);
		let p99Index = Math.floor(responseTimes.length * 0.99);

		return {
			total: row?.total ?? 0,
			uptime: row?.uptime ?? null,
			lastCheck: row?.lastCheck ?? null,
			p99: responseTimes[p99Index] ?? null,
		};
	}
}
