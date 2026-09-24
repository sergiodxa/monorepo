/**
 * Resolves a DATE-TIME's zone into a function from wall clocks to instants: UTC as is, a
 * `TZID` through the calendar's `VTIMEZONE` before `Intl`, floating times in a named zone,
 * with RFC 5545 §3.3.5's rule for DST gaps and repeated hours.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { DAY_MS, instantFromParts } from "@sdxc/dates/zone";
import { isSuccess, wrap } from "@sdxc/result";

import type { ICalendar } from "../types.js";

import { expand, wallFromMs, wallMs } from "./expand.js";

/** Turns wall milliseconds into the instant they name in some zone. */
export type WallResolver = (wall: number) => number;

/** One observance onset: the instant it begins and the offset in force from then on. */
interface Onset {
	instant: number;
	offset: number;
}

/** The onsets of a `VTIMEZONE`, computed up to a wall-clock horizon and extended on demand. */
interface ZoneState {
	onsets: Onset[];
	coveredUntil: number;
	initialOffset: number;
}

/** Onsets per `VTIMEZONE` object, so resolving many date-times expands each rule once. */
const ZONE_STATES = new WeakMap<ICalendar.TimeZone, ZoneState>();

/** Whether `Intl` knows a zone name, remembered per name. */
const KNOWN_ZONES = new Map<string, boolean>();

/**
 * Whether `Intl` accepts a zone name.
 *
 * @param timeZone - A zone name
 * @returns `true` for a name `Intl.DateTimeFormat` accepts
 */
export function isIntlZone(timeZone: string): boolean {
	let known = KNOWN_ZONES.get(timeZone);
	if (known === undefined) {
		known = isSuccess(wrap(() => new Intl.DateTimeFormat("en-US", { timeZone })));
		KNOWN_ZONES.set(timeZone, known);
	}
	return known;
}

/**
 * A resolver for an IANA zone through `Intl`.
 *
 * @param timeZone - A zone `Intl` knows
 * @returns The resolver
 */
function intlResolver(timeZone: string): WallResolver {
	return (wall) => instantFromParts({ ...wallFromMs(wall), millisecond: 0 }, timeZone);
}

/**
 * Every onset of a `VTIMEZONE` whose local time falls before a horizon: each observance's
 * `DTSTART`, its `RRULE` instances up to `UNTIL`, and its `RDATE`s, all read with the
 * observance's `TZOFFSETFROM`. An observance whose rule cannot expand keeps its `DTSTART`.
 *
 * @param zone - The time zone
 * @param horizon - Wall milliseconds to compute up to
 * @returns The onsets, by instant
 */
function computeOnsets(zone: ICalendar.TimeZone, horizon: number): Onset[] {
	let onsets: Onset[] = [];
	for (let observance of zone.observances) {
		let from = observance.offsetFrom * 60_000;
		let offset = observance.offsetTo * 60_000;
		let toInstant = (wall: number) => wall - from;
		onsets.push({ instant: toInstant(wallMs(observance.start)), offset });
		for (let date of observance.recurrenceDates ?? []) {
			onsets.push({ instant: toInstant(wallMs(date)), offset });
		}
		let rule = observance.recurrence;
		if (!rule) continue;
		let until: number | null = null;
		if (rule.until?.type === "date")
			until = toInstant(wallMs({ ...rule.until, hour: 23, minute: 59, second: 59 }));
		else if (rule.until)
			until =
				rule.until.zone === "utc" ? wallMs(rule.until.wall) : toInstant(wallMs(rule.until.wall));
		expand(rule, observance.start, { horizon, toInstant, until }, (_, instant) => {
			onsets.push({ instant, offset });
			return true;
		});
	}
	return onsets.sort((a, b) => a.instant - b.instant);
}

/**
 * The offset a `VTIMEZONE` puts in force at an instant: the one from the latest onset at or
 * before it, or the earliest observance's `TZOFFSETFROM` before any onset.
 *
 * @param zone - The time zone
 * @param instant - Milliseconds since the epoch
 * @returns The offset in milliseconds to add to UTC
 */
function offsetAt(zone: ICalendar.TimeZone, instant: number): number {
	let state = ZONE_STATES.get(zone);
	if (!state || instant + 2 * DAY_MS > state.coveredUntil) {
		let coveredUntil = Math.max(instant, state?.coveredUntil ?? 0) + 400 * DAY_MS;
		let earliest = [...zone.observances].sort(
			(a, b) => wallMs(a.start) - a.offsetFrom * 60_000 - (wallMs(b.start) - b.offsetFrom * 60_000),
		)[0];
		state = {
			onsets: computeOnsets(zone, coveredUntil),
			coveredUntil,
			initialOffset: (earliest?.offsetFrom ?? 0) * 60_000,
		};
		ZONE_STATES.set(zone, state);
	}
	let { onsets } = state;
	let low = 0;
	let high = onsets.length - 1;
	let found = -1;
	while (low <= high) {
		let middle = (low + high) >> 1;
		if ((onsets[middle]?.instant ?? 0) <= instant) [found, low] = [middle, middle + 1];
		else high = middle - 1;
	}
	return found === -1 ? state.initialOffset : (onsets[found]?.offset ?? 0);
}

/**
 * A resolver for a parsed `VTIMEZONE`. A wall clock valid under two offsets takes the
 * earlier instant, and one valid under none (a gap) is read with the offset before it.
 *
 * @param zone - The time zone
 * @returns The resolver
 */
function vtimezoneResolver(zone: ICalendar.TimeZone): WallResolver {
	return (wall) => {
		let before = offsetAt(zone, wall - DAY_MS);
		let after = offsetAt(zone, wall + DAY_MS);
		let valid = [...new Set([before, after])]
			.filter((offset) => offsetAt(zone, wall - offset) === offset)
			.map((offset) => wall - offset);
		return valid.length > 0 ? Math.min(...valid) : wall - before;
	};
}

/** Where a resolver looks for zones beyond UTC. */
export interface ResolveContext {
	/** Its `VTIMEZONE`s define `TZID`s, ahead of `Intl`. */
	calendar?: ICalendar.Calendar;
	/** The IANA zone floating times and dates are read in; without one they do not resolve. */
	timeZone?: string;
}

/**
 * A resolver for a DATE-TIME's zone, or for a DATE read as local midnight.
 *
 * @param value - The value whose zone to resolve
 * @param context - The calendar and the zone for floating values
 * @returns The resolver, or `null` when the zone resolves through nothing available
 */
export function resolverFor(
	value: ICalendar.DateValue,
	context: ResolveContext,
): WallResolver | null {
	let zone = value.type === "date" ? "floating" : value.zone;
	if (zone === "utc") return (wall) => wall;
	if (zone === "floating") {
		if (!context.timeZone || !isIntlZone(context.timeZone)) return null;
		return intlResolver(context.timeZone);
	}
	let { tzid } = zone;
	let defined = context.calendar?.timeZones.find((candidate) => candidate.tzid === tzid);
	if (defined && defined.observances.length > 0) return vtimezoneResolver(defined);
	return isIntlZone(tzid) ? intlResolver(tzid) : null;
}

/**
 * The wall clock a DATE or DATE-TIME shows; a DATE is its midnight.
 *
 * @param value - The value
 * @returns Its wall clock
 */
export function wallOf(value: ICalendar.DateValue): ICalendar.WallClock {
	if (value.type === "date-time") return value.wall;
	return { year: value.year, month: value.month, day: value.day, hour: 0, minute: 0, second: 0 };
}
