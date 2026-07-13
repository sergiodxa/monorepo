/**
 * Data-access model for HTTP monitors. Exposes CRUD over the `monitors` table scoped
 * to a team, triggering an on-demand check via the `PING` workflow, the scheduling
 * query the `scheduled` handler uses every minute to find monitors due for a check,
 * and an estimated monthly ping-consumption figure across every monitor type (HTTP,
 * DNS, TCP, cron) — the dashboard's usage card shows this alongside Polar's actual
 * billed usage, since Polar doesn't offer a "what would this cost at current
 * settings" projection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";
import { env } from "cloudflare:workers";
import { CronExpressionParser } from "cron-parser";
import { and, eq, inList, notNull } from "remix/data-table";

import type { InsertMonitor } from "~/database/schema";

import {
	cronJobMonitors,
	dnsMonitors,
	monitorResults,
	monitors,
	tcpMonitors,
} from "~/database/schema";

/** Safety cap on cron occurrences counted per job, guarding against a pathological expression. */
const MAX_CRON_OCCURRENCES_PER_MONTH = 100_000;

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
				id: generateUUID(),
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

	/**
	 * Estimates a team's total ping consumption for the calendar month containing
	 * `date`, across every monitor type: HTTP/DNS/TCP monitors are projected as
	 * `monthMilliseconds / intervalMs` (how many checks their interval would produce
	 * over the whole month), and cron jobs are counted by walking their cron
	 * expression's occurrences with `cron-parser`. This is a projection based on
	 * current settings, not the team's actual Polar-billed usage (which only reflects
	 * checks that have already run) — the dashboard shows both figures side by side.
	 */
	static async estimateConsumedPingsByTeam(
		db: Database,
		teamId: string,
		date: Date,
	): Promise<number> {
		let start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
		let end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
		let monthMs = end.getTime() - start.getTime();

		let [httpMonitors, teamDnsMonitors, teamTcpMonitors, teamCronJobs] = await Promise.all([
			db.findMany(monitors, { where: and(eq("team_id", teamId), notNull("enabled_at")) }),
			db.findMany(dnsMonitors, { where: { team_id: teamId, is_enabled: true } }),
			db.findMany(tcpMonitors, { where: { team_id: teamId, is_enabled: true } }),
			db.findMany(cronJobMonitors, { where: and(eq("team_id", teamId), notNull("enabled_at")) }),
		]);

		let httpPings = httpMonitors.reduce((sum, m) => sum + monthMs / (m.interval_seconds * 1000), 0);
		let dnsPings = teamDnsMonitors.reduce(
			(sum, m) => sum + monthMs / (m.interval_seconds * 1000),
			0,
		);
		let tcpPings = teamTcpMonitors.reduce(
			(sum, m) => sum + monthMs / (m.interval_seconds * 1000),
			0,
		);

		let cronPings = 0;
		for (let job of teamCronJobs) {
			try {
				let interval = CronExpressionParser.parse(job.cron_expression, {
					currentDate: start,
					tz: job.timezone ?? "UTC",
				});

				let occurrences = 0;
				let next = interval.next();
				while (next.toDate() <= end) {
					occurrences++;
					if (occurrences > MAX_CRON_OCCURRENCES_PER_MONTH) break;
					next = interval.next();
				}
				cronPings += occurrences;
			} catch {
				// Skip jobs with an unparsable cron expression rather than fail the whole estimate.
			}
		}

		return Math.round(httpPings + dnsPings + tcpPings + cronPings);
	}
}
