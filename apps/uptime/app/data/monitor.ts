/**
 * Data-access model for HTTP monitors. Exposes CRUD over the `monitors` table scoped
 * to a team, enqueuing a subscription-gated on-demand check, the claim the `scheduled`
 * handler runs every minute to take the monitors that are due for a check,
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

import { isFailure } from "@pkg/result";
import { generateUUID } from "@pkg/uuid";
import { env } from "cloudflare:workers";
import { CronExpressionParser } from "cron-parser";
import { and, eq, inList, notNull } from "remix/data-table";

import type { HttpP99Scope } from "~/app/services/analytics";
import type { InsertMonitor } from "~/database/schema";

import Customer from "~/app/data/customer";
import { getHttpP99ResponseTime } from "~/app/services/analytics";
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
	/**
	 * The 99th-percentile response time in milliseconds over the **last 24 hours** — the
	 * one figure here that comes from Analytics Engine rather than D1. `null` when the
	 * window holds no checks, or when the Analytics Engine query failed, in which case
	 * callers show a placeholder instead of a number.
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
	 * Creates a monitor for a team, enabled immediately and scheduled for its first
	 * check on the next cron tick — `next_due_at` is stamped with now rather than with
	 * now plus the interval, so a new monitor reports a status straight away instead of
	 * after one silent interval.
	 */
	static async create(db: Database, teamId: string, authorId: string, input: InsertMonitor) {
		return await db.create(
			monitors,
			{
				id: generateUUID(),
				team_id: teamId,
				author_id: authorId,
				enabled_at: Date.now(),
				next_due_at: Date.now(),
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
	 * Updates a monitor's editable fields, keeping `next_due_at` consistent with them.
	 *
	 * Scheduling lives entirely in `next_due_at` (see {@link findDue}), so an update that
	 * changes whether or how often a monitor should be checked has to move it in the same
	 * write — otherwise a re-enabled monitor would never be picked up and a disabled one
	 * would keep being claimed.
	 */
	static async updateById(db: Database, monitorId: string, changes: Partial<InsertMonitor>) {
		let nextDueAt = await Monitor.nextDueAtForChanges(db, monitorId, changes);

		return await db.update(
			monitors,
			monitorId,
			nextDueAt === undefined ? changes : { ...changes, next_due_at: nextDueAt },
			{ touch: true },
		);
	}

	/**
	 * The `next_due_at` an update implies, or `undefined` when the update can't have
	 * changed the schedule and the column must be left where the scheduler put it.
	 *
	 * An `enabled_at` in the changes settles it without reading anything: disabling
	 * unschedules the monitor, enabling makes it due on the next tick. An interval change
	 * on its own is the only case that has to look at the stored row, for two reasons — a
	 * disabled monitor must stay unscheduled, and the web form resubmits
	 * `interval_seconds` on every edit, so re-anchoring the cadence unconditionally would
	 * restart it every time the monitor is renamed.
	 */
	private static async nextDueAtForChanges(
		db: Database,
		monitorId: string,
		changes: Partial<InsertMonitor>,
	): Promise<number | null | undefined> {
		if (changes.enabled_at !== undefined) return changes.enabled_at === null ? null : Date.now();
		if (changes.interval_seconds === undefined) return undefined;

		let monitor = await db.findOne(monitors, { where: { id: monitorId } });
		if (!monitor) return undefined;
		if (monitor.interval_seconds === changes.interval_seconds) return undefined;

		return monitor.enabled_at === null ? null : Date.now();
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
	 * different `scheduledTime` each time (observed ~7s apart in production), and a raw
	 * timestamp would hand the two deliveries different ids and let both run. One id per
	 * minute makes the second collide with the first instead. Safe because the minimum
	 * `interval_seconds` is 60, so no monitor can legitimately owe two checks inside the
	 * same minute.
	 *
	 * {@link findDue}'s claim is what normally stops the second delivery from enqueuing
	 * anything at all, so this collision should never fire. It stays as the correctness
	 * backstop for a delivery that raced the claim, and costs nothing when it doesn't.
	 */
	static scheduledJobId(monitorId: string, scheduledAt: number): string {
		return `${monitorId}:${Math.floor(scheduledAt / MS_PER_MINUTE)}`;
	}

	/**
	 * Claims every monitor due for a check as of `scheduledAt` and returns them, having
	 * already advanced each one's next due time. "Due" is `next_due_at IS NOT NULL AND
	 * next_due_at <= scheduledAt`, which is the whole predicate: `next_due_at` is NULL
	 * exactly when a monitor isn't scheduled, so it subsumes the `enabled_at IS NOT NULL`
	 * check and one index on `next_due_at` serves the query.
	 *
	 * This used to recompute each monitor's last completion from `monitor_results`
	 * (`MAX(completed_at) … GROUP BY monitor_id`), which no index can satisfy — SQLite had
	 * to read every row of a table holding 7 days of history, once per cron delivery, and
	 * that was 97% of the app's D1 rows read. It also compared against `completed_at`,
	 * stamped *after* the probe returns, so every check's due time slid forward by its own
	 * latency and a 1-minute monitor quietly became a 2-minute one.
	 *
	 * Claiming fixes both. The due time advances **from its own previous value**, by whole
	 * intervals until strictly past `scheduledAt`:
	 *
	 * ```text
	 * next = previous_next_due_at
	 * while next <= scheduledAt: next += interval_seconds * 1000
	 * ```
	 *
	 * which the UPDATE below writes in closed form as `previous + interval *
	 * (⌊(scheduledAt - previous) / interval⌋ + 1)` — SQLite's `/` is integer division and
	 * both operands are non-negative, so it floors. Advancing by whole intervals keeps the
	 * cadence anchored to the schedule instead of to completion times, and stopping at the
	 * first value past `scheduledAt` prevents a catch-up storm: a monitor left unscheduled
	 * for an hour gets one check, not sixty.
	 *
	 * Because the due time moves here rather than when the check completes, the second and
	 * later deliveries of the same minute's cron (this trigger fires more than once per
	 * minute — see {@link scheduledJobId}) find nothing due and enqueue nothing.
	 *
	 * One statement, not a read followed by a write. That distinction is the whole point:
	 * `RETURNING` reports the rows this `UPDATE` actually moved, so two deliveries racing
	 * in the same instant cannot both come away with the same monitor — the loser's
	 * `next_due_at <= ?` guard no longer matches and it claims nothing. A read-then-write
	 * pair would hand both deliveries the same rows and enqueue the work twice, which is
	 * exactly the duplicate this ADR exists to remove.
	 *
	 * The owner lookup is a second statement rather than a join, because `RETURNING` can
	 * only project columns of the updated table. It is an indexed point lookup per
	 * distinct team, and teams are far fewer than monitors.
	 *
	 * The `monitor_results` primary-key dedupe stays as the backstop for a delivery that
	 * races the claim in some way this does not cover — see {@link scheduledJobId}.
	 */
	static async findDue(db: Database, scheduledAt: number): Promise<DueMonitor[]> {
		let claimed = await db.exec(
			`UPDATE monitors
			    SET next_due_at = next_due_at
			          + (interval_seconds * 1000)
			          * (((? - next_due_at) / (interval_seconds * 1000)) + 1),
			        updated_at = ?
			  WHERE next_due_at IS NOT NULL
			    AND next_due_at <= ?
			RETURNING id AS monitorId, team_id AS teamId`,
			[scheduledAt, Date.now(), scheduledAt],
		);

		let rows = (claimed.rows ?? []) as unknown as { monitorId: string; teamId: string }[];
		if (rows.length === 0) return [];

		let teamIds = [...new Set(rows.map((row) => row.teamId))];
		let owners = await db.exec(
			`SELECT id, owner_id AS ownerId FROM teams WHERE id IN (${teamIds.map(() => "?").join(", ")})`,
			teamIds,
		);

		let ownerByTeam = new Map(
			((owners.rows ?? []) as unknown as { id: string; ownerId: string }[]).map((team) => [
				team.id,
				team.ownerId,
			]),
		);

		return rows.flatMap((row) => {
			let ownerId = ownerByTeam.get(row.teamId);
			// A claimed monitor whose team vanished between the two statements has nobody to
			// bill and nobody to notify, so it is dropped rather than enqueued. Its due time
			// has already advanced, which is correct — there is nothing to reschedule for.
			if (ownerId === undefined) return [];
			return [{ monitorId: row.monitorId, ownerId }];
		});
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
	 * One stats card, two stores:
	 *
	 * - `total`, `uptime` and `lastCheck` come from D1's `monitor_results`, because they
	 *   are aggregates over "every check ever recorded" and each one costs a single row
	 *   read: the query returns one row no matter how many it summarises.
	 * - `p99` comes from Analytics Engine over a stated 24-hour window. As a D1 query it
	 *   had to ship every stored response time to the Worker to index into the sorted
	 *   array — tens of thousands of rows read per call, growing linearly with the team's
	 *   monitor count, and a Worker memory ceiling at a few hundred monitors. Analytics
	 *   Engine answers it as one query, and the fixed window makes the number comparable
	 *   with itself instead of silently meaning "whatever `CleanJob` has not purged yet".
	 *
	 * The split means the p99 is the one figure here that depends on Analytics Engine, so
	 * a failed query degrades it to `null` (callers render "—") rather than failing the
	 * whole card.
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
