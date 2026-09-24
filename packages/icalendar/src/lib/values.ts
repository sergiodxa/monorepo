/**
 * The value types of RFC 5545 §3.3 a typed property carries: DATE and DATE-TIME (UTC,
 * floating or zoned), DURATION, PERIOD and UTC-OFFSET, each read leniently into the model
 * and written in the one form the grammar allows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ICalendar } from "../types.js";

/** A value and the parameters that type it, the shape a typed property is written in. */
export interface WrittenValue {
	value: string;
	parameters: Record<string, string[]>;
}

/** `YYYYMMDD`. */
const DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;

/** `YYYYMMDDTHHMMSS` with an optional `Z`. */
const DATE_TIME_PATTERN = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/i;

/** `[+-]P` then weeks, days and a `T` time part, each optional but not all absent. */
const DURATION_PATTERN = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i;

/** `+HHMM` or `+HHMMSS`, with a mandatory sign. */
const UTC_OFFSET_PATTERN = /^([+-])(\d{2})(\d{2})(\d{2})?$/;

/**
 * The days a month has in the proleptic Gregorian calendar.
 *
 * @param year - Calendar year
 * @param month - `1` through `12`
 * @returns `28` through `31`
 */
export function daysInMonth(year: number, month: number): number {
	if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
	return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Reads `YYYYMMDD` into a DATE, refusing a month or day the calendar does not have.
 *
 * @param text - The written date
 * @returns The date, or `null`
 */
function parseDate(text: string): Extract<ICalendar.DateValue, { type: "date" }> | null {
	let match = DATE_PATTERN.exec(text);
	if (!match) return null;
	let [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
	return { type: "date", year, month, day };
}

/**
 * Reads `YYYYMMDDTHHMMSS[Z]`, refusing impossible fields; second `60` is the leap second
 * the RFC allows.
 *
 * @param text - The written date-time
 * @returns The wall clock and whether it is UTC, or `null`
 */
export function parseDateTime(text: string): { wall: ICalendar.WallClock; utc: boolean } | null {
	let match = DATE_TIME_PATTERN.exec(text);
	if (!match) return null;
	let date = parseDate(text.slice(0, 8));
	if (!date) return null;
	let [hour, minute, second] = [Number(match[4]), Number(match[5]), Number(match[6])];
	if (hour > 23 || minute > 59 || second > 60) return null;
	let wall = { year: date.year, month: date.month, day: date.day, hour, minute, second };
	return { wall, utc: match[7] !== "" };
}

/**
 * Reads a DATE or DATE-TIME value. `VALUE=DATE`, or eight digits with no `VALUE`, is a
 * DATE; a trailing `Z` is UTC even beside a `TZID`, a `TZID` names the zone, and a bare
 * time is floating.
 *
 * @param text - One written value
 * @param parameters - The property's parameters
 * @returns The value, or `null` when it does not parse
 */
export function parseDateValue(
	text: string,
	parameters: Record<string, string[]>,
): ICalendar.DateValue | null {
	let type = parameters.VALUE?.[0]?.toUpperCase();
	if (type === "DATE" || (type === undefined && text.length === 8)) return parseDate(text);
	let parsed = parseDateTime(text);
	if (!parsed) return null;
	let tzid = parameters.TZID?.[0];
	let zone: "utc" | "floating" | { tzid: string } = "floating";
	if (parsed.utc) zone = "utc";
	else if (tzid) zone = { tzid };
	return { type: "date-time", wall: parsed.wall, zone };
}

/**
 * Pads a number with leading zeros.
 *
 * @param value - A non-negative integer
 * @param width - Digits to write
 * @returns The padded digits
 */
function pad(value: number, width: number): string {
	return String(value).padStart(width, "0");
}

/**
 * Writes a wall clock as `YYYYMMDDTHHMMSS`.
 *
 * @param wall - The wall clock
 * @returns The written date-time, without a zone marker
 */
export function formatWall(wall: ICalendar.WallClock): string {
	let date = `${pad(wall.year, 4)}${pad(wall.month, 2)}${pad(wall.day, 2)}`;
	return `${date}T${pad(wall.hour, 2)}${pad(wall.minute, 2)}${pad(wall.second, 2)}`;
}

/**
 * Writes a DATE or DATE-TIME with the parameters that type it: `VALUE=DATE` for a date and
 * `TZID` for a zoned time, whose `VTIMEZONE` the calendar must carry.
 *
 * @param value - The value to write
 * @returns The written value and its parameters
 */
export function formatDateValue(value: ICalendar.DateValue): WrittenValue {
	if (value.type === "date") {
		return {
			value: `${pad(value.year, 4)}${pad(value.month, 2)}${pad(value.day, 2)}`,
			parameters: { VALUE: ["DATE"] },
		};
	}
	if (value.zone === "utc") return { value: `${formatWall(value.wall)}Z`, parameters: {} };
	if (value.zone === "floating") return { value: formatWall(value.wall), parameters: {} };
	return { value: formatWall(value.wall), parameters: { TZID: [value.zone.tzid] } };
}

/**
 * Reads a DURATION. Weeks mixed with other parts are accepted, since producers write them
 * although the grammar forbids it.
 *
 * @param text - The written duration
 * @returns The duration, or `null`
 */
export function parseDuration(text: string): ICalendar.Duration | null {
	let match = DURATION_PATTERN.exec(text);
	if (!match) return null;
	let [, sign, weeks, days, hours, minutes, seconds] = match;
	let hasTime = /T/i.test(text);
	if (hasTime && hours === undefined && minutes === undefined && seconds === undefined) return null;
	if (!hasTime && weeks === undefined && days === undefined) return null;
	let duration: ICalendar.Duration = {};
	if (sign === "-") duration.negative = true;
	if (weeks !== undefined) duration.weeks = Number(weeks);
	if (days !== undefined) duration.days = Number(days);
	if (hours !== undefined) duration.hours = Number(hours);
	if (minutes !== undefined) duration.minutes = Number(minutes);
	if (seconds !== undefined) duration.seconds = Number(seconds);
	return duration;
}

/**
 * Writes a DURATION in the grammar's form: weeks alone as `PnW`, otherwise weeks folded
 * into days, a zero minute between hours and seconds, and `PT0S` for no length at all.
 *
 * @param duration - The duration to write
 * @returns The written duration
 */
export function formatDuration(duration: ICalendar.Duration): string {
	let sign = duration.negative ? "-" : "";
	let { weeks = 0, days = 0, hours = 0, minutes = 0, seconds = 0 } = duration;
	if (weeks > 0 && days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
		return `${sign}P${weeks}W`;
	}
	let totalDays = days + weeks * 7;
	let time = "";
	if (hours > 0) time += `${hours}H`;
	if (minutes > 0 || (hours > 0 && seconds > 0)) time += `${minutes}M`;
	if (seconds > 0) time += `${seconds}S`;
	if (totalDays === 0 && time === "") return `${sign}PT0S`;
	return `${sign}P${totalDays > 0 ? `${totalDays}D` : ""}${time ? `T${time}` : ""}`;
}

/**
 * Reads a PERIOD: a start, a `/`, and an end or a duration. A `TZID` applies to both ends.
 *
 * @param text - One written period
 * @param parameters - The property's parameters
 * @returns The period, or `null`
 */
export function parsePeriod(
	text: string,
	parameters: Record<string, string[]>,
): ICalendar.Period | null {
	let slash = text.indexOf("/");
	if (slash === -1) return null;
	let timeParameters = { ...parameters, VALUE: ["DATE-TIME"] };
	let start = parseDateValue(text.slice(0, slash), timeParameters);
	if (!start) return null;
	let rest = text.slice(slash + 1);
	if (/^[+-]?P/i.test(rest)) {
		let duration = parseDuration(rest);
		return duration ? { type: "period", start, duration } : null;
	}
	let end = parseDateValue(rest, timeParameters);
	return end ? { type: "period", start, end } : null;
}

/**
 * Writes a PERIOD with the start's parameters, minus the `VALUE` the caller sets.
 *
 * @param period - The period to write
 * @returns The written period and its parameters
 */
export function formatPeriod(period: ICalendar.Period): WrittenValue {
	let start = formatDateValue(period.start);
	let tail = period.end ? formatDateValue(period.end).value : formatDuration(period.duration ?? {});
	return { value: `${start.value}/${tail}`, parameters: start.parameters };
}

/**
 * Reads a UTC-OFFSET into minutes east of UTC; seconds become a fraction of a minute.
 *
 * @param text - The written offset, e.g. `-0500`
 * @returns Minutes, or `null`
 */
export function parseUtcOffset(text: string): number | null {
	let match = UTC_OFFSET_PATTERN.exec(text);
	if (!match) return null;
	let minutes = Number(match[2]) * 60 + Number(match[3]) + Number(match[4] ?? 0) / 60;
	return match[1] === "-" ? -minutes : minutes;
}

/**
 * Writes minutes east of UTC as a UTC-OFFSET, adding seconds only when the offset has them.
 *
 * @param minutes - Minutes east of UTC
 * @returns The written offset
 */
export function formatUtcOffset(minutes: number): string {
	let totalSeconds = Math.round(Math.abs(minutes) * 60);
	let hours = Math.floor(totalSeconds / 3600);
	let rest = totalSeconds % 3600;
	let written = `${pad(hours, 2)}${pad(Math.floor(rest / 60), 2)}`;
	if (rest % 60 !== 0) written += pad(rest % 60, 2);
	return `${minutes < 0 ? "-" : "+"}${written}`;
}
