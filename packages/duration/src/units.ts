/**
 * The unit tables: every unit spelling a duration may use, long forms and short
 * aliases, mapped to the fixed number of milliseconds it covers. The unit types
 * are derived from the tables, so a unit is added or removed in one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Milliseconds in one second, the divisor every seconds-based API needs. */
export const SECOND_MS = 1000;

const MINUTE_MS = 60 * SECOND_MS;

const HOUR_MS = 60 * MINUTE_MS;

/** Milliseconds in one day, kept as a fixed 24-hour span. */
const DAY_MS = 24 * HOUR_MS;

const WEEK_MS = 7 * DAY_MS;

/**
 * Long unit spellings, singular and plural, in milliseconds, covering every
 * fixed-length span from a millisecond through a week. Calendar-based units
 * such as months and years belong in a date-aware API instead.
 */
export const LONG_UNIT_MS = {
	millisecond: 1,
	milliseconds: 1,
	second: SECOND_MS,
	seconds: SECOND_MS,
	minute: MINUTE_MS,
	minutes: MINUTE_MS,
	hour: HOUR_MS,
	hours: HOUR_MS,
	day: DAY_MS,
	days: DAY_MS,
	week: WEEK_MS,
	weeks: WEEK_MS,
} as const;

/**
 * Short unit aliases in milliseconds, each covering the same span as its long
 * spelling. The list stays closed: every entry multiplies the size of the
 * `DurationString` union.
 */
export const SHORT_UNIT_MS = {
	ms: 1,
	s: SECOND_MS,
	m: MINUTE_MS,
	h: HOUR_MS,
	d: DAY_MS,
	w: WEEK_MS,
} as const;

/** A unit spelled out after a single space, as in `"5 minutes"`. */
export type DurationUnit = keyof typeof LONG_UNIT_MS;

/** A unit abbreviated with no space, as in `"30s"`. */
export type DurationUnitShort = keyof typeof SHORT_UNIT_MS;

/** The long table widened so arbitrary runtime text can be looked up in it. */
const LONG_UNIT_LOOKUP: Record<string, number | undefined> = LONG_UNIT_MS;

/** The short table widened so arbitrary runtime text can be looked up in it. */
const SHORT_UNIT_LOOKUP: Record<string, number | undefined> = SHORT_UNIT_MS;

/**
 * Milliseconds covered by one of a long unit spelling, resolving only the
 * table's own keys so a lookup like `"toString"` stays scoped to the table.
 *
 * @param unit - Candidate spelling, e.g. `"minutes"`.
 * @returns The span in milliseconds, or `undefined` when the text is not a unit
 * this package accepts, so callers report a failure instead of guessing.
 *
 * @example
 * longUnitToMs("minutes"); // 60000
 * @example
 * longUnitToMs("minuts"); // undefined
 */
export function longUnitToMs(unit: string): number | undefined {
	if (!Object.hasOwn(LONG_UNIT_MS, unit)) return undefined;
	return LONG_UNIT_LOOKUP[unit];
}

/**
 * Milliseconds covered by one of a short unit alias, resolving the table's own
 * keys only.
 *
 * @param unit - Candidate alias, e.g. `"ms"`.
 * @returns The span in milliseconds, or `undefined` when the text is not an
 * alias this package accepts.
 *
 * @example
 * shortUnitToMs("h"); // 3600000
 * @example
 * shortUnitToMs("y"); // undefined
 */
export function shortUnitToMs(unit: string): number | undefined {
	if (!Object.hasOwn(SHORT_UNIT_MS, unit)) return undefined;
	return SHORT_UNIT_LOOKUP[unit];
}
