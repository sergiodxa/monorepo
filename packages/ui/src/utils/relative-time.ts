/**
 * Formats a moment as the relative text, machine instant and absolute title a relative time
 * shows, through `Intl` alone. Kept framework-free so the server component and the browser
 * mixin that rewrites it in the viewer's zone produce the same strings from the same input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** How long a time stays relative before it reads as a date: seven days, in milliseconds. */
const RELATIVE_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;

/** Zone the server formats in when none is given, so every server renders the same text. */
const DEFAULT_TIME_ZONE = "UTC";

/** Text shown for a date that does not parse. */
const INVALID_TEXT = "—";

/** Units a relative time steps through, largest last, each with its length in milliseconds. */
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	["second", 1000],
	["minute", 60 * 1000],
	["hour", 60 * 60 * 1000],
	["day", 24 * 60 * 60 * 1000],
];

/**
 * Types for {@link formatRelativeTime}.
 */
export namespace RelativeTimeFormat {
	/** A moment as a `Date`, an ISO 8601 string or epoch milliseconds. */
	export type DateInput = Date | string | number;

	/** What a moment renders as, given a reference time, locale and zone. */
	export interface Formatted {
		/** The machine-readable instant for `<time datetime>`, empty when the input does not parse. */
		dateTime: string;
		/** The visible text: relative within a week, a medium date after it. */
		text: string;
		/** The absolute time in the formatting zone, then in UTC when the two differ, one per line. */
		title: string;
	}

	/** Options for {@link formatRelativeTime}. */
	export interface Options {
		/** The reference moment "ago" counts from. Defaults to the current time. */
		now?: DateInput;
		/** BCP 47 locale for every string. Defaults to the runtime's locale. */
		locale?: string;
		/** IANA zone for the date and the title's first line. Defaults to {@link DEFAULT_TIME_ZONE}. */
		timeZone?: string;
	}
}

/**
 * Formats `date` as a relative time shows it, for any part that needs the text without the
 * `<time>` element. Under a minute reads in seconds and "now" at zero, and future moments read "in 5m";
 * anything a week or more away reads as a medium date in `timeZone`.
 *
 * @param date The moment to format.
 * @param options Reference time, locale and zone.
 * @returns The `datetime` value, the visible text and the title.
 * @example formatRelativeTime("2026-11-01T08:00:00Z", { now: "2026-11-01T08:02:00Z", locale: "en" }).text // "2m ago"
 */
export function formatRelativeTime(
	date: RelativeTimeFormat.DateInput,
	options: RelativeTimeFormat.Options = {},
): RelativeTimeFormat.Formatted {
	let moment = new Date(date);
	if (Number.isNaN(moment.getTime())) return { dateTime: "", text: INVALID_TEXT, title: "" };

	let now = options.now === undefined ? new Date() : new Date(options.now);
	let timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
	let delta = moment.getTime() - now.getTime();

	return {
		dateTime: moment.toISOString(),
		text:
			Math.abs(delta) < RELATIVE_LIMIT_MS
				? relativeText(delta, options.locale)
				: new Intl.DateTimeFormat(options.locale, { dateStyle: "medium", timeZone }).format(moment),
		title: absoluteTitle(moment, options.locale, timeZone),
	};
}

/**
 * Picks the largest unit the distance fills at least once and truncates toward zero, so 59
 * minutes reads "59m" until the hour has actually passed.
 */
function relativeText(delta: number, locale: string | undefined): string {
	let format = new Intl.RelativeTimeFormat(locale, { style: "narrow", numeric: "auto" });
	let [unit, size] = UNITS[0]!;
	for (let [candidate, length] of UNITS) {
		if (Math.abs(delta) >= length) [unit, size] = [candidate, length];
	}
	return format.format(Math.trunc(delta / size) || 0, unit);
}

/**
 * The absolute time in `timeZone` with its zone named, then in UTC on a second line, which a
 * title shows as a two-line tooltip. A UTC zone gives the one line.
 */
function absoluteTitle(moment: Date, locale: string | undefined, timeZone: string): string {
	let options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "long" };
	let zoned = new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(moment);
	let utc = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(moment);
	return zoned === utc ? utc : `${zoned}\n${utc}`;
}
