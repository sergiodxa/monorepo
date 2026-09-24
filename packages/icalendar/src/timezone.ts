/**
 * Builds `VTIMEZONE`s from the runtime's `Intl` data: the offset changes an IANA zone goes
 * through inside a span, each written as its own observance with an explicit onset, which
 * every client reads as written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { DAY_MS, offsetMsAt } from "@sdxc/dates/zone";
import { failure, success } from "@sdxc/result";

import type { ICalendar } from "./types.js";

import { TimeZoneError } from "./lib/errors.js";
import { wallFromMs } from "./lib/expand.js";
import { isIntlZone } from "./lib/zones.js";

export { TimeZoneError } from "./lib/errors.js";

/** How far back from the span's start to look for the transition in force at it. */
const LOOKBACK_MS = 400 * DAY_MS;

/**
 * The first instant at which a zone's offset differs from its offset at `low`, found by
 * bisection to the second between two instants whose offsets differ.
 *
 * @param timeZone - The zone
 * @param low - An instant before the change
 * @param high - An instant after it
 * @returns The instant of the change
 */
function transitionBetween(timeZone: string, low: number, high: number): number {
	let before = offsetMsAt(low, timeZone);
	let [start, end] = [low, high];
	while (end - start > 1000) {
		let middle = Math.floor((start + end) / 2000) * 1000;
		if (middle <= start) break;
		if (offsetMsAt(middle, timeZone) === before) start = middle;
		else end = middle;
	}
	return end;
}

/**
 * Every offset change of a zone between two instants, probed a day at a time, since no zone
 * changes its offset twice within one day.
 *
 * @param timeZone - The zone
 * @param from - First instant to probe
 * @param to - Last instant to probe
 * @returns The instants of each change, ascending
 */
function transitions(timeZone: string, from: number, to: number): number[] {
	let found: number[] = [];
	let previous = from;
	let previousOffset = offsetMsAt(from, timeZone);
	for (let probe = from + DAY_MS; previous < to; probe = Math.min(probe + DAY_MS, to)) {
		let offset = offsetMsAt(probe, timeZone);
		if (offset !== previousOffset) found.push(transitionBetween(timeZone, previous, probe));
		[previous, previousOffset] = [probe, offset];
	}
	return found;
}

/**
 * The zone's short name at an instant, e.g. `EST` or `GMT+1`, as `Intl` spells it in English.
 *
 * @param timeZone - The zone
 * @param instant - The instant
 * @returns The name, or `undefined` when `Intl` gives none
 */
function shortName(timeZone: string, instant: number): string | undefined {
	let format = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" });
	return format.formatToParts(instant).find((part) => part.type === "timeZoneName")?.value;
}

/**
 * The zone's standard offset in a year: the smaller of its January and July offsets, which
 * holds in both hemispheres.
 *
 * @param timeZone - The zone
 * @param year - The year
 * @returns Offset in milliseconds
 */
function standardOffset(timeZone: string, year: number): number {
	return Math.min(
		offsetMsAt(Date.UTC(year, 0, 1), timeZone),
		offsetMsAt(Date.UTC(year, 6, 1), timeZone),
	);
}

/**
 * An observance for the change at an instant: its onset is the local time just before the
 * change, as `TZOFFSETFROM` reads it, and it is `DAYLIGHT` when the new offset is above the
 * year's standard one.
 *
 * @param timeZone - The zone
 * @param instant - When the offset changes, or the span's start when it never does
 * @returns The observance
 */
function observanceAt(timeZone: string, instant: number): ICalendar.Observance {
	let offsetFrom = offsetMsAt(instant - 1000, timeZone);
	let offsetTo = offsetMsAt(instant, timeZone);
	let year = new Date(instant).getUTCFullYear();
	let observance: ICalendar.Observance = {
		kind: offsetTo > standardOffset(timeZone, year) ? "DAYLIGHT" : "STANDARD",
		start: wallFromMs(instant + offsetFrom),
		offsetFrom: offsetFrom / 60_000,
		offsetTo: offsetTo / 60_000,
	};
	let name = shortName(timeZone, instant);
	if (name !== undefined) observance.name = name;
	return observance;
}

/**
 * A `VTIMEZONE` for an IANA zone covering a span: the transition in force when the span
 * starts, then one observance per offset change until it ends. A zone with no change in
 * the year before the span gets one observance at the span's start with equal offsets.
 *
 * @param tzid - An IANA zone name `Intl` knows, e.g. `"Europe/Madrid"`
 * @param span - The epoch milliseconds the calendar's date-times fall between
 * @returns The time zone, or why it cannot be built
 */
export function vtimezone(
	tzid: string,
	span: { from: number; to: number },
): Result<ICalendar.TimeZone, TimeZoneError> {
	if (!isIntlZone(tzid)) return failure(new TimeZoneError(`Intl does not know the zone ${tzid}`));
	if (!Number.isFinite(span.from) || !Number.isFinite(span.to) || span.to < span.from) {
		return failure(new TimeZoneError("the span must end at or after it starts"));
	}
	let before = transitions(tzid, span.from - LOOKBACK_MS, span.from).at(-1);
	let inside = transitions(tzid, span.from, span.to);
	let onsets = [before ?? span.from, ...inside];
	return success({ tzid, observances: onsets.map((instant) => observanceAt(tzid, instant)) });
}
