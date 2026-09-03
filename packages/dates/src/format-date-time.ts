/**
 * The `Intl.DateTimeFormat` wrappers: dates, times, both together, and a range.
 * They add nothing to `Intl` but required arguments and a cached instance, so month
 * names, ordering and separators all come from the platform's locale data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DateStyle, Locale, TimeStyle, TimeZone } from "./types.js";

import { dateTimeFormatter } from "./intl-cache.js";

/** How and where a date is rendered. Both the locale and the zone are required. */
export interface FormatDateOptions {
	/** Locale, or preference list, to take month and weekday names from. */
	locale: Locale;
	/** IANA zone whose calendar day the instant is rendered as. */
	timeZone: TimeZone;
	/** Length of the rendered date; defaults to `"medium"`. */
	dateStyle?: DateStyle;
}

/** How and where a time of day is rendered. */
export interface FormatTimeOptions {
	/** Locale, or preference list, to take clock conventions from. */
	locale: Locale;
	/** IANA zone whose clock the instant is rendered as. */
	timeZone: TimeZone;
	/** Length of the rendered time; defaults to `"short"`. */
	timeStyle?: TimeStyle;
}

/** How and where a date and time together are rendered. */
export interface FormatDateTimeOptions {
	/** Locale, or preference list, to render in. */
	locale: Locale;
	/** IANA zone whose clock and calendar the instant is rendered as. */
	timeZone: TimeZone;
	/** Length of the date half; defaults to `"medium"`. */
	dateStyle?: DateStyle;
	/** Length of the time half; defaults to `"short"`. */
	timeStyle?: TimeStyle;
}

/** How and where a range between two instants is rendered. */
export interface FormatRangeOptions {
	/** Locale, or preference list, to render in. */
	locale: Locale;
	/** IANA zone whose clock and calendar both ends are rendered as. */
	timeZone: TimeZone;
	/** Length of the date half; defaults to `"medium"`. */
	dateStyle?: DateStyle;
	/** Length of the time half; omitted entirely when left out. */
	timeStyle?: TimeStyle;
}

/**
 * Render the calendar date an instant falls on, in a zone.
 *
 * @param date - Instant to render.
 * @param options - Locale, zone, and how long the date should read.
 * @returns The localized date.
 *
 * @example
 * formatDate(date, { locale: "en-US", timeZone: "UTC" }); // "Jul 29, 2026"
 * @example
 * formatDate(date, { locale: "es-AR", timeZone: "UTC", dateStyle: "long" });
 */
export function formatDate(date: Date, options: FormatDateOptions): string {
	return dateTimeFormatter(options.locale, {
		timeZone: options.timeZone,
		dateStyle: options.dateStyle ?? "medium",
	}).format(date);
}

/**
 * Render the time of day an instant reads as on a clock in a zone.
 *
 * @param date - Instant to render.
 * @param options - Locale, zone, and how long the time should read.
 * @returns The localized time of day.
 *
 * @example
 * formatTime(date, { locale: "en-US", timeZone: "America/New_York" }); // "10:00 AM"
 */
export function formatTime(date: Date, options: FormatTimeOptions): string {
	return dateTimeFormatter(options.locale, {
		timeZone: options.timeZone,
		timeStyle: options.timeStyle ?? "short",
	}).format(date);
}

/**
 * Render an instant as a date and a time of day, joined the way the locale joins
 * them rather than with a separator chosen here.
 *
 * @param date - Instant to render.
 * @param options - Locale, zone, and how long each half should read.
 * @returns The localized date and time.
 *
 * @example
 * formatDateTime(date, { locale: "en-US", timeZone: "UTC" }); // "Jul 29, 2026, 10:00 AM"
 */
export function formatDateTime(date: Date, options: FormatDateTimeOptions): string {
	return dateTimeFormatter(options.locale, {
		timeZone: options.timeZone,
		dateStyle: options.dateStyle ?? "medium",
		timeStyle: options.timeStyle ?? "short",
	}).format(date);
}

/**
 * Render the span between two instants as one range, collapsing whatever the
 * two ends share via `Intl`'s own elision. The time half stays out unless a
 * `timeStyle` is given, since adding times to a day range reads poorly.
 *
 * @param start - First instant of the span.
 * @param end - Last instant of the span.
 * @param options - Locale, zone, and how long each half should read.
 * @returns The localized range.
 *
 * @example
 * formatRange(start, end, { locale: "en-US", timeZone: "UTC" }); // "Jul 29 – 31, 2026"
 */
export function formatRange(start: Date, end: Date, options: FormatRangeOptions): string {
	return dateTimeFormatter(options.locale, {
		timeZone: options.timeZone,
		dateStyle: options.dateStyle ?? "medium",
		timeStyle: options.timeStyle,
	}).formatRange(start, end);
}
