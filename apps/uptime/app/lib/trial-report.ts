/**
 * The arithmetic the free-watch reports share: turning a target's checks
 * into bar segments, reading a watch's running totals into the three
 * numbers under it, and grouping failures into a report's incidents.
 *
 * One place for the bucketing keeps the daily digest, the weekly wrap-up,
 * and a repeat-submission report agreeing on the same data at three
 * different scales. It builds that data only; rendering stays with the
 * email classes that call it.
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
 * Collapses checks into one segment per period: the worst status any
 * check in that period reported, `null` for an uncovered period, and
 * out-of-range checks excluded from the bar entirely.
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

/** One run of consecutive failed checks on a watched target, as a report states it. */
export interface TrialIncident {
	/** The first check that came back `down`. */
	startedAt: number;
	/** The last consecutive check that came back `down`; equal to {@link startedAt} for one. */
	lastFailureAt: number;
	/** How many consecutive checks failed. Always at least one. */
	checks: number;
}

/**
 * Groups a target's checks into incidents: maximal runs of consecutive
 * `down` results, closed by any check that answers, including `degraded`.
 * Checks land an hour apart, so only the count and endpoints are reported.
 *
 * @param results - Checks in any order; sorted here so a caller cannot change the answer.
 * @returns The incidents, oldest first, empty when nothing ever failed.
 * @example incidentsFrom(await TrialWatch.listResults(db, watch.id))
 */
export function incidentsFrom(results: Segmentable[]): TrialIncident[] {
	let ordered = [...results].sort((a, b) => a.checked_at - b.checked_at);
	let incidents: TrialIncident[] = [];
	let current: TrialIncident | null = null;

	for (let result of ordered) {
		if (result.status !== "down") {
			current = null;
			continue;
		}

		if (current === null) {
			current = { startedAt: result.checked_at, lastFailureAt: result.checked_at, checks: 1 };
			incidents.push(current);
			continue;
		}

		current.lastFailureAt = result.checked_at;
		current.checks += 1;
	}

	return incidents;
}

/**
 * The three numbers under a report's bar, read from the watch's own
 * running totals, which already cover the report's exact window. A zero
 * `max_response_time_ms` signals that nothing ever answered the check.
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
