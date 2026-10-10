/**
 * The long-term daily rollup behind the uptime bars and the reports, one row per monitor per
 * UTC day for every monitor type. {@link MonitorDailyStats.upsertDay} replaces a day's row, so
 * the aggregation job can re-run a day and still leave exactly one row for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { startOfDay, subDays, toDayKey } from "@sdxc/dates";
import { DAY_MS } from "@sdxc/dates/zone";
import { generateUUID } from "@sdxc/uuid/v4";
import { gte } from "remix/data-table";

import { monitorDailyStats } from "~/database/schema";

/** The monitor types that participate in daily aggregation (matches `monitor_daily_stats.monitor_type`). */
export type DailyStatsMonitorType = "http" | "dns" | "tcp" | "cron" | "flow";

/**
 * How many trailing days of history the app reads and renders. Matches the number of
 * bars `resources/views/shared/uptime-bar.tsx` draws, so every day the query loads has
 * a bar to render it.
 */
export const UPTIME_WINDOW_DAYS = 90;

/** One monitor's rolled-up day, as the aggregation job computes it. */
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

export const MonitorDailyStats = createModel(monitorDailyStats, {
	optional: ["id"],

	scopes: {
		ofMonitor: (query, monitorId: string, monitorType: DailyStatsMonitorType) =>
			query.where({ monitor_id: monitorId, monitor_type: monitorType }),
	},

	methods: {
		/**
		 * Replaces the day's row for a monitor, clearing its `(monitor_id, monitor_type, date)`
		 * key before inserting, so a re-run leaves exactly one row per day.
		 */
		async upsertDay(input: DailyStatsInput) {
			await this.ofMonitor(input.monitor_id, input.monitor_type)
				.where({ date: input.date })
				.delete();
			return await this.create(input);
		},

		/**
		 * A monitor's days within the last `days` (today inclusive), oldest first, so the bars
		 * read left to right. The cutoff sits in the `WHERE` clause so the
		 * `(monitor_id, monitor_type, date)` index bounds the scan regardless of age.
		 */
		async listRecentDays(
			monitorId: string,
			monitorType: DailyStatsMonitorType,
			days: number = UPTIME_WINDOW_DAYS,
		) {
			return await this.ofMonitor(monitorId, monitorType)
				.where(gte("date", windowStartDate(days)))
				.orderBy("date", "asc")
				.all();
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? generateUUID(),
				p95_response_time_ms: values.p95_response_time_ms ?? null,
			};
		},
	},
});

/** One monitor's rolled-up day, as reads return it. */
export type MonitorDailyStat = ModelRow<typeof MonitorDailyStats>;

export default MonitorDailyStats;

/** The oldest `"YYYY-MM-DD"` date a `days`-long window ending today (inclusive) covers. */
function windowStartDate(days: number): string {
	return toDayKey(subDays(startOfDay(new Date(), "UTC"), days - 1), "UTC");
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

/** Yesterday's date in UTC, as `"YYYY-MM-DD"` — the day the aggregation job rolls up. */
export function getYesterdayDateUtc(now: number = Date.now()): string {
	return toDayKey(subDays(new Date(now), 1), "UTC");
}

/** The `[start, end)` epoch-ms bounds of a UTC calendar day, for D1 `WHERE` clauses. */
export function utcDayBounds(date: string): { start: number; end: number } {
	let start = new Date(`${date}T00:00:00.000Z`).getTime();
	return { start, end: start + DAY_MS };
}
