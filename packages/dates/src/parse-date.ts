/**
 * The guarded replacement for `new Date(value)`. It reports unreadable input as a
 * failure instead of returning an `Invalid Date`, so a bad query parameter is
 * rejected at the boundary rather than turning every later result into `NaN`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";

import { InvalidDateError } from "./invalid-date-error";

/**
 * Reads text or a timestamp into a `Date`, failing instead of producing an
 * `Invalid Date`. A date-only string is read as UTC midnight; use
 * `fromDayKey()` when the input names a calendar day rather than an instant.
 *
 * @param input - Text or a millisecond timestamp.
 * @returns The instant, or an `InvalidDateError` naming the rejected input.
 *
 * @example
 * parseDate("2026-07-29T10:00:00Z"); // { status: "success", data: Date }
 * @example
 * parseDate("not a date"); // { status: "failure", error: InvalidDateError }
 */
export function parseDate(input: string | number): Result<Date, InvalidDateError> {
	let date = new Date(input);
	if (Number.isNaN(date.getTime())) return failure(new InvalidDateError(input));
	return success(date);
}
