/**
 * Data-access model for `monitor_daily_stats`, the long-term rollup table behind the
 * uptime bars and historical reporting. `AggregateDailyStatsJob` writes one row
 * per monitor per day; the table has no unique constraint on `(monitor_id,
 * monitor_type, date)`, so {@link upsertDay} deletes any existing row for that key
 * before inserting, keeping a re-run idempotent instead of duplicating rows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";
import { and, eq, gte } from "remix/data-table";

import { monitorDailyStats } from "~/database/schema";

/** The monitor types that participate in daily aggregation (matches `monitor_daily_stats.monitor_type`). */
export type DailyStatsMonitorType = "http" | "dns" | "tcp" | "cron";

/**
 * How many trailing days of history the app reads and renders. Matches the number of
 * bars `resources/views/shared/uptime-bar.tsx` draws, so the query never loads a day the
 * UI can't show.
 */
export const UPTIME_WINDOW_DAYS = 90;

/** The oldest `"YYYY-MM-DD"` date a `days`-long window ending today (inclusive) covers. */
function windowStartDate(days: number): string {
	let today = new Date();
	let end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
	return new Date(end - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export interface DailyStatsInput {
	monitor_id: string;
	monitor_type: DailyStatsMonitorType;
	date: string;
	total_checks: number;
	successful_checks: number;
	failed_checks: number;
	avg_response_time_ms: number | null;
	max_response_time_ms: number | null;
	status: "up" | "degraded" | "down";
}

export default class MonitorDailyStats {
	/** Replaces the day's row for a monitor, so re-running the job never duplicates rows. */
	static async upsertDay(db: Database, input: DailyStatsInput) {
		let existing = await db.findMany(monitorDailyStats, {
			where: and(
				eq("monitor_id", input.monitor_id),
				eq("monitor_type", input.monitor_type),
				eq("date", input.date),
			),
		});
		for (let row of existing) await db.delete(monitorDailyStats, row.id);

		return await db.create(
			monitorDailyStats,
			{ id: generateUUID(), p95_response_time_ms: null, ...input },
			{ touch: true, returnRow: true },
		);
	}

	/**
	 * Lists a monitor's daily stats for the last {@link UPTIME_WINDOW_DAYS} days (today
	 * inclusive), oldest first — the window every uptime bar in the app renders.
	 *
	 * The cutoff goes into the `WHERE` clause rather than filtering the result set in
	 * JS, so the `(monitor_id, monitor_type, date)` index bounds the scan and the query
	 * returns ~90 rows no matter how long the monitor has existed.
	 */
	static async listRecentDays(
		db: Database,
		monitorId: string,
		monitorType: DailyStatsMonitorType,
		days: number = UPTIME_WINDOW_DAYS,
	) {
		return await db.findMany(monitorDailyStats, {
			where: and(
				eq("monitor_id", monitorId),
				eq("monitor_type", monitorType),
				gte("date", windowStartDate(days)),
			),
			orderBy: ["date", "asc"],
		});
	}
}

/** Classifies a day's overall status from its success rate: all-up, majority-up, or mostly-down/no-data. */
export function calculateDailyStatus(
	successfulChecks: number,
	totalChecks: number,
): "up" | "degraded" | "down" {
	if (totalChecks === 0) return "down";
	let successRate = successfulChecks / totalChecks;
	if (successRate >= 1) return "up";
	if (successRate >= 0.5) return "degraded";
	return "down";
}

/** Yesterday's date in UTC, as `"YYYY-MM-DD"` — the day `AggregateDailyStatsJob` rolls up. */
export function getYesterdayDateUtc(now: number = Date.now()): string {
	let yesterday = new Date(now - 24 * 60 * 60 * 1000);
	return yesterday.toISOString().slice(0, 10);
}

/** The `[start, end)` epoch-ms bounds of a UTC calendar day, for D1 `WHERE` clauses. */
export function utcDayBounds(date: string): { start: number; end: number } {
	let start = new Date(`${date}T00:00:00.000Z`).getTime();
	return { start, end: start + 24 * 60 * 60 * 1000 };
}
