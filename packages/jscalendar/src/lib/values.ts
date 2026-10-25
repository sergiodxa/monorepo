/**
 * The JSCalendar value formats: Id, LocalDateTime, UTCDateTime, Duration and SignedDuration,
 * read into numbers and written back in the single representation RFC 8984 allows, plus the
 * zone arithmetic that turns a LocalDateTime and its zone into an instant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ZonedParts } from "@sdxc/dates/zone";

import { DAY_MS, daysInMonth, instantFromParts, utcFromParts, zonedParts } from "@sdxc/dates/zone";

/** The Id alphabet: base64url without padding, 1 to 255 characters. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;

/** A date-time without an offset, the fraction only when non-zero and without trailing zeros. */
const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d*[1-9]))?$/;

/** The parts of a Duration, in the order RFC 8984's grammar allows them. */
const DURATION_PATTERN =
	/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.(\d*[1-9]))?S)?)?$/;

/** The zone names that mean UTC, which resolve without `Intl`. */
const UTC_ZONES = new Set(["Etc/UTC", "UTC", "Etc/GMT", "GMT", "Etc/Zulu", "Zulu"]);

/**
 * A duration's parts. Weeks and days are nominal, so a day across a DST change keeps its
 * wall-clock time; hours, minutes and seconds are exact, and seconds may carry a fraction.
 */
export interface DurationParts {
	negative?: boolean;
	weeks?: number;
	days?: number;
	hours?: number;
	minutes?: number;
	seconds?: number;
}

/**
 * Whether a string is an Id, the key type of every map of objects.
 *
 * @param value - The candidate key
 * @returns `true` for 1 to 255 characters of `A-Za-z0-9`, `-` and `_`
 */
export function isId(value: string): boolean {
	return ID_PATTERN.test(value);
}

/**
 * Reads a LocalDateTime, rejecting impossible dates such as February 30.
 *
 * @param value - E.g. `"2020-01-15T13:00:00"`
 * @returns The wall-clock fields, or `null` when the value is not a LocalDateTime
 */
export function parseLocalDateTime(value: string): ZonedParts | null {
	let match = LOCAL_PATTERN.exec(value);
	if (!match) return null;
	let [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number) as number[];
	let fraction = match[7] ?? "";
	let parts: ZonedParts = {
		year: year as number,
		month: month as number,
		day: day as number,
		hour: hour as number,
		minute: minute as number,
		second: second as number,
		millisecond: fraction === "" ? 0 : Math.round(Number(`0.${fraction}`) * 1000),
	};
	if (parts.month < 1 || parts.month > 12) return null;
	if (parts.day < 1 || parts.day > daysInMonth(parts.year, parts.month)) return null;
	if (parts.hour > 23 || parts.minute > 59 || parts.second > 60) return null;
	return parts;
}

/**
 * Reads a UTCDateTime.
 *
 * @param value - E.g. `"2020-01-02T18:23:04Z"`
 * @returns Epoch milliseconds, or `null` when the value is not a UTCDateTime
 */
export function parseUTCDateTime(value: string): number | null {
	if (!value.endsWith("Z")) return null;
	let parts = parseLocalDateTime(value.slice(0, -1));
	return parts ? utcFromParts(parts) : null;
}

/**
 * Writes wall-clock fields as a LocalDateTime, with a fraction only for non-zero
 * milliseconds.
 *
 * @param parts - The fields; `millisecond` defaults to `0`
 * @returns E.g. `"2020-01-15T13:00:00"`
 */
export function formatLocalDateTime(
	parts: Omit<ZonedParts, "millisecond"> & { millisecond?: number },
): string {
	let pad = (value: number, size = 2) => String(value).padStart(size, "0");
	let text = `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
	let millisecond = parts.millisecond ?? 0;
	if (millisecond === 0) return text;
	return `${text}.${pad(millisecond, 3).replace(/0+$/, "")}`;
}

/**
 * Writes an instant as a UTCDateTime.
 *
 * @param instant - Epoch milliseconds or a `Date`
 * @returns E.g. `"2020-01-02T18:23:04Z"`
 */
export function formatUTCDateTime(instant: number | Date): string {
	let ms = typeof instant === "number" ? instant : instant.getTime();
	return `${formatLocalDateTime(wallFromMs(ms))}Z`;
}

/**
 * Reads a Duration or SignedDuration. A bare `P`, a `T` without a time part, and hours
 * followed by seconds without minutes are rejected, as RFC 8984's grammar does.
 *
 * @param value - E.g. `"PT1H30M"` or `"-PT15M"`
 * @returns The parts, or `null` when the value is not a duration
 */
export function parseDuration(value: string): DurationParts | null {
	let match = DURATION_PATTERN.exec(value);
	if (!match) return null;
	let [, sign, weeks, days, hours, minutes, seconds, fraction] = match;
	let hasTime = value.includes("T");
	if (hasTime && hours === undefined && minutes === undefined && seconds === undefined) return null;
	if (!hasTime && weeks === undefined && days === undefined) return null;
	if (hours !== undefined && seconds !== undefined && minutes === undefined) return null;

	let parts: DurationParts = {};
	if (sign === "-") parts.negative = true;
	if (weeks !== undefined) parts.weeks = Number(weeks);
	if (days !== undefined) parts.days = Number(days);
	if (hours !== undefined) parts.hours = Number(hours);
	if (minutes !== undefined) parts.minutes = Number(minutes);
	if (seconds !== undefined) parts.seconds = Number(fraction ? `${seconds}.${fraction}` : seconds);
	return parts;
}

/**
 * Writes duration parts in the one representation RFC 8984 allows: zero parts omitted,
 * minutes kept between hours and seconds, and `PT0S` for an empty duration.
 *
 * @param parts - The duration; a negative one is written with a leading `-`
 * @returns E.g. `"PT1H30M"` or `"-PT15M"`
 */
export function formatDuration(parts: DurationParts): string {
	let text = "P";
	if (parts.weeks) text += `${parts.weeks}W`;
	if (parts.days) text += `${parts.days}D`;
	let hours = parts.hours ?? 0;
	let minutes = parts.minutes ?? 0;
	let seconds = parts.seconds ?? 0;
	if (hours || minutes || seconds) {
		text += "T";
		if (hours) text += `${hours}H`;
		if (minutes || (hours && seconds)) text += `${minutes}M`;
		if (seconds) text += `${seconds}S`;
	}
	if (text === "P") text = "PT0S";
	return parts.negative && text !== "PT0S" ? `-${text}` : text;
}

/**
 * The exact milliseconds of a duration's hours, minutes and seconds, without its nominal
 * weeks and days.
 *
 * @param parts - The duration
 * @returns Milliseconds, never negative
 */
export function exactMs(parts: DurationParts): number {
	return (((parts.hours ?? 0) * 60 + (parts.minutes ?? 0)) * 60 + (parts.seconds ?? 0)) * 1000;
}

/**
 * A wall clock as milliseconds on a zone-less timeline where every day lasts 24 hours.
 *
 * @param parts - The wall clock
 * @returns Wall milliseconds
 */
export function wallMs(parts: ZonedParts): number {
	return utcFromParts(parts);
}

/**
 * The wall clock wall milliseconds name, the inverse of `wallMs`.
 *
 * @param ms - Wall milliseconds
 * @returns The wall clock
 */
export function wallFromMs(ms: number): ZonedParts {
	let date = new Date(ms);
	return {
		year: date.getUTCFullYear(),
		month: date.getUTCMonth() + 1,
		day: date.getUTCDate(),
		hour: date.getUTCHours(),
		minute: date.getUTCMinutes(),
		second: date.getUTCSeconds(),
		millisecond: date.getUTCMilliseconds(),
	};
}

/**
 * Whether a zone name stands for UTC, which `toInstant` resolves without `Intl`.
 *
 * @param timeZone - A TimeZoneId
 * @returns `true` for `Etc/UTC` and its aliases
 */
export function isUTCZone(timeZone: string): boolean {
	return UTC_ZONES.has(timeZone);
}

/**
 * The instant a wall clock names in a zone. A repeated hour reads with the offset before
 * the change and a skipped one lands as far past it, as RFC 8984 §1.4.5 requires.
 *
 * @param wall - Wall milliseconds
 * @param timeZone - The IANA zone the wall clock is read in
 * @returns Epoch milliseconds
 */
export function toInstant(wall: number, timeZone: string): number {
	if (isUTCZone(timeZone)) return wall;
	return instantFromParts(wallFromMs(wall), timeZone);
}

/**
 * The wall clock an instant shows in a zone.
 *
 * @param instant - Epoch milliseconds
 * @param timeZone - The IANA zone
 * @returns Wall milliseconds
 */
export function toWall(instant: number, timeZone: string): number {
	if (isUTCZone(timeZone)) return instant;
	return utcFromParts(zonedParts(instant, timeZone));
}

/**
 * Adds a duration to a wall clock in a zone, per RFC 8984 §1.4.6: weeks and days on the
 * calendar, then hours, minutes and seconds in absolute time.
 *
 * @param wall - The starting wall milliseconds
 * @param parts - The duration; a negative one subtracts
 * @param timeZone - The zone the wall clock is read in
 * @returns The resulting instant
 */
export function addDuration(wall: number, parts: DurationParts, timeZone: string): number {
	let sign = parts.negative ? -1 : 1;
	let days = (parts.weeks ?? 0) * 7 + (parts.days ?? 0);
	return toInstant(wall + sign * days * DAY_MS, timeZone) + sign * exactMs(parts);
}
