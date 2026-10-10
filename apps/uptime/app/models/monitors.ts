/**
 * HTTP monitors: the team-scoped rows, the claim the scheduler runs every minute over the ones
 * due, the cached status a check leaves on its row, the stats cards, and the monthly ping
 * figures (recorded and projected) the usage cards show, team-wide and per monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";
import type { Database } from "remix/data-table";

import { Schedule } from "@sdxc/cron";
import { createModel } from "@sdxc/data-model";
import { endOfMonth, startOfDay, startOfMonth, toDayKey } from "@sdxc/dates";
import { DAY_MS } from "@sdxc/dates/zone";
import { isFailure } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { and, eq, inList, notNull } from "remix/data-table";

import type { HttpP99Scope } from "~/app/services/analytics";
import type { MonitorStatus } from "~/database/schema";

import { claimDue, nextDueAtOnEnable, nextDueAtPatch } from "~/app/lib/scheduling";
import { getHttpP99ResponseTime } from "~/app/services/analytics";
import { cronJobMonitors, dnsMonitors, monitors, tcpMonitors } from "~/database/schema";

/** The bucket size for a scheduled check's job id. */
const MS_PER_MINUTE = 60_000;

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

/** The D1 half of {@link MonitorStats}, as the aggregate query returns it. */
interface StatsRow {
	total: number;
	uptime: number | null;
	lastCheck: number | null;
}

export const Monitors = createModel(monitors, {
	/** `id` comes from `beforeCreate`; the rest are columns the table declares a default for. */
	optional: [
		"id",
		"method",
		"expected_status",
		"interval_seconds",
		"degraded_after_ms",
		"timeout_seconds",
		"location_hint",
		"ssl_monitoring_enabled",
		"ssl_expiry_warning_days",
	],

	scopes: {
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),
		sslMonitored: (query) => query.where({ ssl_monitoring_enabled: true }),
	},

	methods: {
		/**
		 * Every monitor in `monitorIds` that belongs to `teamId`; an empty list reads nothing.
		 */
		async findManyInTeam(teamId: string, monitorIds: string[]) {
			if (monitorIds.length === 0) return [];
			return await this.inTeam(teamId).where(inList("id", monitorIds)).all();
		},

		/**
		 * Claims every monitor due as of `scheduledAt`, advancing each one's next due time in the
		 * same statement, so later deliveries of the same minute's cron find nothing due.
		 * `team_id` comes back to apportion the scheduler's own cost.
		 */
		async findDue(scheduledAt: number) {
			return await claimDue(this.db, monitors, ["id", "team_id"], scheduledAt);
		},

		/**
		 * Caches a completed check's outcome on the monitor row, the only write path for these
		 * columns and where the next check reads the status it transitions from and the list
		 * reads each badge. One statement, so a check costs no read of the row it updates.
		 */
		async recordCheckStatus(
			monitorId: string,
			status: MonitorStatus,
			responseTimeMs: number | null,
		) {
			return await this.query().where({ id: monitorId }).update({
				last_status: status,
				last_checked_at: Date.now(),
				last_response_time_ms: responseTimeMs,
			});
		},

		/** Total checks, uptime percentage, last-check time and p99 response time for one monitor. */
		async statsForMonitor(monitorId: string): Promise<MonitorStats> {
			return await stats(this.db, "r.monitor_id = ?", [monitorId], { monitorId });
		},

		/** Total checks, uptime percentage, last-check time and p99 response time across a team. */
		async statsForTeam(teamId: string): Promise<MonitorStats> {
			return await stats(this.db, "m.team_id = ?", [teamId], { teamId });
		},

		/**
		 * Counts a team's pings actually consumed in the calendar month containing `date`, over
		 * every monitor type: the daily rollup for the earlier part plus the raw result tables
		 * for the most recent {@link RAW_PING_WINDOW_DAYS}; each day counts once.
		 */
		async countConsumedPingsByTeam(teamId: string, date: Date): Promise<number> {
			let { rollupFrom, rollupTo, rawStart, monthEnd } = pingWindows(date);

			/** What each sub-count binds, in the order the query's placeholders read them. */
			let rollupScope = [teamId, rollupFrom, rollupTo];
			let rawScope = [teamId, rawStart, monthEnd];

			let result = await this.db.exec(
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
		},

		/**
		 * Counts one HTTP monitor's pings actually consumed in the calendar month containing
		 * `date`, over the same two windows the team count reads. This is the app's own count of
		 * recorded checks; billing settles from the metered ping events.
		 *
		 * @returns The count, and 0 for a month with no checks, since the card renders a real
		 * zero differently from an unavailable figure.
		 */
		async countConsumedPingsByMonitor(monitorId: string, date: Date): Promise<number> {
			let { rollupFrom, rollupTo, rawStart, monthEnd } = pingWindows(date);

			let result = await this.db.exec(
				`SELECT
				   (SELECT COALESCE(SUM(s.total_checks), 0) FROM monitor_daily_stats s
				     WHERE s.monitor_type = 'http' AND s.monitor_id = ? AND s.date BETWEEN ? AND ?)
				 + (SELECT COUNT(*) FROM monitor_results r
				     WHERE r.monitor_id = ? AND r.created_at BETWEEN ? AND ?) AS consumed`,
				[monitorId, rollupFrom, rollupTo, monitorId, rawStart, monthEnd],
			);

			let [row] = (result.rows ?? []) as unknown as Array<{ consumed: number }>;
			return row?.consumed ?? 0;
		},

		/**
		 * Projects a team's ping consumption over every monitor type for the calendar month
		 * containing `date`, from current intervals and cron schedules. Occurrences are walked
		 * one at a time so the walk stops at month end; an unusable schedule counts zero.
		 */
		async estimateConsumedPingsByTeam(teamId: string, date: Date): Promise<number> {
			let start = startOfMonth(date, "UTC");
			let end = endOfMonth(date, "UTC");
			let monthMs = end.getTime() - start.getTime();

			let [httpMonitors, teamDnsMonitors, teamTcpMonitors, teamCronJobs] = await Promise.all([
				this.inTeam(teamId).where(notNull("enabled_at")).all(),
				this.db.findMany(dnsMonitors, { where: { team_id: teamId, is_enabled: true } }),
				this.db.findMany(tcpMonitors, { where: { team_id: teamId, is_enabled: true } }),
				this.db.findMany(cronJobMonitors, {
					where: and(eq("team_id", teamId), notNull("enabled_at")),
				}),
			]);

			let httpPings = intervalPings(httpMonitors, monthMs);
			let dnsPings = intervalPings(teamDnsMonitors, monthMs);
			let tcpPings = intervalPings(teamTcpMonitors, monthMs);

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
		},

		/**
		 * Projects one HTTP monitor's ping consumption for the calendar month containing `date`
		 * from its current interval, the same figure the team projection sums. Returns 0 for a
		 * missing id.
		 */
		async estimateConsumedPingsByMonitor(monitorId: string, date: Date): Promise<number> {
			let monitor = await this.find(monitorId);
			if (!monitor) return 0;

			let start = startOfMonth(date, "UTC");
			let end = endOfMonth(date, "UTC");
			let monthMs = end.getTime() - start.getTime();

			return Math.round(monthMs / (monitor.interval_seconds * 1000));
		},
	},

	callbacks: {
		/**
		 * A new monitor is enabled immediately with `next_due_at` stamped at now, so the very
		 * next cron tick claims it and it reports a status straight away.
		 */
		async beforeCreate(values) {
			return {
				enabled_at: Date.now(),
				next_due_at: nextDueAtOnEnable(true),
				...values,
				id: values.id ?? generateUUID(),
			};
		},

		/**
		 * Scheduling lives entirely in `next_due_at`, so a change to whether or how often a
		 * monitor is checked moves it in the same write and takes effect on the next tick.
		 */
		async beforeUpdate(values, ctx, before) {
			let patch = await nextDueAtPatch(ctx.db, monitors, before.id, {
				enabled: values.enabled_at === undefined ? undefined : values.enabled_at !== null,
				intervalSeconds: values.interval_seconds,
			});
			return { ...values, ...patch };
		},
	},
});

/** An HTTP monitor, as reads return it. */
export type Monitor = ModelRow<typeof Monitors>;

export default Monitors;

/**
 * The job id for a scheduled check, and the `monitor_results` primary key the consumer
 * dedupes on. Keyed on the minute containing `scheduledAt`, so the several deliveries
 * one minute's cron produces share one id; the 60s minimum interval makes that safe.
 */
export function scheduledJobId(monitorId: string, scheduledAt: number): string {
	return `${monitorId}:${Math.floor(scheduledAt / MS_PER_MINUTE)}`;
}

/** The pings `monitors` run in `monthMs` at their current intervals, unrounded. */
function intervalPings(monitors: Array<{ interval_seconds: number }>, monthMs: number): number {
	return monitors.reduce((sum, monitor) => sum + monthMs / (monitor.interval_seconds * 1000), 0);
}

/**
 * The two halves a monthly ping count reads: the rollup's day keys and the raw window's
 * epoch-ms bounds. The rollup ends the day before the raw half begins; early in the month
 * that lands in the previous month, leaving `BETWEEN` an empty range, which is correct.
 */
function pingWindows(date: Date) {
	let monthStart = startOfMonth(date, "UTC").getTime();
	let monthEnd = endOfMonth(date, "UTC").getTime();

	let dayStart = startOfDay(date, "UTC").getTime();
	let rawStart = Math.max(monthStart, dayStart - (RAW_PING_WINDOW_DAYS - 1) * DAY_MS);

	return {
		rollupFrom: toDayKey(new Date(monthStart), "UTC"),
		rollupTo: toDayKey(new Date(rawStart - DAY_MS), "UTC"),
		rawStart,
		monthEnd,
	};
}

/**
 * One stats card from two stores: `total`, `uptime` and `lastCheck` are D1 aggregates
 * costing one row read each, while `p99` is a single Analytics Engine query over a
 * fixed 24-hour window. A failed p99 degrades to `null` and the card still renders.
 */
async function stats(
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
