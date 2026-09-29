/**
 * The date range a report covers: whole UTC days, both ends inclusive, ending yesterday at
 * the latest because today's roll-up has not run. Resolves the builder's presets and checks
 * a submitted range, naming the rule a bad one breaks so the page can say it in the locale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { getYesterdayDateUtc } from "~/app/data/monitor-daily-stats";

/** The longest range a report covers, a leap year of daily rows. */
export const MAX_REPORT_DAYS = 366;

/** Milliseconds in a UTC day, which has no DST. */
const DAY_MS = 86_400_000;

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
	let year = today.getUTCFullYear();
	let month = today.getUTCMonth();

	switch (preset) {
		case "lastMonth": {
			return { from: isoDate(Date.UTC(year, month - 1, 1)), to: isoDate(Date.UTC(year, month, 0)) };
		}
		case "last30Days": {
			return { from: isoDate(parseDay(yesterday)! - 29 * DAY_MS), to: yesterday };
		}
		case "lastQuarter": {
			let quarterStart = month - (month % 3);
			return {
				from: isoDate(Date.UTC(year, quarterStart - 3, 1)),
				to: isoDate(Date.UTC(year, quarterStart, 0)),
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
	if (from > to) return failure(new ReportRangeError("reversed"));
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
	return Math.round((parseDay(range.to)! - parseDay(range.from)!) / DAY_MS) + 1;
}

/**
 * Whether a range is exactly one calendar month, which filenames write as `2026-08`.
 *
 * @param range - A checked range
 * @returns `true` for the first through the last day of one month
 */
export function isWholeMonth(range: ReportRange): boolean {
	if (!range.from.endsWith("-01") || range.from.slice(0, 7) !== range.to.slice(0, 7)) {
		return false;
	}
	let [year, month] = range.from.split("-").map(Number);
	return range.to === isoDate(Date.UTC(year!, month!, 0));
}

/**
 * Reads `YYYY-MM-DD` as the UTC midnight it names, rejecting days the calendar lacks
 * (`2026-02-30`), which `Date.UTC` would otherwise roll into March.
 *
 * @param value - The submitted day
 * @returns Epoch milliseconds, or `null` when the day does not exist
 */
function parseDay(value: string): number | null {
	let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return null;
	let instant = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
	return isoDate(instant) === value ? instant : null;
}

/**
 * Writes an instant as its UTC day.
 *
 * @param instant - Epoch milliseconds
 * @returns `YYYY-MM-DD`
 */
function isoDate(instant: number): string {
	return new Date(instant).toISOString().slice(0, 10);
}
