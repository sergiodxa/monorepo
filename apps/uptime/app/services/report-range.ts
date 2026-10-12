/**
 * The date range a report covers: whole UTC days, both ends inclusive, ending yesterday at
 * the latest because today's roll-up has not run. Resolves the builder's presets and checks
 * a submitted range, naming the rule a bad one breaks so the page can say it in the locale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DayRange, DayRangeProblem } from "@sdxc/dates";
import type { Result } from "@sdxc/result";

import {
	addMonths,
	lastNDaysRange,
	monthRange,
	quarterRange,
	subDays,
	validateDayRange,
	yearToDateRange,
} from "@sdxc/dates";
import { failure, isFailure, success } from "@sdxc/result";

import { getYesterdayDateUtc } from "~/app/models/monitor-daily-stats";

/** The longest range a report covers, a leap year of daily rows. */
export const MAX_REPORT_DAYS = 366;

/**
 * The rule a submitted range breaks, used as the last segment of its translation key.
 */
export type ReportRangeProblem = "invalid" | "reversed" | "future" | "tooLong";

/** The report's name for each day-range rule; a range past yesterday reaches into the future. */
const PROBLEMS: Record<DayRangeProblem, ReportRangeProblem> = {
	invalid: "invalid",
	reversed: "reversed",
	tooLate: "future",
	tooLong: "tooLong",
};

/**
 * Carries the broken rule to the builder page, which re-renders with its message.
 */
export class ReportRangeError extends Error {
	override name = "ReportRangeError";
	problem: ReportRangeProblem;

	/**
	 * @param problem - The rule the range breaks
	 */
	constructor(problem: ReportRangeProblem) {
		super(`Invalid report range: ${problem}`);
		this.problem = problem;
	}
}

/**
 * The presets the builder offers. `lastMonth` is the default because a monthly report
 * is what an agency sends.
 */
export const REPORT_PRESETS = ["lastMonth", "last30Days", "lastQuarter", "yearToDate"] as const;

export type ReportPreset = (typeof REPORT_PRESETS)[number];

/**
 * Resolves a preset against the current instant.
 *
 * `lastQuarter` is the last full calendar quarter, and `yearToDate` runs from 1 January to
 * yesterday, which on 1 January is last year's whole year instead of an empty range.
 *
 * @param preset - The preset to resolve
 * @param now - The current instant in epoch milliseconds
 * @returns The range the preset names
 */
export function presetRange(preset: ReportPreset, now: number = Date.now()): DayRange {
	let today = new Date(now);
	let yesterday = subDays(today, 1);

	switch (preset) {
		case "lastMonth":
			return monthRange(addMonths(today, -1, "UTC"), "UTC");
		case "last30Days":
			return lastNDaysRange(30, { from: yesterday, timeZone: "UTC" });
		case "lastQuarter":
			return quarterRange(addMonths(today, -3, "UTC"), "UTC");
		case "yearToDate":
			return yearToDateRange(yesterday, "UTC");
	}
}

/**
 * Checks a submitted range: both ends real calendar days, `from` not after `to`, `to` no
 * later than yesterday, and at most {@link MAX_REPORT_DAYS} days long.
 *
 * @param range - The submitted ends
 * @param now - The current instant in epoch milliseconds
 * @returns The range, or the first rule it breaks
 */
export function checkRange(
	range: DayRange,
	now: number = Date.now(),
): Result<DayRange, ReportRangeError> {
	let checked = validateDayRange(range, {
		latest: getYesterdayDateUtc(now),
		maxDays: MAX_REPORT_DAYS,
	});
	if (isFailure(checked)) return failure(new ReportRangeError(PROBLEMS[checked.error.problem]));
	return success(checked.data);
}
