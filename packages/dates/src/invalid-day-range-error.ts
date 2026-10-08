/**
 * The failure value `validateDayRange` reports. It names the rule the range broke, so a
 * caller can pick its own message per rule, and keeps the submitted ends for a log line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DayRange } from "./types.js";

/**
 * The rule a day range breaks: an end that names no calendar day, `from` after `to`, `to`
 * after the latest allowed day, or more days than allowed.
 */
export type DayRangeProblem = "invalid" | "reversed" | "tooLate" | "tooLong";

/** Error describing a submitted day range that breaks one of the rules a caller set. */
export class InvalidDayRangeError extends Error {
	/** The first rule the range breaks, checked in the order the type lists them. */
	readonly problem: DayRangeProblem;
	/** The submitted ends, kept verbatim for diagnostics. */
	readonly range: DayRange;

	/**
	 * @param problem - The rule the range breaks.
	 * @param range - The submitted ends.
	 */
	constructor(problem: DayRangeProblem, range: DayRange) {
		super(`Invalid day range (${problem}): ${JSON.stringify(range)}`);
		this.name = "InvalidDayRangeError";
		this.problem = problem;
		this.range = range;
	}
}
