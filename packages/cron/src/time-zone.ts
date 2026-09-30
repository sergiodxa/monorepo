/**
 * The bridge between an instant and the wall clock a schedule is written against,
 * built on `@sdxc/dates/zone`: it answers `null` for an unknown zone or a
 * non-finite instant, so an occurrence query reports a stale zone name as data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { instantFromParts, isValidTimeZone, offsetMsAt, zonedParts } from "@sdxc/dates/zone";

/** Calendar fields a schedule matches on, as they read on a wall clock. */
export interface WallClock {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
}

/** A wall clock plus the seconds a formatted instant also carries. */
export interface ZonedParts extends WallClock {
	second: number;
}

/**
 * Read an instant's calendar fields in a zone.
 *
 * @param instant - Milliseconds since the epoch.
 * @param timeZone - IANA time zone name.
 * @returns The zone's wall-clock fields, or `null` when the zone is unknown or the
 * instant is not a finite timestamp, so callers surface that instead of guessing.
 *
 * @example
 * zonedPartsOf(Date.UTC(2026, 2, 8, 7, 30), "America/New_York"); // 03:30 on Mar 8
 */
export function zonedPartsOf(instant: number, timeZone: string): ZonedParts | null {
	if (!Number.isFinite(instant) || !isValidTimeZone(timeZone)) return null;
	let { year, month, day, hour, minute, second } = zonedParts(instant, timeZone);
	return { year, month, day, hour, minute, second };
}

/**
 * The zone's UTC offset at an instant, in milliseconds, positive east of
 * Greenwich. Derived from the formatted fields rather than a name, so historical
 * and half-hour offsets are handled without a table.
 *
 * @param instant - Milliseconds since the epoch.
 * @param timeZone - IANA time zone name.
 * @returns The offset in milliseconds, or `null` for an unknown zone or a non-finite instant.
 *
 * @example
 * offsetAt(Date.UTC(2026, 5, 15), "America/New_York"); // -14_400_000
 */
export function offsetAt(instant: number, timeZone: string): number | null {
	if (!Number.isFinite(instant) || !isValidTimeZone(timeZone)) return null;
	return offsetMsAt(instant, timeZone);
}

/**
 * The instant a wall-clock time names in a zone, at zero seconds: an ambiguous time
 * (the hour a clock repeats) resolves to its first occurrence, and a skipped time is
 * read with the offset before the jump, landing as far past it as it was into it.
 *
 * @param wall - Wall-clock fields, seconds assumed zero.
 * @param timeZone - IANA time zone name.
 * @returns Milliseconds since the epoch, or `null` for an unknown zone or non-finite fields.
 *
 * @example
 * instantFromWallClock({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, "America/New_York");
 */
export function instantFromWallClock(wall: WallClock, timeZone: string): number | null {
	if (!isValidTimeZone(timeZone)) return null;
	let instant = instantFromParts({ ...wall, second: 0, millisecond: 0 }, timeZone);
	return Number.isFinite(instant) ? instant : null;
}
