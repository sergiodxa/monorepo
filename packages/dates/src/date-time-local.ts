/**
 * Values for `<input type="datetime-local">`: a wall clock with no zone attached.
 * The input shows and submits what a clock reads, so turning it into an instant
 * and back always needs the reader's zone, which both functions here take.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { TimeZone } from "./types.js";

import { InvalidDateTimeLocalError } from "./invalid-date-time-local-error.js";
import { daysInMonth, instantFromParts, zonedParts } from "./zone.js";

/**
 * A `datetime-local` value: date, `T`, hours and minutes, then optional seconds
 * and an optional one-to-three-digit fraction, which browsers submit when the
 * input's `step` is below a minute.
 */
const DATE_TIME_LOCAL_PATTERN =
	/^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2})(?::(?<second>\d{2})(?:\.(?<fraction>\d{1,3}))?)?$/;

/**
 * Zero-pad a wall-clock field to a fixed width.
 *
 * @param value - Field value to pad.
 * @param width - Digits the field must occupy.
 * @returns The padded digits.
 */
function pad(value: number, width = 2): string {
	return String(value).padStart(width, "0");
}

/**
 * The `datetime-local` value showing an instant as a clock in a zone reads it,
 * `"YYYY-MM-DDTHH:mm"`. Seconds are dropped, matching the input's default one
 * minute step, so the value pre-fills a field without triggering its validation.
 *
 * @param date - Instant to show.
 * @param timeZone - IANA zone whose clock the field displays.
 * @returns The value to place in the input's `value` attribute.
 *
 * @example
 * toDateTimeLocal(new Date("2026-07-29T14:30:00Z"), "America/New_York"); // "2026-07-29T10:30"
 */
export function toDateTimeLocal(date: Date, timeZone: TimeZone): string {
	let parts = zonedParts(date.getTime(), timeZone);
	let day = `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
	return `${day}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

/**
 * Reads a submitted `datetime-local` value as the instant it names in a zone. A
 * day the month lacks or a time past `23:59:59` is a named failure; a time DST
 * repeats or skips resolves as `instantFromParts` does, to a real instant.
 *
 * @param value - Text that should be a `datetime-local` value, usually form input.
 * @param timeZone - IANA zone whose clock the value was read from.
 * @returns The instant, or an `InvalidDateTimeLocalError` naming the rejected text.
 *
 * @example
 * parseDateTimeLocal("2026-07-29T10:30", "America/New_York"); // { status: "success", data: 2026-07-29T14:30:00Z }
 * @example
 * parseDateTimeLocal("2026-02-30T10:00", "UTC"); // { status: "failure", error: InvalidDateTimeLocalError }
 */
export function parseDateTimeLocal(
	value: string,
	timeZone: TimeZone,
): Result<Date, InvalidDateTimeLocalError> {
	let groups = DATE_TIME_LOCAL_PATTERN.exec(value.trim())?.groups;
	if (!groups) return failure(new InvalidDateTimeLocalError(value));

	let year = Number(groups.year);
	let month = Number(groups.month);
	let day = Number(groups.day);
	let hour = Number(groups.hour);
	let minute = Number(groups.minute);
	let second = Number(groups.second ?? 0);
	let millisecond = Number((groups.fraction ?? "").padEnd(3, "0"));

	if (
		month < 1 ||
		month > 12 ||
		day < 1 ||
		day > daysInMonth(year, month) ||
		hour > 23 ||
		minute > 59 ||
		second > 59
	) {
		return failure(new InvalidDateTimeLocalError(value));
	}

	let parts = { year, month, day, hour, minute, second, millisecond };
	return success(new Date(instantFromParts(parts, timeZone)));
}
