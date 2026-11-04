/**
 * Turns a duration budget flag into milliseconds, accepting both
 * `@sdxc/duration` strings and raw millisecond numbers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { InvalidDurationError, toMs } from "@sdxc/duration";
import { failure, success } from "@sdxc/result";

/**
 * Milliseconds for a budget. Numbers pass through; duration strings go through
 * `toMs`, and text that is not a duration fails with {@link InvalidDurationError}.
 *
 * @param input - A duration string or a bare millisecond count.
 */
export function budgetMs(input: DurationInput): Result<number, InvalidDurationError> {
	if (typeof input === "number") {
		if (!Number.isFinite(input) || input < 0) {
			return failure(new InvalidDurationError(String(input)));
		}
		return success(input);
	}
	let ms = toMs(input);
	if (Number.isNaN(ms)) return failure(new InvalidDurationError(input));
	return success(ms);
}

/**
 * Parses a CLI flag that may be a duration string or a bare millisecond
 * number written as text (`"200ms"` or `"200"`).
 *
 * @param text - Flag value from the command line.
 */
export function parseBudgetFlag(text: string): Result<number, InvalidDurationError> {
	if (/^\d+(\.\d+)?$/.test(text)) return budgetMs(Number(text));
	return budgetMs(text as DurationInput);
}
