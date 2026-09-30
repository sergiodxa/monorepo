/**
 * The date range a report covers: whole UTC days, both ends inclusive, ending yesterday at
 * the latest because today's roll-up has not run. Resolves the builder's presets and checks
 * a submitted range, naming the rule a bad one breaks so the page can say it in the locale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import {
	addMonths,
	diffInDays,
	endOfMonth,
	endOfQuarter,
	fromDayKey,
	startOfDay,
	startOfMonth,
	startOfQuarter,
	subDays,
	toDayKey,
} from "@sdxc/dates";
import { failure, isFailure, success } from "@sdxc/result";

import { getYesterdayDateUtc } from "~/app/data/monitor-daily-stats";

/** The longest range a report covers, a leap year of daily rows. */
export const MAX_REPORT_DAYS = 366;

/**
 * An inclusive range of UTC days as `YYYY-MM-DD`.
 */
export interface ReportRange {
	from: string;
	to: string;
}

/**
 * The rule a submitted range breaks, used as the last segment of its translation key.
 */
export type ReportRangeProblem = "invalid" | "reversed" | "future" | "tooLong";

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
export function presetRange(preset: ReportPreset, now: number = Date.now()): ReportRange {
	let yesterday = getYesterdayDateUtc(now);
	let today = new Date(now);

	switch (preset) {
		case "lastMonth": {
			let previous = addMonths(startOfMonth(today, "UTC"), -1, "UTC");
			return { from: toDayKey(previous, "UTC"), to: toDayKey(endOfMonth(previous, "UTC"), "UTC") };
		}
		case "last30Days": {
			return { from: toDayKey(subDays(startOfDay(today, "UTC"), 30), "UTC"), to: yesterday };
		}
		case "lastQuarter": {
			let previous = addMonths(startOfQuarter(today, "UTC"), -3, "UTC");
			return {
				from: toDayKey(previous, "UTC"),
				to: toDayKey(endOfQuarter(previous, "UTC"), "UTC"),
			};
		}
		case "yearToDate": {
			return { from: `${yesterday.slice(0, 4)}-01-01`, to: yesterday };
		}
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
	range: ReportRange,
	now: number = Date.now(),
): Result<ReportRange, ReportRangeError> {
	let from = parseDay(range.from);
	let to = parseDay(range.to);
	if (from === null || to === null) return failure(new ReportRangeError("invalid"));
	if (from.getTime() > to.getTime()) return failure(new ReportRangeError("reversed"));
	if (range.to > getYesterdayDateUtc(now)) return failure(new ReportRangeError("future"));
	if (dayCount(range) > MAX_REPORT_DAYS) return failure(new ReportRangeError("tooLong"));
	return success(range);
}

/**
 * The number of days a range covers, both ends included.
 *
 * @param range - A checked range
 * @returns The day count
 */
export function dayCount(range: ReportRange): number {
	return diffInDays(parseDay(range.to)!, parseDay(range.from)!, "UTC") + 1;
}

/**
 * Whether a range is exactly one calendar month, which filenames write as `2026-08`.
 *
 * @param range - A checked range
 * @returns `true` for the first through the last day of one month
 */
export function isWholeMonth(range: ReportRange): boolean {
	let from = parseDay(range.from);
	if (from === null) return false;
	return (
		range.from === toDayKey(startOfMonth(from, "UTC"), "UTC") &&
		range.to === toDayKey(endOfMonth(from, "UTC"), "UTC")
	);
}

/**
 * Reads `YYYY-MM-DD` exactly as written as the UTC midnight it names, so a day the
 * calendar lacks (`2026-02-30`) or a value with surrounding whitespace reads as `null`.
 *
 * @param value - The submitted day
 * @returns The day's first instant, or `null` when the value names no day
 */
function parseDay(value: string): Date | null {
	let parsed = fromDayKey(value, "UTC");
	if (isFailure(parsed) || toDayKey(parsed.data, "UTC") !== value) return null;
	return parsed.data;
}
