/**
 * Returns a short, localized weekday name for a zero-based day index where 0 is Monday.
 * It anchors on a known Monday and uses `Intl.DateTimeFormat` with an optional time zone
 * to format the label per locale. The heatmap and calendars use it to render weekday
 * headers in the user's language.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

const BASE_DATE = new Date(Date.UTC(2025, 0, 6));
const MILLISECONDS_PER_DAY = 86400000;

export default function getDayLabel(locale: string, dayOfWeek: number, timeZone = "UTC"): string {
	return new Intl.DateTimeFormat(locale, {
		weekday: "short",
		timeZone,
	}).format(new Date(BASE_DATE.getTime() + dayOfWeek * MILLISECONDS_PER_DAY));
}
