/**
 * The stable string key for one calendar day, `"YYYY-MM-DD"`. Grid and aggregation
 * code needs a key it can group and join on, and this states the format once
 * instead of leaving every caller to slice an ISO string in a zone it forgot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type { CalendarDay, TimeZone } from "./types";

import { InvalidDayKeyError } from "./invalid-day-key-error";
import { calendarDayAt, startOfDayInstant } from "./zone";

/** A day key: four-digit year, two-digit month, two-digit day, hyphen separated. */
const DAY_KEY_PATTERN = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/;

/**
 * The day key for the calendar day an instant falls on in a zone. The same instant
 * yields different keys in different zones, which is the point: the key names a day
 * on someone's calendar, not a moment in time.
 *
 * @param date - Any instant on the day of interest.
 * @param timeZone - IANA zone whose calendar day to name.
 * @returns The `"YYYY-MM-DD"` key, zero padded.
 *
 * @example
 * toDayKey(new Date("2026-07-29T02:00:00Z"), "UTC"); // "2026-07-29"
 * @example
 * toDayKey(new Date("2026-07-29T02:00:00Z"), "America/New_York"); // "2026-07-28"
 */
export function toDayKey(date: Date, timeZone: TimeZone): string {
	let day = calendarDayAt(date.getTime(), timeZone);
	let year = String(day.year).padStart(4, "0");
	let month = String(day.month).padStart(2, "0");
	return `${year}-${month}-${String(day.day).padStart(2, "0")}`;
}

/**
 * Read a day key into its calendar fields, with no zone involved. Days that do not
 * exist are rejected, so `"2026-02-30"` is a failure rather than a silent rollover
 * into March the way `new Date()` would treat it.
 *
 * @param key - Text that should be a `"YYYY-MM-DD"` day key.
 * @returns The calendar day, or an `InvalidDayKeyError` naming the rejected text.
 *
 * @example
 * parseDayKey("2026-07-29"); // { status: "success", data: { year: 2026, month: 7, day: 29 } }
 * @example
 * parseDayKey("2026-02-30"); // { status: "failure", error: InvalidDayKeyError }
 */
export function parseDayKey(key: string): Result<CalendarDay, InvalidDayKeyError> {
	let groups = DAY_KEY_PATTERN.exec(key.trim())?.groups;
	if (!groups) return failure(new InvalidDayKeyError(key));

	let year = Number(groups.year);
	let month = Number(groups.month);
	let day = Number(groups.day);

	// Round-tripping through UTC rejects a day the month does not have, which the
	// pattern alone cannot: it only knows the digits are two long.
	let candidate = new Date(Date.UTC(year, month - 1, day));
	if (
		candidate.getUTCFullYear() !== year ||
		candidate.getUTCMonth() !== month - 1 ||
		candidate.getUTCDate() !== day
	) {
		return failure(new InvalidDayKeyError(key));
	}

	return success({ year, month, day });
}

/**
 * The instant a day key's day starts at in a zone, the inverse of `toDayKey`. It
 * returns a `Result` because the key is usually untrusted input, and a malformed
 * one must not become an `Invalid Date` that poisons later arithmetic.
 *
 * @param key - Text that should be a `"YYYY-MM-DD"` day key.
 * @param timeZone - IANA zone the day belongs to.
 * @returns The day's first instant in that zone, or an `InvalidDayKeyError`.
 *
 * @example
 * fromDayKey("2026-07-29", "America/New_York"); // 2026-07-29T04:00:00Z
 */
export function fromDayKey(key: string, timeZone: TimeZone): Result<Date, InvalidDayKeyError> {
	let parsed = parseDayKey(key);
	if (isFailure(parsed)) return parsed;
	return success(new Date(startOfDayInstant(parsed.data, timeZone)));
}
