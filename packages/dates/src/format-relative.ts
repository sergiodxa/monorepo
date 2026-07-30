/**
 * Relative time: "3 days ago", "in 2 hours", "yesterday". It picks the largest unit
 * the distance justifies and hands the wording to `Intl.RelativeTimeFormat`, so
 * pluralization and the past and future phrasings come from the platform.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Locale } from "./types";

import { relativeTimeFormatter } from "./intl-cache";

/**
 * The unit ladder, each rung holding how many of that unit make up the next one.
 * A month is the average Gregorian month and a year is measured in months, so
 * "13 months" reads as "1 year" rather than being reported in weeks.
 */
const DIVISIONS = [
	{ unit: "second", amount: 60 },
	{ unit: "minute", amount: 60 },
	{ unit: "hour", amount: 24 },
	{ unit: "day", amount: 7 },
	{ unit: "week", amount: 4.348_125 },
	{ unit: "month", amount: 12 },
	{ unit: "year", amount: Number.POSITIVE_INFINITY },
] as const satisfies readonly { unit: Intl.RelativeTimeFormatUnit; amount: number }[];

/** How a distance in time is worded, and what it is measured against. */
export interface FormatRelativeOptions {
	/** Locale, or preference list, to take the phrasing from. */
	locale: Locale;
	/** Instant to measure against; defaults to the current time. */
	now?: Date;
	/**
	 * Whether to always use a number. `"auto"`, the default, lets the locale say
	 * "yesterday" or "now" where it has a word for it; `"always"` forces "1 day ago".
	 */
	numeric?: Intl.RelativeTimeFormatNumeric;
	/** Length of the wording; defaults to `"long"`. */
	style?: Intl.RelativeTimeFormatStyle;
}

/**
 * Word the distance from now to an instant, in the largest unit that still reads as
 * a whole number of that unit. Future instants read as "in ..." and past ones as
 * "... ago", both phrased by the locale.
 *
 * The unit is chosen by rounding: 90 minutes reads as "in 2 hours", and a distance
 * that rounds up to a full unit carries into the next one, so nothing reads as
 * "in 60 seconds".
 *
 * @param date - Instant to describe.
 * @param options - Locale, the instant to measure against, and the wording.
 * @returns The localized relative phrase.
 *
 * @example
 * formatRelative(yesterday, { locale: "en-US" }); // "yesterday"
 * @example
 * formatRelative(soon, { locale: "en-US", now, numeric: "always" }); // "in 3 days"
 */
export function formatRelative(date: Date, options: FormatRelativeOptions): string {
	let formatter = relativeTimeFormatter(options.locale, {
		numeric: options.numeric ?? "auto",
		style: options.style ?? "long",
	});

	let now = options.now ?? new Date();
	let value = (date.getTime() - now.getTime()) / 1000;

	for (let index = 0; index < DIVISIONS.length; index++) {
		// The ladder is a literal tuple, so every index in range holds a division.
		let division = DIVISIONS[index] as (typeof DIVISIONS)[number];
		let rounded = Math.round(value);
		if (Math.abs(rounded) < division.amount || index === DIVISIONS.length - 1) {
			return formatter.format(rounded, division.unit);
		}
		value = value / division.amount;
	}

	return formatter.format(0, "second");
}
