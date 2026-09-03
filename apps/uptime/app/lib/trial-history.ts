/**
 * Turns a finished free watch's checks into the daily rows a real monitor's
 * history is made of, carrying day-resolution rows into `monitor_daily_stats`
 * to match `AggregateDailyStatsJob`'s pass/fail rollup, since Analytics
 * Engine stamps each result at ingestion and cannot backdate one to when the
 * trial actually ran it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toDayKey } from "@sdxc/dates";

import type { DailyStatsInput } from "~/app/data/monitor-daily-stats";
import type { MonitorStatus } from "~/database/schema";

import { calculateDailyStatus } from "~/app/data/monitor-daily-stats";

/**
 * The zone days are counted in, matching `utcDayBounds` and the aggregation job. A day
 * boundary has to be the same boundary for a carried day and a swept one, and a zone guessed
 * from the reader's locale would put the two on different clocks.
 */
const DAY_ZONE = "UTC";

/** One completed check, as the three facts a daily rollup needs. */
export interface HistoricCheck {
	status: MonitorStatus;
	response_time_ms: number | null;
	checked_at: number;
}

/**
 * Rolls checks up into one {@link DailyStatsInput} per UTC day they cover.
 * A day with no checks produces no row, rendering as an unwatched gap in
 * the uptime bar; average and max response time stay `null` when none reported one.
 *
 * @param checks - Completed checks, in any order.
 * @param monitorId - The monitor the rows belong to.
 * @returns One row per covered day, oldest first.
 * @example dailyStatsFromChecks(results, monitor.id)
 */
export function dailyStatsFromChecks(
	checks: HistoricCheck[],
	monitorId: string,
): DailyStatsInput[] {
	let days = new Map<string, HistoricCheck[]>();

	for (let check of checks) {
		let key = toDayKey(new Date(check.checked_at), DAY_ZONE);
		let bucket = days.get(key);

		if (bucket) bucket.push(check);
		else days.set(key, [check]);
	}

	return [...days.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, dayChecks]) => {
			let total = dayChecks.length;
			let successful = dayChecks.filter((check) => check.status === "up").length;
			let times = dayChecks
				.map((check) => check.response_time_ms)
				.filter((time): time is number => time !== null);

			return {
				monitor_id: monitorId,
				monitor_type: "http",
				date,
				total_checks: total,
				successful_checks: successful,
				failed_checks: total - successful,
				avg_response_time_ms:
					times.length === 0
						? null
						: Math.round(times.reduce((sum, time) => sum + time, 0) / times.length),
				max_response_time_ms: times.length === 0 ? null : Math.max(...times),
				status: calculateDailyStatus(successful, total),
			};
		});
}
