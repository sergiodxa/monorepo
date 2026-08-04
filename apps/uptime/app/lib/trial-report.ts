/**
 * The arithmetic the free-watch reports share: turning a target's checks into the segments of
 * an uptime bar, reading a watch's running totals off as the three numbers under it, and
 * grouping its failures into the incidents a report can name.
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
 * Groups a target's checks into incidents: maximal runs of consecutive `down` results.
 *
 * **Only `down` opens an incident.** `degraded` is a slow answer, not an outage, and calling
 * it one would make a report claim something the reader can check and disprove. It is still
 * visible — it colours its own segment of the bar, and it is excluded from `checks_ok` — so
 * nothing is hidden by leaving it out of this count.
 *
 * **No duration is derived, deliberately.** Checks are an hour apart, so the only honest
 * statements available are when the first failure was seen, when the last one was, and how
 * many there were. Turning that into "down for 3 hours" would assert something about the
 * fifty-nine minutes between checks that nothing observed, and the error is one-sided:
 * every such figure reads as more precise than the data it came from.
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
