/**
 * The arithmetic the free-watch reports share: turning a target's checks into the segments of
 * an uptime bar, turning a success ratio into the percentage those emails print, and reading
 * a watch's running totals off as the three numbers under the bar.
 *
 * Shared because the same bar is drawn at three scales by three different senders — one
 * segment per hour over a day for the daily digest, one per day over a week for the wrap-up,
 * and the same week again when a repeat submission is answered with a report instead of a
 * second free week — and the only thing that differs between them is the period. Keeping the
 * bucketing in one place is what stops a bar in one email disagreeing with the same data in
 * another.
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

/**
 * Severity of each status, for collapsing a period's checks into the one segment a bar draws.
 * The worst wins: a summary that averaged an outage away would hide the only thing in it a
 * reader could act on.
 */
const SEVERITY: Record<MonitorStatus, number> = { up: 0, degraded: 1, down: 2 };

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

		let current = segments[index] ?? null;
		if (current === null || SEVERITY[result.status] > SEVERITY[current]) {
			segments[index] = result.status;
		}
	}

	return segments;
}

/**
 * A success ratio as the percentage a digest prints, without its sign — the emails add that
 * themselves, since where the symbol goes is a property of the language.
 *
 * @param ratio - Healthy checks over total checks, between 0 and 1.
 * @returns The percentage to one decimal, e.g. `"99.4"`.
 */
export function formatUptime(ratio: number): string {
	return (ratio * 100).toFixed(1);
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
