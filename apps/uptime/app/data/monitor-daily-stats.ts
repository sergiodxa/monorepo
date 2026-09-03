/**
 * Data-access model for `monitor_daily_stats`, the long-term rollup table behind the
 * uptime bars and historical reporting. `AggregateDailyStatsJob` writes one row per
 * monitor per day, and uniqueness of `(monitor_id, monitor_type, date)` is enforced by
 * {@link upsertDay}, which clears that key before inserting so a re-run stays
 * idempotent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@sdxc/uuid";
import { and, eq, gte } from "remix/data-table";

import { monitorDailyStats } from "~/database/schema";

/** The monitor types that participate in daily aggregation (matches `monitor_daily_stats.monitor_type`). */
export type DailyStatsMonitorType = "http" | "dns" | "tcp" | "cron" | "flow";

/**
 * How many trailing days of history the app reads and renders. Matches the number of
 * bars `resources/views/shared/uptime-bar.tsx` draws, so every day the query loads has
 * a bar to render it.
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
	/** Replaces the day's row for a monitor, so a re-run leaves exactly one row per day. */
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
	 * Lists a monitor's daily stats for the last {@link UPTIME_WINDOW_DAYS} days
	 * (today inclusive), oldest first. The cutoff sits in the `WHERE` clause so
	 * the `(monitor_id, monitor_type, date)` index bounds the scan regardless of age.
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
