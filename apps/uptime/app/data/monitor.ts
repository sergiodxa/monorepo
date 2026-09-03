/**
 * Data-access model for HTTP monitors: team-scoped CRUD, the subscription-gated
 * on-demand check, the claim the `scheduled` handler runs every minute over the monitors
 * due for a check, the write caching a check's status onto the monitor row, and the two
 * monthly ping figures the usage cards show side by side — consumption already recorded
 * and consumption current intervals project — team-wide and per HTTP monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Schedule } from "@pkg/cron";
import { isFailure } from "@pkg/result";
import { generateUUID } from "@pkg/uuid";
import { and, eq, inList, notNull } from "remix/data-table";

import type { HttpP99Scope } from "~/app/services/analytics";
import type { InsertMonitor, MonitorStatus } from "~/database/schema";

import Subscription from "~/app/data/subscription";
import jobs from "~/app/jobs";
import { enqueue } from "~/app/lib/queue";
import { claimDue, nextDueAtOnEnable, nextDueAtPatch } from "~/app/lib/scheduling";
import { getHttpP99ResponseTime } from "~/app/services/analytics";
import {
	cronJobMonitors,
	dnsMonitors,
	monitorResults,
	monitors,
	tcpMonitors,
} from "~/database/schema";

/** The bucket size for a scheduled check's job id. */
const MS_PER_MINUTE = 60_000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Today plus yesterday, so the monthly ping counts hold whether or not the 01:00 UTC
 * aggregation job has run. Must stay well below the `clean` job's 7-day `monitor_results`
 * retention, which is what keeps those rows around to be counted.
 */
const RAW_PING_WINDOW_DAYS = 2;

/**
 * Safety cap on cron occurrences counted per job. Sub-minute schedules are rejected at
 * parse time, so the real ceiling is the 44,640 runs an every-minute schedule produces
 * in a 31-day month; anything reaching this cap is pathological and stops being counted.
 */
const MAX_CRON_OCCURRENCES_PER_MONTH = 45_000;

/** Aggregate uptime/response-time stats for a monitor (or a team's monitors). */
export interface MonitorStats {
	total: number;
	uptime: number | null;
	lastCheck: number | null;
	/**
	 * The 99th-percentile response time in milliseconds over the **last 24 hours**, from
	 * Analytics Engine rather than D1. `null` when the window holds no checks or the query
	 * failed, in which case callers show a placeholder.
	 */
	p99: number | null;
}

interface StatsRow {
	total: number;
	uptime: number | null;
	lastCheck: number | null;
}

export default class Monitor {
	/**
	 * Creates a monitor for a team, enabled immediately with `next_due_at` stamped at now,
	 * so the very next cron tick claims it and a new monitor reports a status straight
	 * away.
	 */
	static async create(db: Database, teamId: string, authorId: string, input: InsertMonitor) {
		return await db.create(
			monitors,
			{
				id: generateUUID(),
				team_id: teamId,
				author_id: authorId,
				enabled_at: Date.now(),
				next_due_at: nextDueAtOnEnable(true),
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

	/**
	 * Updates a monitor's editable fields. Scheduling lives entirely in `next_due_at` (see
	 * {@link findDue}), so a change to whether or how often a monitor is checked moves it
	 * in the same write and takes effect on the next tick.
	 */
	static async updateById(db: Database, monitorId: string, changes: Partial<InsertMonitor>) {
		let patch = await nextDueAtPatch(db, monitors, monitorId, {
			/** The scheduling helper takes a boolean; this table stores a nullable timestamp. */
			enabled: changes.enabled_at === undefined ? undefined : changes.enabled_at !== null,
			intervalSeconds: changes.interval_seconds,
		});

		return await db.update(monitors, monitorId, { ...changes, ...patch }, { touch: true });
	}

	/** Deletes a monitor. */
	static async deleteById(db: Database, monitorId: string) {
		return await db.delete(monitors, monitorId);
	}

	/**
	 * Enqueues an on-demand check for a monitor, settling billing here so a queued check is
	 * always one that's allowed to run. Reads the D1 projection and **fails open**: only a
	 * positively-known `inactive` state refuses.
	 *
	 * @returns Whether the check was enqueued, which is what lets the caller tell the
	 * visitor their check is going to happen.
	 */
	static async ping(db: Database, monitorId: string, ownerId: string): Promise<boolean> {
		if ((await Subscription.stateFor(db, ownerId)) === "inactive") return false;

		await enqueue(jobs.checkHttp, {
			id: `${monitorId}:manual:${generateUUID()}`,
			monitorId,
			scheduledAt: Date.now(),
		});
		return true;
	}

	/**
	 * The job id for a scheduled check, and the `monitor_results` primary key the consumer
	 * dedupes on. Keyed on the minute containing `scheduledAt`, so the several deliveries
	 * one minute's cron produces share one id; the 60s minimum interval makes that safe.
	 */
	static scheduledJobId(monitorId: string, scheduledAt: number): string {
		return `${monitorId}:${Math.floor(scheduledAt / MS_PER_MINUTE)}`;
	}

	/**
	 * Claims every monitor due as of `scheduledAt`, advancing each one's next due time in
	 * the same statement (see {@link claimDue}), so later deliveries of the same minute's
	 * cron find nothing due. `team_id` comes back to apportion the scheduler's own cost.
	 */
	static async findDue(db: Database, scheduledAt: number) {
		return await claimDue(db, monitors, ["id", "team_id"], scheduledAt);
	}

	/**
	 * Caches a completed check's outcome on the monitor row, the only write path for these
	 * columns and where the next check reads the status it transitions from and the list
	 * reads each badge. Runs once the result is committed, so the row records real checks.
	 */
	static async recordCheckStatus(
		db: Database,
		monitorId: string,
		status: MonitorStatus,
		responseTimeMs: number | null,
	) {
		return await db.update(
			monitors,
			monitorId,
			{ last_status: status, last_checked_at: Date.now(), last_response_time_ms: responseTimeMs },
			{ touch: true },
		);
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
		return await Monitor.getStats(db, "r.monitor_id = ?", [monitorId], { monitorId });
	}

	/** Computes total checks, uptime percentage, last-check time, and p99 response time across a team. */
	static async getStatsByTeamId(db: Database, teamId: string): Promise<MonitorStats> {
		return await Monitor.getStats(db, "m.team_id = ?", [teamId], { teamId });
	}

	/**
	 * One stats card from two stores: `total`, `uptime` and `lastCheck` are D1 aggregates
	 * costing one row read each, while `p99` is a single Analytics Engine query over a
	 * fixed 24-hour window. A failed p99 degrades to `null` and the card still renders.
	 */
	private static async getStats(
		db: Database,
		scopeClause: string,
		scopeParams: string[],
		p99Scope: HttpP99Scope,
	): Promise<MonitorStats> {
		let [statsResult, p99Result] = await Promise.all([
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
			getHttpP99ResponseTime(p99Scope),
		]);

		let [row] = (statsResult.rows ?? []) as unknown as StatsRow[];

		return {
			total: row?.total ?? 0,
			uptime: row?.uptime ?? null,
			lastCheck: row?.lastCheck ?? null,
			p99: isFailure(p99Result) ? null : p99Result.data,
		};
	}

	/**
	 * Counts a team's pings actually consumed in the calendar month containing `date`,
	 * over every monitor type: the daily rollup for the earlier part plus the raw result
	 * tables for the most recent {@link RAW_PING_WINDOW_DAYS}; each day counts once.
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
	 * Counts one HTTP monitor's pings actually consumed in the calendar month containing
	 * `date`, over the same two windows {@link countConsumedPingsByTeam} reads. This is the
	 * app's own count of recorded checks; billing settles from the metered ping events.
	 *
	 * @returns The count, and 0 for a month with no checks, since the card renders a real
	 * zero differently from an unavailable figure.
	 */
	static async countConsumedPingsByMonitor(
		db: Database,
		monitorId: string,
		date: Date,
	): Promise<number> {
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

		let result = await db.exec(
			`SELECT
			   (SELECT COALESCE(SUM(s.total_checks), 0) FROM monitor_daily_stats s
			     WHERE s.monitor_type = 'http' AND s.monitor_id = ? AND s.date BETWEEN ? AND ?)
			 + (SELECT COUNT(*) FROM monitor_results r
			     WHERE r.monitor_id = ? AND r.created_at BETWEEN ? AND ?) AS consumed`,
			[monitorId, rollupFrom, rollupTo, monitorId, rawStart, monthEnd],
		);

		let [row] = (result.rows ?? []) as unknown as Array<{ consumed: number }>;
		return row?.consumed ?? 0;
	}

	/**
	 * Projects a team's ping consumption over every monitor type for the calendar month
	 * containing `date`, from current intervals and cron schedules. Occurrences are walked
	 * one at a time so the walk stops at month end; an unusable schedule counts zero.
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

		let endTime = end.getTime();
		let cronPings = 0;
		for (let job of teamCronJobs) {
			let parsed = Schedule.parse(job.cron_expression);
			if (isFailure(parsed)) continue;

			let timeZone = job.timezone ?? "UTC";
			let cursor = start.getTime();
			let occurrences = 0;

			while (occurrences < MAX_CRON_OCCURRENCES_PER_MONTH) {
				let next = parsed.data.next({ from: new Date(cursor), timeZone }).getTime();
				if (Number.isNaN(next) || next > endTime) break;
				occurrences++;
				cursor = next;
			}

			cronPings += occurrences;
		}

		return Math.round(httpPings + dnsPings + tcpPings + cronPings);
	}

	/**
	 * Projects one HTTP monitor's ping consumption for the calendar month containing
	 * `date` from its current interval, the same figure
	 * {@link estimateConsumedPingsByTeam} sums across a team. Returns 0 for a missing id.
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
