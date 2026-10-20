/**
 * The trailing-baseline comparison behind the daily attack-signal alert: how many
 * failed sign-ins a tenant saw in the last hour, set against how many its own past
 * week saw per hour on average, and the line that separates ordinary variation from
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FailedSignInsByHour } from "~/app/services/attack-signals";

/** Hours the trailing baseline averages across: a full week. */
export const BASELINE_WINDOW_HOURS = 7 * 24;

/** How many times the trailing hourly average the recent count must clear to count as elevated. */
const BASELINE_MULTIPLIER = 3;

/** The recent count must clear this floor for the multiple above to trigger anything. */
const MINIMUM_ELEVATED_FAILURES = 5;

/**
 * Sums every hour's own count — the shape both a recent and a baseline window's
 * read return.
 *
 * @param rows - One window's failed-sign-in rows, as `readFailedSignInsByHour` returns them.
 * @returns The window's total failed sign-ins.
 */
export function sumFailedSignIns(rows: FailedSignInsByHour[]): number {
	return rows.reduce((total, row) => total + row.count, 0);
}

/**
 * Averages a baseline window's failures across every hour the window spans.
 *
 * @param rows - The baseline window's failed-sign-in rows.
 * @param windowHours - How many hours the window spans; defaults to {@link BASELINE_WINDOW_HOURS}.
 * @returns The trailing hourly average.
 */
export function baselineHourlyAverage(
	rows: FailedSignInsByHour[],
	windowHours: number = BASELINE_WINDOW_HOURS,
): number {
	return sumFailedSignIns(rows) / windowHours;
}

/** The comparison {@link compareToBaseline} reports. */
export interface AttackSignalBaselineComparison {
	/** Whether the recent count stands well above the trailing average. */
	elevated: boolean;
	/** The recent window's own total, carried through for the alert copy. */
	recentFailures: number;
	/** The trailing hourly average the recent count was compared against. */
	baselineHourlyAverage: number;
}

/**
 * Compares a tenant's most recent failed-sign-in count to its own trailing hourly
 * average.
 *
 * @param recentFailures - The recent window's own total failed sign-ins.
 * @param baselineHourlyAverageValue - The tenant's trailing hourly average, from {@link baselineHourlyAverage}.
 * @returns The comparison, including whether it counts as elevated.
 * @example
 * let comparison = compareToBaseline(
 * 	sumFailedSignIns(recentRows),
 * 	baselineHourlyAverage(baselineRows),
 * );
 */
export function compareToBaseline(
	recentFailures: number,
	baselineHourlyAverageValue: number,
): AttackSignalBaselineComparison {
	let elevated =
		recentFailures >= MINIMUM_ELEVATED_FAILURES &&
		recentFailures > baselineHourlyAverageValue * BASELINE_MULTIPLIER;

	return { elevated, recentFailures, baselineHourlyAverage: baselineHourlyAverageValue };
}
