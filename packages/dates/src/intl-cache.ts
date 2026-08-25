/**
 * Memoized `Intl` constructors. Every formatter in this package goes through
 * here because building an `Intl.DateTimeFormat` costs orders of magnitude more
 * than using one, and view code formats the same shape thousands of times.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Locale } from "./types";

/** Cached date and time formatters, keyed by locale and options. */
const DATE_TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

/** Cached relative time formatters, keyed by locale and options. */
const RELATIVE_TIME_FORMATTERS = new Map<string, Intl.RelativeTimeFormat>();

/** Cached number formatters, keyed by locale and options. */
const NUMBER_FORMATTERS = new Map<string, Intl.NumberFormat>();

/** Cached list formatters, keyed by locale and options. */
const LIST_FORMATTERS = new Map<string, Intl.ListFormat>();

/**
 * Build the cache key for a locale and options pair. Keys are sorted and
 * `undefined` values dropped so two call sites that describe the same format
 * in a different property order share one instance.
 *
 * @param locale - Locale or preference list the formatter was asked for.
 * @param options - The `Intl` options object, whose values are all primitives.
 * @returns A stable string identifying that exact formatter configuration.
 */
function cacheKey(locale: Locale, options: object): string {
	let locales = typeof locale === "string" ? locale : locale.join(",");
	let entries = Object.entries(options)
		.filter(([, value]) => value !== undefined)
		.sort(([left], [right]) => (left < right ? -1 : 1))
		.map(([name, value]) => `${name}=${String(value)}`);
	return `${locales}|${entries.join("&")}`;
}

/**
 * An `Intl.DateTimeFormat` for this locale and these options, built once.
 *
 * @param locale - Locale or preference list to format in.
 * @param options - Any `Intl.DateTimeFormat` options, including the time zone.
 * @returns The shared formatter instance for that configuration.
 *
 * @example
 * dateTimeFormatter("en-US", { timeZone: "UTC", dateStyle: "medium" }).format(date);
 */
export function dateTimeFormatter(
	locale: Locale,
	options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
	let key = cacheKey(locale, options);
	let cached = DATE_TIME_FORMATTERS.get(key);
	if (cached) return cached;
	let formatter = new Intl.DateTimeFormat(locale, options);
	DATE_TIME_FORMATTERS.set(key, formatter);
	return formatter;
}

/**
 * An `Intl.RelativeTimeFormat` for this locale and these options, built once.
 *
 * @param locale - Locale or preference list to format in.
 * @param options - Any `Intl.RelativeTimeFormat` options.
 * @returns The shared formatter instance for that configuration.
 *
 * @example
 * relativeTimeFormatter("en-US", { numeric: "auto" }).format(-1, "day"); // "yesterday"
 */
export function relativeTimeFormatter(
	locale: Locale,
	options: Intl.RelativeTimeFormatOptions,
): Intl.RelativeTimeFormat {
	let key = cacheKey(locale, options);
	let cached = RELATIVE_TIME_FORMATTERS.get(key);
	if (cached) return cached;
	let formatter = new Intl.RelativeTimeFormat(locale, options);
	RELATIVE_TIME_FORMATTERS.set(key, formatter);
	return formatter;
}

/**
 * An `Intl.NumberFormat` for this locale and these options, built once. Duration
 * rendering builds one per unit, so caching keeps a multi-unit length cheap.
 *
 * @param locale - Locale or preference list to format in.
 * @param options - Any `Intl.NumberFormat` options, including unit style.
 * @returns The shared formatter instance for that configuration.
 *
 * @example
 * numberFormatter("en-US", { style: "unit", unit: "hour" }).format(2); // "2 hr"
 */
export function numberFormatter(
	locale: Locale,
	options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
	let key = cacheKey(locale, options);
	let cached = NUMBER_FORMATTERS.get(key);
	if (cached) return cached;
	let formatter = new Intl.NumberFormat(locale, options);
	NUMBER_FORMATTERS.set(key, formatter);
	return formatter;
}

/**
 * An `Intl.ListFormat` for this locale and these options, built once.
 *
 * @param locale - Locale or preference list to format in.
 * @param options - Any `Intl.ListFormat` options.
 * @returns The shared formatter instance for that configuration.
 *
 * @example
 * listFormatter("en-US", { type: "unit" }).format(["1 hour", "30 minutes"]);
 */
export function listFormatter(locale: Locale, options: Intl.ListFormatOptions): Intl.ListFormat {
	let key = cacheKey(locale, options);
	let cached = LIST_FORMATTERS.get(key);
	if (cached) return cached;
	let formatter = new Intl.ListFormat(locale, options);
	LIST_FORMATTERS.set(key, formatter);
	return formatter;
}
