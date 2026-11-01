/**
 * Formats when content was last edited for a save status line: relative ("2m ago")
 * while recent and a date with a time once it is older, through the platform's `Intl`
 * APIs so every locale reads it in its own words.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Units the relative edit time steps through, each with its length in seconds. */
const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
	["hour", 3600],
	["minute", 60],
];

/**
 * Formats how long ago `at` was: relative within `decayMs`, a date and time after.
 *
 * @param at When the content was edited.
 * @param now The moment to measure from.
 * @param decayMs Age at which the text becomes a timestamp.
 * @param locale Locale to format in; the runtime's when omitted.
 * @returns The time text an "Edited {time}" label embeds.
 * @example formatEditedTime(updatedAt, new Date(), 86_400_000, "en") // "2m ago"
 */
export function formatEditedTime(at: Date, now: Date, decayMs: number, locale?: string): string {
	let elapsed = now.getTime() - at.getTime();
	if (elapsed >= decayMs) {
		return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(at);
	}
	let seconds = Math.max(0, Math.round(elapsed / 1000));
	let format = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });
	let unit = UNITS.find(([, length]) => seconds >= length);
	if (unit) return format.format(-Math.floor(seconds / unit[1]), unit[0]);
	return format.format(-seconds, "second");
}
