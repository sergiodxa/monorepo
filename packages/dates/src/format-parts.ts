/**
 * The escape hatch for layouts `Intl` will not produce on its own, plus the
 * standalone weekday name a grid header needs. Callers compose parts themselves,
 * keeping layout logic outside this package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Locale, TimeZone, Weekday } from "./types.js";

import { dateTimeFormatter } from "./intl-cache.js";
import { DAY_MS } from "./zone.js";

/**
 * A Sunday at UTC midnight, used as the anchor whose weekday name is read. Any
 * Sunday works; this one is arbitrary and never leaves the module.
 */
const WEEKDAY_ANCHOR_MS = Date.UTC(2026, 0, 4);

/**
 * Which fields to break an instant into, on top of the required locale and zone.
 * Any `Intl.DateTimeFormat` option is accepted; with none, `Intl` falls back to a
 * numeric year, month and day, so name the fields the layout actually needs.
 */
export interface FormatPartsOptions extends Omit<Intl.DateTimeFormatOptions, "timeZone"> {
	/** Locale, or preference list, to take names and numbering from. */
	locale: Locale;
	/** IANA zone whose clock and calendar the instant is broken down in. */
	timeZone: TimeZone;
}

/** How long a standalone weekday name reads. */
export interface FormatWeekdayOptions {
	/** Locale, or preference list, to take the weekday name from. */
	locale: Locale;
	/** Length of the name; defaults to `"short"`. */
	style?: "long" | "short" | "narrow";
}

/**
 * Break an instant into its localized pieces, each tagged with what it is, so a
 * caller can lay them out in an order or markup `Intl` cannot express — a stacked
 * date cell, or a month name in its own element.
 *
 * @param date - Instant to break down.
 * @param options - Locale, zone, and which fields to include.
 * @returns The parts in the locale's own order, literals included.
 *
 * @example
 * formatParts(date, { locale: "en-US", timeZone: "UTC", month: "long", day: "numeric" });
 */
export function formatParts(date: Date, options: FormatPartsOptions): Intl.DateTimeFormatPart[] {
	let { locale, ...rest } = options;
	return dateTimeFormatter(locale, rest).formatToParts(date);
}

/**
 * The localized name of a weekday on its own, the label a day grid puts above its
 * columns. The index follows `Date#getDay` and `weekStartsOn`, so `0` is always
 * Sunday, independent of time zone.
 *
 * @param weekday - Weekday index, `0` Sunday through `6` Saturday.
 * @param options - Locale, and how long the name should read.
 * @returns The localized weekday name.
 *
 * @example
 * formatWeekday(1, { locale: "en-US" }); // "Mon"
 * @example
 * formatWeekday(0, { locale: "es-AR", style: "long" }); // "domingo"
 */
export function formatWeekday(weekday: Weekday, options: FormatWeekdayOptions): string {
	return dateTimeFormatter(options.locale, {
		timeZone: "UTC",
		weekday: options.style ?? "short",
	}).format(new Date(WEEKDAY_ANCHOR_MS + weekday * DAY_MS));
}
