/**
 * The arithmetic the free-watch reports share: turning a target's checks into the segments of
 * an uptime bar, and reading a watch's running totals off as the three numbers under it.
 *
 * Shared because the same bar is drawn at three scales by three different senders — one
 * segment per hour over a day for the daily digest, one per day over a week for the wrap-up,
 * and the same week again when a repeat submission is answered with a report instead of a
 * second free week — and the only thing that differs between them is the period. Keeping the
 * bucketing in one place is what stops a bar in one email disagreeing with the same data in
 * another.
 *
 * The two rules every uptime report shares, whoever reads it, live in
 * `~/app/lib/uptime-report` instead: which status wins when several checks fall in one
 * period, and how a ratio is printed.
 *
 * Deliberately not in `~/app/emails/`: nothing here renders, and its callers are assembling
 * data before an email class ever exists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TrialStats } from "~/app/emails/shared/trial";
import type { UptimeBar } from "~/app/emails/shared/uptime-bar";
import type { MonitorStatus, SelectTrialWatch } from "~/database/schema";

import { formatUptime, worstStatus } from "~/app/lib/uptime-report";

/** One completed check, as the two facts a bar segment is built from. */
export interface Segmentable {
	status: MonitorStatus;
	checked_at: number;
}

/**
 * Collapses checks into one segment per period: the worst status any check in that period
 * reported, and `null` for a period no check covers.
 *
 * A check outside the range is dropped rather than clamped into the nearest period — a stray
 * row is better missing from the bar than drawn in an hour it did not happen in.
 *
 * @param results - Checks to place, in any order.
 * @param start - Instant the first period begins at.
 * @param periodMs - Length of one period.
 * @param periods - How many periods the bar draws.
 * @returns One status per period, oldest first.
 * @example segmentsOver(results, dayAgo, 60 * 60 * 1000, 24)
 */
export function segmentsOver(
	results: Segmentable[],
	start: number,
	periodMs: number,
	periods: number,
): UptimeBar.Status[] {
	let segments: UptimeBar.Status[] = Array.from({ length: periods }, () => null);

	for (let result of results) {
		let index = Math.floor((result.checked_at - start) / periodMs);
		if (index < 0 || index >= periods) continue;

		segments[index] = worstStatus(segments[index] ?? null, result.status);
	}

	return segments;
}

/**
 * The three numbers under a report's bar, read off the watch's own running totals rather
 * than re-derived from its history.
 *
 * Those columns already cover exactly the window a whole-watch report describes, so counting
 * 168 rows to reach the same answer would be work with no different result. The bar still
 * needs the rows, because daily segments cannot be recovered from a total.
 *
 * `max_response_time_ms` is zero exactly when nothing ever answered — the column starts at
 * zero and only ever takes a `MAX` against a real measurement — so zero is reported as "no
 * slowest response" rather than as an implausibly fast one.
 *
 * @param watch - The watch to report on.
 * @returns Checks run, uptime as a percentage string, and the slowest response.
 */
export function watchStats(watch: SelectTrialWatch): TrialStats {
	return {
		checks: watch.checks_run,
		uptime: watch.checks_run === 0 ? null : formatUptime(watch.checks_ok / watch.checks_run),
		slowestResponseMs: watch.max_response_time_ms === 0 ? null : watch.max_response_time_ms,
	};
}
