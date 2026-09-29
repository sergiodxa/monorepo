/**
 * The reads behind the uptime reports: which of a team's monitors a filter selects, one
 * summary per monitor over a range, and the range's daily rows. Everything comes from the
 * daily roll-up, reached through the monitor tables, plus the maintenance windows covering each.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { occurrences } from "@sdxc/icalendar/rrule";
import { isSuccess } from "@sdxc/result";
import { getTableName } from "remix/data-table";

import type { DailyStatsMonitorType } from "~/app/data/monitor-daily-stats";
import type { MonitorScope } from "~/app/lib/monitor-scope";
import type { MonitorStatus, SelectMaintenanceWindow } from "~/database/schema";

import { recurringEvent } from "~/app/data/maintenance-window";
import { utcDayBounds } from "~/app/data/monitor-daily-stats";
import { chunk } from "~/app/lib/concurrency";
import { monitorScopeMatches, storedMonitorScope } from "~/app/lib/monitor-scope";
import { uptimeRatio } from "~/app/lib/uptime-report";
import {
	cronJobMonitors,
	dnsMonitors,
	flowMonitors,
	maintenanceWindows,
	monitorDailyStats,
	monitors,
	statusPageCronJobs,
	statusPageDnsMonitors,
	statusPageFlowMonitors,
	statusPageMonitors,
	statusPages,
	statusPageTcpMonitors,
	tcpMonitors,
} from "~/database/schema";

namespace Report {
	/** Which monitors and days a report covers; the caller has already validated it. */
	export interface Filter {
		/** First UTC day, as `YYYY-MM-DD`, inclusive. */
		from: string;
		/** Last UTC day, as `YYYY-MM-DD`, inclusive. */
		to: string;
		/** Only the monitors attached to this status page, which must be the team's own. */
		statusPageId?: string;
		/** Only monitors of this type. */
		monitorType?: DailyStatsMonitorType;
	}

	/** One of the team's monitors, with what a reader recognises it by. */
	export interface Monitor {
		id: string;
		type: DailyStatsMonitorType;
		name: string;
		/**
		 * The URL, hostname, `host:port` or cron expression it watches; `null` for a flow,
		 * whose only description is a spec source that may hold credentials.
		 */
		target: string | null;
	}

	/** One monitor's whole range. */
	export interface SummaryRow {
		/** Keeps two monitors sharing a name apart, and keys any paging over the rows. */
		monitorId: string;
		/** The monitor's name. */
		monitor: string;
		type: DailyStatsMonitorType;
		target: string | null;
		/** Days in the range with a roll-up row; a day without one is not assumed up. */
		daysWithData: number;
		totalChecks: number;
		successfulChecks: number;
		failedChecks: number;
		/** Check-weighted and unrounded, from 0 to 100; `null` when nothing was checked. */
		uptimePercent: number | null;
		/** The daily averages weighted by each day's checks; `null` for cron jobs. */
		avgResponseTimeMs: number | null;
		/** The largest daily maximum. */
		maxResponseTimeMs: number | null;
		/** Days the roll-up classified as `down`. */
		daysDown: number;
		/** Days the roll-up classified as `degraded`. */
		daysDegraded: number;
		/** Whole minutes of maintenance covering the monitor in the range, overlaps merged. */
		maintenanceMinutes: number;
	}

	/** One monitor's roll-up row for one UTC day. */
	export interface DailyRow {
		/** The UTC day, as `YYYY-MM-DD`. */
		date: string;
		/** Keeps two monitors sharing a name apart, and keys any paging over the rows. */
		monitorId: string;
		/** The monitor's name. */
		monitor: string;
		type: DailyStatsMonitorType;
		totalChecks: number;
		successfulChecks: number;
		failedChecks: number;
		/** Unrounded, from 0 to 100; `null` when the day ran no checks. */
		uptimePercent: number | null;
		/** `null` for cron jobs. */
		avgResponseTimeMs: number | null;
		maxResponseTimeMs: number | null;
		/** What the roll-up classified the day as. */
		status: MonitorStatus;
		/** Whole minutes of maintenance covering the monitor that day, overlaps merged. */
		maintenanceMinutes: number;
	}
}

/**
 * D1's ceiling on bound parameters per statement. A summary query binds the range's two
 * days beside its monitor ids, so each chunk of ids stays two below it.
 */
const D1_BOUND_PARAMETER_LIMIT = 100;

const MONITORS_PER_QUERY = D1_BOUND_PARAMETER_LIMIT - 2;

const MINUTE_MS = 60_000;

const DAY_MS = 86_400_000;

/**
 * Every monitor of every type as one relation of `(id, type, type_order, name, team_id,
 * target)`, disabled ones included, since a report lists what the team has. `type_order`
 * sorts types the way the product lists them; an IPv6 host is bracketed before its port.
 */
const REPORT_MONITORS = `
	          SELECT id, 'http' AS type, 0 AS type_order, name, team_id, url AS target FROM ${getTableName(monitors)}
	UNION ALL SELECT id, 'dns', 1, name, team_id, domain FROM ${getTableName(dnsMonitors)}
	UNION ALL SELECT id, 'tcp', 2, name, team_id,
	                 CASE WHEN instr(host, ':') > 0 THEN '[' || host || ']' ELSE host END || ':' || port
	            FROM ${getTableName(tcpMonitors)}
	UNION ALL SELECT id, 'cron', 3, name, team_id, cron_expression FROM ${getTableName(cronJobMonitors)}
	UNION ALL SELECT id, 'flow', 4, name, team_id, NULL FROM ${getTableName(flowMonitors)}
`;

/** Every status-page link table as one relation of `(status_page_id, type, id)`. */
const STATUS_PAGE_LINKS = `
	          SELECT status_page_id, 'http' AS type, monitor_id AS id FROM ${getTableName(statusPageMonitors)}
	UNION ALL SELECT status_page_id, 'dns', dns_monitor_id FROM ${getTableName(statusPageDnsMonitors)}
	UNION ALL SELECT status_page_id, 'tcp', tcp_monitor_id FROM ${getTableName(statusPageTcpMonitors)}
	UNION ALL SELECT status_page_id, 'cron', cron_job_monitor_id FROM ${getTableName(statusPageCronJobs)}
	UNION ALL SELECT status_page_id, 'flow', flow_monitor_id FROM ${getTableName(statusPageFlowMonitors)}
`;

/** One monitor's aggregate over the range, as the grouped summary query returns it. */
interface AggregateRow {
	id: string;
	type: DailyStatsMonitorType;
	daysWithData: number;
	totalChecks: number;
	successfulChecks: number;
	failedChecks: number;
	/** Each day's average times its checks, summed over the days that recorded one. */
	weightedResponseTimeMs: number | null;
	/** The checks of the days that recorded an average, which divides the sum above. */
	timedChecks: number;
	maxResponseTimeMs: number | null;
	daysDown: number;
	daysDegraded: number;
}

/** One roll-up row, as the per-monitor daily query returns it. */
interface DayRow {
	date: string;
	totalChecks: number;
	successfulChecks: number;
	failedChecks: number;
	avgResponseTimeMs: number | null;
	maxResponseTimeMs: number | null;
	status: MonitorStatus;
}

/** A half-open `[start, end)` stretch of epoch milliseconds. */
interface Span {
	start: number;
	end: number;
}

/** One maintenance window of the team: who it covers, and when it did inside the range. */
interface ScopedWindow {
	scope: MonitorScope;
	spans: Span[];
}

class Report {
	/**
	 * The team's monitors matching the filter, ordered by type and then name. A status page
	 * of another team selects nothing, and a link matches on type as well as id, since the
	 * monitor tables generate their ids independently.
	 *
	 * @param db - Database handle.
	 * @param teamId - Team the report is for.
	 * @param filter - The range, status page and type; only the latter two apply here.
	 * @returns One entry per monitor, in the order every report lists them.
	 */
	static async listMonitors(
		db: Database,
		teamId: string,
		filter: Report.Filter,
	): Promise<Report.Monitor[]> {
		let conditions = ["mon.team_id = ?"];
		let params: string[] = [teamId];

		if (filter.monitorType) {
			conditions.push("mon.type = ?");
			params.push(filter.monitorType);
		}

		if (filter.statusPageId) {
			conditions.push(`EXISTS (
				SELECT 1 FROM (${STATUS_PAGE_LINKS}) link
				  JOIN ${getTableName(statusPages)} page ON page.id = link.status_page_id
				 WHERE link.status_page_id = ? AND page.team_id = mon.team_id
				   AND link.type = mon.type AND link.id = mon.id)`);
			params.push(filter.statusPageId);
		}

		let result = await db.exec(
			`SELECT mon.id AS id, mon.type AS type, mon.name AS name, mon.target AS target
			   FROM (${REPORT_MONITORS}) mon
			  WHERE ${conditions.join(" AND ")}
			  ORDER BY mon.type_order ASC, mon.name ASC, mon.id ASC`,
			params,
		);

		return (result.rows ?? []) as unknown as Report.Monitor[];
	}

	/**
	 * One aggregate per monitor over the range, in {@link listMonitors}'s order. A monitor
	 * with no roll-up rows still gets a row, with zero days and nothing measured. Sums run
	 * in SQL, one grouped query per chunk of monitors small enough for D1 to bind.
	 *
	 * @param db - Database handle.
	 * @param teamId - Team the report is for.
	 * @param filter - Range and monitor selection.
	 * @returns One row per selected monitor.
	 */
	static async summaryRows(
		db: Database,
		teamId: string,
		filter: Report.Filter,
	): Promise<Report.SummaryRow[]> {
		let range = rangeBounds(filter);
		let [selected, windows] = await Promise.all([
			Report.listMonitors(db, teamId, filter),
			teamWindows(db, teamId, range),
		]);

		let ids = [...new Set(selected.map((monitor) => monitor.id))];
		let aggregates = await Promise.all(
			chunk(ids, MONITORS_PER_QUERY).map((batch) => aggregateBatch(db, batch, filter)),
		);
		let byMonitor = new Map<string, AggregateRow>();
		for (let row of aggregates.flat()) byMonitor.set(`${row.type}:${row.id}`, row);

		return selected.map((monitor) => {
			let row = byMonitor.get(`${monitor.type}:${monitor.id}`);
			let totalChecks = row?.totalChecks ?? 0;
			let successfulChecks = row?.successfulChecks ?? 0;
			let ratio = uptimeRatio(successfulChecks, totalChecks);

			return {
				monitorId: monitor.id,
				monitor: monitor.name,
				type: monitor.type,
				target: monitor.target,
				daysWithData: row?.daysWithData ?? 0,
				totalChecks,
				successfulChecks,
				failedChecks: row?.failedChecks ?? 0,
				uptimePercent: ratio === null ? null : ratio * 100,
				avgResponseTimeMs: averageResponseTime(monitor, row),
				maxResponseTimeMs: row?.maxResponseTimeMs ?? null,
				daysDown: row?.daysDown ?? 0,
				daysDegraded: row?.daysDegraded ?? 0,
				maintenanceMinutes: minutesWithin(maintenanceFor(windows, monitor), range),
			};
		});
	}

	/**
	 * The range's roll-up rows, one monitor at a time in {@link listMonitors}'s order and
	 * each monitor's days oldest first, so memory holds one monitor's range. Only days with a
	 * roll-up row yield one. Each read seeks the `(monitor_id, monitor_type, date)` index.
	 *
	 * @param db - Database handle.
	 * @param teamId - Team the report is for.
	 * @param filter - Range and monitor selection.
	 * @yields One row per monitor per day that has a roll-up row.
	 */
	static async *dailyRows(
		db: Database,
		teamId: string,
		filter: Report.Filter,
	): AsyncGenerator<Report.DailyRow> {
		let range = rangeBounds(filter);
		let [selected, windows] = await Promise.all([
			Report.listMonitors(db, teamId, filter),
			teamWindows(db, teamId, range),
		]);

		for (let monitor of selected) {
			let maintenance = maintenanceFor(windows, monitor);
			let result = await db.exec(
				`SELECT date, total_checks AS totalChecks, successful_checks AS successfulChecks,
				        failed_checks AS failedChecks, avg_response_time_ms AS avgResponseTimeMs,
				        max_response_time_ms AS maxResponseTimeMs, status
				   FROM ${getTableName(monitorDailyStats)}
				  WHERE monitor_id = ? AND monitor_type = ? AND date >= ? AND date <= ?
				  ORDER BY date ASC`,
				[monitor.id, monitor.type, filter.from, filter.to],
			);

			for (let day of (result.rows ?? []) as unknown as DayRow[]) {
				let ratio = uptimeRatio(day.successfulChecks, day.totalChecks);
				let bounds = utcDayBounds(day.date);

				yield {
					date: day.date,
					monitorId: monitor.id,
					monitor: monitor.name,
					type: monitor.type,
					totalChecks: day.totalChecks,
					successfulChecks: day.successfulChecks,
					failedChecks: day.failedChecks,
					uptimePercent: ratio === null ? null : ratio * 100,
					avgResponseTimeMs: monitor.type === "cron" ? null : day.avgResponseTimeMs,
					maxResponseTimeMs: day.maxResponseTimeMs,
					status: day.status,
					maintenanceMinutes: minutesWithin(maintenance, bounds),
				};
			}
		}
	}
}

export default Report;

/**
 * One grouped read of the range's roll-up rows for a batch of ids. Rows are grouped by the
 * `(id, type)` pair and matched back on it, so each is attributed only to the monitor whose
 * pair it carries, even when another table's monitor shares the id.
 */
async function aggregateBatch(
	db: Database,
	ids: string[],
	filter: Report.Filter,
): Promise<AggregateRow[]> {
	let result = await db.exec(
		`SELECT monitor_id AS id, monitor_type AS type, COUNT(*) AS daysWithData,
		        SUM(total_checks) AS totalChecks, SUM(successful_checks) AS successfulChecks,
		        SUM(failed_checks) AS failedChecks,
		        SUM(avg_response_time_ms * total_checks) AS weightedResponseTimeMs,
		        SUM(CASE WHEN avg_response_time_ms IS NULL THEN 0 ELSE total_checks END) AS timedChecks,
		        MAX(max_response_time_ms) AS maxResponseTimeMs,
		        SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) AS daysDown,
		        SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) AS daysDegraded
		   FROM ${getTableName(monitorDailyStats)}
		  WHERE monitor_id IN (${ids.map(() => "?").join(", ")}) AND date >= ? AND date <= ?
		  GROUP BY monitor_id, monitor_type`,
		[...ids, filter.from, filter.to],
	);

	return (result.rows ?? []) as unknown as AggregateRow[];
}

/**
 * The range's average response time, weighting each day's average by its checks. Cron jobs
 * record no response time, and a range whose days carry no average reports `null`.
 */
function averageResponseTime(
	monitor: Report.Monitor,
	row: AggregateRow | undefined,
): number | null {
	if (monitor.type === "cron" || !row || row.timedChecks === 0) return null;
	return (row.weightedResponseTimeMs ?? 0) / row.timedChecks;
}

/** The filter's days as one span, from the first day's midnight to the midnight after the last. */
function rangeBounds(filter: Report.Filter): Span {
	return { start: utcDayBounds(filter.from).start, end: utcDayBounds(filter.to).end };
}

/**
 * The team's maintenance windows with the stretches each covered inside `range`, read once
 * per report. A window's one-off range ends at `ended_early_at` when set, and a recurring
 * window adds its pattern's occurrences, read off the same RRULE that suppresses alerts.
 */
async function teamWindows(db: Database, teamId: string, range: Span): Promise<ScopedWindow[]> {
	let rows = await db.findMany(maintenanceWindows, { where: { team_id: teamId } });

	return rows
		.map((window) => ({ scope: storedMonitorScope(window), spans: windowSpans(window, range) }))
		.filter((window) => window.spans.length > 0);
}

/**
 * The stretches of `range` one window covered. A pattern starts at most once a day, so the
 * occurrence limit is the range's day count plus the occurrence already running at its start;
 * a pattern that fails to expand leaves its one-off range, matching the alerts it suppresses.
 */
function windowSpans(window: SelectMaintenanceWindow, range: Span): Span[] {
	let spans = [
		clip({ start: window.starts_at, end: window.ended_early_at ?? window.ends_at }, range),
	];

	let event = recurringEvent(window);
	if (event) {
		let limit = Math.ceil((range.end - range.start) / DAY_MS) + 1;
		let found = occurrences(event, { from: range.start, to: range.end, limit });
		if (isSuccess(found)) spans.push(...found.data.map((occurrence) => clip(occurrence, range)));
	}

	return spans.filter((span) => span.end > span.start);
}

/** The merged stretches of the windows whose scope covers `monitor`, earliest first. */
function maintenanceFor(windows: ScopedWindow[], monitor: Report.Monitor): Span[] {
	let spans = windows
		.filter((window) => monitorScopeMatches(window.scope, monitor.type, monitor.id))
		.flatMap((window) => window.spans)
		.sort((a, b) => a.start - b.start);

	let merged: Span[] = [];
	for (let span of spans) {
		let last = merged.at(-1);
		if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
		else merged.push({ ...span });
	}
	return merged;
}

/**
 * The whole minutes of `spans` falling inside `bounds`. Rounding happens once per figure, so
 * a window ended part-way through a minute counts to the nearest one; `spans` must be merged.
 */
function minutesWithin(spans: Span[], bounds: Span): number {
	let total = 0;
	for (let span of spans) {
		let inside = clip(span, bounds);
		if (inside.end > inside.start) total += inside.end - inside.start;
	}
	return Math.round(total / MINUTE_MS);
}

/** `span` cut to `bounds`; the result is empty (`end <= start`) when the two are disjoint. */
function clip(span: Span, bounds: Span): Span {
	return { start: Math.max(span.start, bounds.start), end: Math.min(span.end, bounds.end) };
}
