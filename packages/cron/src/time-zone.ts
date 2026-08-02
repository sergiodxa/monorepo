/**
 * The bridge between an instant and the wall clock a schedule is written against:
 * reading a zone's calendar fields off a timestamp, and turning wall-clock fields
 * back into the instant they name, including on the two days a year that are odd.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
 * Formatters keyed by time zone, including a `null` entry for zones the runtime
 * rejects, so an unknown zone is only diagnosed once per process.
 */
const FORMATTERS = new Map<string, Intl.DateTimeFormat | null>();

/** How far to probe on either side of a wall clock to learn the zone's offsets. */
const PROBE_MS = 86_400_000;

/**
 * A formatter that prints an instant's fields in `timeZone`, or `null` when the
 * runtime does not know the zone. The result is memoized because building one is
 * an order of magnitude more expensive than using it.
 *
 * @param timeZone - IANA time zone name, e.g. `"America/New_York"`.
 * @returns The cached formatter, or `null` for an unknown zone.
 */
function formatterFor(timeZone: string): Intl.DateTimeFormat | null {
	let cached = FORMATTERS.get(timeZone);
	if (cached !== undefined) return cached;

	let formatter: Intl.DateTimeFormat | null = null;
	try {
		formatter = new Intl.DateTimeFormat("en-US", {
			timeZone,
			calendar: "gregory",
			numberingSystem: "latn",
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	} catch {
		formatter = null;
	}

	FORMATTERS.set(timeZone, formatter);
	return formatter;
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
	if (!Number.isFinite(instant)) return null;
	let formatter = formatterFor(timeZone);
	if (formatter === null) return null;

	let fields: Record<string, number> = {};
	for (let part of formatter.formatToParts(new Date(instant))) {
		if (part.type === "literal") continue;
		fields[part.type] = Number(part.value);
	}

	let { year, month, day, hour, minute, second } = fields;
	if (
		year === undefined ||
		month === undefined ||
		day === undefined ||
		hour === undefined ||
		minute === undefined ||
		second === undefined
	) {
		return null;
	}

	return { year, month, day, hour, minute, second };
}

/**
 * The zone's UTC offset at an instant, in milliseconds, positive east of
 * Greenwich. Derived from the formatted fields rather than a name, so historical
 * and half-hour offsets are handled without a table.
 *
 * @param instant - Milliseconds since the epoch.
 * @param timeZone - IANA time zone name.
 * @returns The offset in milliseconds, or `null` for an unknown zone.
 *
 * @example
 * offsetAt(Date.UTC(2026, 5, 15), "America/New_York"); // -14_400_000
 */
export function offsetAt(instant: number, timeZone: string): number | null {
	let parts = zonedPartsOf(instant, timeZone);
	if (parts === null) return null;
	let asUtc = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second,
	);
	return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant a wall-clock time names in a zone, at zero seconds.
 *
 * Daylight saving makes this a choice twice a year, and both are resolved with the
 * offset in effect before the transition: an ambiguous wall time (the hour a clock
 * repeats) yields its first occurrence, so a schedule fires once instead of twice,
 * and a wall time that never happens (the hour a clock skips) yields the instant
 * that same offset points at, which lands just after the jump rather than being
 * dropped.
 *
 * @param wall - Wall-clock fields, seconds assumed zero.
 * @param timeZone - IANA time zone name.
 * @returns Milliseconds since the epoch, or `null` for an unknown zone.
 *
 * @example
 * instantFromWallClock({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, "America/New_York");
 */
export function instantFromWallClock(wall: WallClock, timeZone: string): number | null {
	let asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0);

	let earlyOffset = offsetAt(asUtc - PROBE_MS, timeZone);
	if (earlyOffset === null) return null;
	let earlyInstant = asUtc - earlyOffset;
	if (offsetAt(earlyInstant, timeZone) === earlyOffset) return earlyInstant;

	let lateOffset = offsetAt(asUtc + PROBE_MS, timeZone);
	if (lateOffset === null) return null;
	let lateInstant = asUtc - lateOffset;
	if (offsetAt(lateInstant, timeZone) === lateOffset) return lateInstant;

	return earlyInstant;
}
