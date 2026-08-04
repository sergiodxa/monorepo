/**
 * Turns a finished free watch's checks into the daily rows a real monitor's history is made
 * of, so a target that has been watched for a week arrives on a paid account with that week
 * already on it instead of an empty graph.
 *
 * **Why daily rows and not the results themselves.** A paid monitor's individual results live
 * in Analytics Engine, and a data point there is stamped at ingestion — there is no way to
 * write one into last Tuesday. Replaying 168 checks would therefore pile a week of history
 * into the minute the person signed in, which is worse than having none: the uptime figure
 * would be right and every timestamp under it would be a lie. `monitor_daily_stats` is keyed
 * on a date column instead, so it is the one place a past day can honestly be written, and it
 * is what the 365-day heatmap and the year view read. The trade is that the carried history
 * has day resolution rather than hour resolution, which is the correct thing to lose.
 *
 * The rollup deliberately matches `AggregateDailyStatsJob`'s definitions rather than
 * inventing its own — "successful" means a check that reported `up`, so a degraded check
 * counts against the day exactly as it does for a paying monitor. A carried day and a day
 * the sweep produced have to be the same kind of fact, or the heatmap shows a seam where the
 * trial ended.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toDayKey } from "@pkg/dates";

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
 *
 * Days with no checks produce no row, which is what the heatmap already expects from a
 * monitor that was not running: a gap reads as "not watched", and writing a zero-check row
 * would draw it as a day that was watched and failed.
 *
 * `avg_response_time_ms` averages only the checks that reported a time, so a day whose
 * failures returned nothing is not averaged toward zero. A day where *nothing* answered has
 * no average and no maximum rather than zeroes, matching what `watchStats` reports for the
 * same reason.
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
