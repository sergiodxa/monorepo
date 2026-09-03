/**
 * Duration formatting: a length of time as words, "1 hour, 30 minutes". Each
 * component is an `Intl.NumberFormat` unit and the components are joined by
 * `Intl.ListFormat`, so both the unit names and the joining come from the locale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";

import { toMs } from "@sdxc/duration";

import type { Locale } from "./types";

import { listFormatter, numberFormatter } from "./intl-cache";

/**
 * The units a length is broken into, largest first, each with its exact span. Weeks,
 * months and years are absent because they either have no fixed length or read worse
 * than the day count they replace.
 */
const DURATION_UNITS = [
	{ unit: "day", ms: 86_400_000 },
	{ unit: "hour", ms: 3_600_000 },
	{ unit: "minute", ms: 60_000 },
	{ unit: "second", ms: 1000 },
	{ unit: "millisecond", ms: 1 },
] as const;

/** How a length of time is worded. */
export interface FormatDurationOptions {
	/** Locale, or preference list, to take unit names and joining from. */
	locale: Locale;
	/** Length of the unit names and of the joining; defaults to `"long"`. */
	style?: "long" | "short" | "narrow";
	/**
	 * How many components to keep, largest first, so a long length can read as
	 * "1 day" instead of naming every unit down to the millisecond. All non-zero
	 * components are kept by default.
	 */
	maxUnits?: number;
}

/**
 * Words a length of time the way a person would read it aloud. Zero-valued
 * components are skipped, sub-second lengths read in milliseconds, and a
 * negative length signs only its largest component.
 *
 * @param input - A duration string, or a number of milliseconds.
 * @param options - Locale, wording length, and how many components to keep.
 * @returns The localized length. An all-zero length reads as zero seconds, a
 * non-finite total — only possible when the duration type is bypassed —
 * collapses to one value in seconds, and a single component is joined the same
 * way several are.
 *
 * @example
 * formatDuration("90 minutes", { locale: "en-US" }); // "1 hour, 30 minutes"
 * @example
 * formatDuration("90 minutes", { locale: "en-US", style: "short" }); // "1 hr, 30 min"
 * @example
 * formatDuration(5_400_000, { locale: "en-US", maxUnits: 1 }); // "1 hour"
 */
export function formatDuration(input: DurationInput, options: FormatDurationOptions): string {
	let style = options.style ?? "long";
	let total = toMs(input);

	/**
	 * Render one component with its unit, which is what `Intl` needs a separate
	 * formatter for; the cache keeps that from costing anything per component.
	 */
	let render = (value: number, unit: string) =>
		numberFormatter(options.locale, { style: "unit", unit, unitDisplay: style }).format(value);

	if (!Number.isFinite(total)) return render(total, "second");

	let remaining = Math.abs(Math.trunc(total));
	let components: string[] = [];
	let sign = total < 0 ? -1 : 1;

	for (let { unit, ms } of DURATION_UNITS) {
		let value = Math.floor(remaining / ms);
		remaining -= value * ms;
		if (value === 0) continue;
		if (options.maxUnits !== undefined && components.length >= options.maxUnits) break;
		components.push(render(components.length === 0 ? sign * value : value, unit));
	}

	if (components.length === 0) components.push(render(0, "second"));

	return listFormatter(options.locale, { type: "unit", style }).format(components);
}
