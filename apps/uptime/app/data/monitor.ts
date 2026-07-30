/**
 * Data-access model for HTTP monitors. Exposes CRUD over the `monitors` table scoped
 * to a team, enqueuing a subscription-gated on-demand check, the scheduling
 * query the `scheduled` handler uses every minute to find monitors due for a check,
 * and the two monthly ping-consumption figures the dashboard's usage card shows side
 * by side across every monitor type (HTTP, DNS, TCP, cron): the pings already
 * consumed, counted from the daily rollup plus the days it hasn't reached yet, and
 * the consumption the team's current intervals project over the whole month.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PolarClient } from "@pkg/polar";
import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";
import { env } from "cloudflare:workers";
import { CronExpressionParser } from "cron-parser";
import { and, eq, inList, notNull } from "remix/data-table";

import type { InsertMonitor } from "~/database/schema";

import Customer from "~/app/data/customer";
import {
	cronJobMonitors,
	dnsMonitors,
	monitorResults,
	monitors,
	tcpMonitors,
} from "~/database/schema";

/** Milliseconds in a minute, the bucket size for a scheduled check's job id. */
const MS_PER_MINUTE = 60_000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How many recent days {@link Monitor.countConsumedPingsByTeam} counts from the raw
 * result tables instead of the daily rollup: today plus yesterday, so the count holds
 * whether or not the 01:00 UTC aggregation job has run. Must stay well below
 * `CleanJob`'s 7-day `monitor_results` retention, which is what keeps those rows
 * around to be counted.
 */
const RAW_PING_WINDOW_DAYS = 2;

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

	/**
	 * Enqueues an on-demand check for a monitor, unless `ownerId`'s team has no active
	 * subscription — billing is settled here rather than in the consumer, so a queued
	 * check is always one that's allowed to run. Returns whether it was enqueued, which
	 * is what lets the caller tell the visitor their check isn't going to happen.
	 */
	static async ping(polar: PolarClient, monitorId: string, ownerId: string): Promise<boolean> {
		if (!(await Customer.hasActiveSubscription(polar, ownerId))) return false;

		await env.QUEUE.send({
			type: "checkHttp",
			id: `${monitorId}:manual:${generateUUID()}`,
			monitorId,
			scheduledAt: Date.now(),
		});
		return true;
	}

	/**
	 * The job id for a scheduled check, which is also the `monitor_results` primary key
	 * the consumer dedupes on.
	 *
	 * Keyed on the minute containing `scheduledAt` rather than on `scheduledAt` itself,
	 * because the every-minute cron is delivered more than once per minute with a
	 * different `scheduledTime` each time (observed ~7s apart in production).
	 * {@link findDue} can't filter the second delivery out on its own — the first check
	 * hasn't written its `completed_at` yet, so the monitor still reads as due — and a
	 * raw timestamp would hand the two deliveries different ids and let both run. One id
	 * per minute makes the second collide with the first instead. Safe because the
	 * minimum `interval_seconds` is 60, so no monitor can legitimately owe two checks
	 * inside the same minute.
	 */
	static scheduledJobId(monitorId: string, scheduledAt: number): string {
		return `${monitorId}:${Math.floor(scheduledAt / MS_PER_MINUTE)}`;
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
	 * Counts a team's pings actually consumed during the calendar month containing
	 * `date`, across every monitor type. Unlike
	 * {@link estimateConsumedPingsByTeam}'s projection of current settings, this
	 * measures what has already run.
	 *
	 * Reads two stores, because neither one covers a whole month on its own:
	 *
	 * - `monitor_daily_stats.total_checks`, the per-monitor-per-day rollup
	 *   `AggregateDailyStatsJob` writes at 01:00 UTC for the day before, which is the
	 *   only durable record of an HTTP check once `CleanJob` has purged its
	 *   `monitor_results` row (7-day retention, so raw counting alone would silently
	 *   truncate the month to its last week).
	 * - the raw result tables (`monitor_results`, `dns_monitor_results`,
	 *   `tcp_monitor_results`, `cron_job_pings`) for the {@link RAW_PING_WINDOW_DAYS}
	 *   most recent days, which the rollup hasn't reached yet.
	 *
	 * The two windows are cut so they can't overlap: the rollup half stops the day
	 * before the raw half starts. That also makes the figure independent of whether
	 * today's aggregation job has run yet, and the raw window stays well inside the
	 * 7-day retention that keeps those rows around to be counted.
	 *
	 * A day the aggregation job failed for is missing from the rollup and therefore
	 * undercounts, which is preferred over the double counting that overlapping the
	 * two windows to compensate would cause.
	 *
	 * Runs as one query of eight team-scoped sub-counts, since the dashboard's usage
	 * card blocks on it.
	 */
	static async countConsumedPingsByTeam(db: Database, teamId: string, date: Date): Promise<number> {
		let monthStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
		let monthEnd = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999);

		let dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
		let rawStart = Math.max(monthStart, dayStart - (RAW_PING_WINDOW_DAYS - 1) * MS_PER_DAY);

		/**
		 * The rollup half ends the day before the raw half begins. Early in the month
		 * that lands in the previous month, leaving `BETWEEN` an empty range — correct,
		 * since the raw window already covers everything the month contains.
		 */
		let rollupFrom = utcDate(monthStart);
		let rollupTo = utcDate(rawStart - MS_PER_DAY);

		/** What each sub-count binds, in the order the query's placeholders read them. */
		let rollupScope = [teamId, rollupFrom, rollupTo];
		let rawScope = [teamId, rawStart, monthEnd];

		let result = await db.exec(
			`SELECT
			   (SELECT COALESCE(SUM(s.total_checks), 0) FROM monitor_daily_stats s
			      JOIN monitors m ON m.id = s.monitor_id
			     WHERE s.monitor_type = 'http' AND m.team_id = ? AND s.date BETWEEN ? AND ?)
			 + (SELECT COALESCE(SUM(s.total_checks), 0) FROM monitor_daily_stats s
			      JOIN dns_monitors m ON m.id = s.monitor_id
			     WHERE s.monitor_type = 'dns' AND m.team_id = ? AND s.date BETWEEN ? AND ?)
			 + (SELECT COALESCE(SUM(s.total_checks), 0) FROM monitor_daily_stats s
			      JOIN tcp_monitors m ON m.id = s.monitor_id
			     WHERE s.monitor_type = 'tcp' AND m.team_id = ? AND s.date BETWEEN ? AND ?)
			 + (SELECT COALESCE(SUM(s.total_checks), 0) FROM monitor_daily_stats s
			      JOIN cron_job_monitors m ON m.id = s.monitor_id
			     WHERE s.monitor_type = 'cron' AND m.team_id = ? AND s.date BETWEEN ? AND ?)
			 + (SELECT COUNT(*) FROM monitor_results r
			      JOIN monitors m ON m.id = r.monitor_id
			     WHERE m.team_id = ? AND r.created_at BETWEEN ? AND ?)
			 + (SELECT COUNT(*) FROM dns_monitor_results r
			      JOIN dns_monitors m ON m.id = r.dns_monitor_id
			     WHERE m.team_id = ? AND r.checked_at BETWEEN ? AND ?)
			 + (SELECT COUNT(*) FROM tcp_monitor_results r
			      JOIN tcp_monitors m ON m.id = r.tcp_monitor_id
			     WHERE m.team_id = ? AND r.checked_at BETWEEN ? AND ?)
			 + (SELECT COUNT(*) FROM cron_job_pings p
			      JOIN cron_job_monitors m ON m.id = p.cron_job_monitor_id
			     WHERE m.team_id = ? AND p.created_at BETWEEN ? AND ?) AS consumed`,
			[
				...rollupScope,
				...rollupScope,
				...rollupScope,
				...rollupScope,
				...rawScope,
				...rawScope,
				...rawScope,
				...rawScope,
			],
		);

		let [row] = (result.rows ?? []) as unknown as Array<{ consumed: number }>;
		return row?.consumed ?? 0;
	}

	/**
	 * Estimates a team's total ping consumption for the calendar month containing
	 * `date`, across every monitor type: HTTP/DNS/TCP monitors are projected as
	 * `monthMilliseconds / intervalMs` (how many checks their interval would produce
	 * over the whole month), and cron jobs are counted by walking their cron
	 * expression's occurrences with `cron-parser`. This is a projection based on
	 * current settings, not what the team has actually consumed so far (which is what
	 * {@link countConsumedPingsByTeam} counts) — the dashboard shows both side by side.
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

	/**
	 * Estimates one HTTP monitor's ping consumption for the calendar month containing
	 * `date`, projected from its current check interval — the same
	 * `monthMilliseconds / intervalMs` projection {@link estimateConsumedPingsByTeam}
	 * sums across every monitor. Returns 0 when the monitor doesn't exist.
	 */
	static async estimateConsumedPingsByMonitor(
		db: Database,
		monitorId: string,
		date: Date,
	): Promise<number> {
		let monitor = await db.findOne(monitors, { where: { id: monitorId } });
		if (!monitor) return 0;

		let start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
		let end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
		let monthMs = end.getTime() - start.getTime();

		return Math.round(monthMs / (monitor.interval_seconds * 1000));
	}
}

/** An epoch-ms timestamp as the `"YYYY-MM-DD"` UTC date string `monitor_daily_stats.date` holds. */
function utcDate(timestamp: number): string {
	return new Date(timestamp).toISOString().slice(0, 10);
}
