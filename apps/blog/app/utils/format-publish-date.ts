/**
 * Publish-date formatting utility for the blog app. Exposes formatPublishDate,
 * which returns either a locale-aware absolute date/time for dates 24h+ away or a
 * relative-time string (via Intl.RelativeTimeFormat) for nearer dates, flagging
 * which form it chose. It exists to render human-friendly, localized publish and
 * scheduled-publish timestamps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

interface FormatPublishDateOptions {
	locale: string;
	timeZone?: string;
}

interface FormatPublishDateResult {
	/** The formatted date or relative time string */
	formatted: string;
	/** Whether this is a relative time (< 24 hours) */
	isRelative: boolean;
}

/**
 * Formats a publish date for display.
 * - If less than 24 hours away, returns relative time (e.g., "in 3 hours", "in 45 minutes")
 * - Otherwise, returns full date and time
 */
export function formatPublishDate(
	publishedAt: Date | string,
	options: FormatPublishDateOptions,
): FormatPublishDateResult {
	let date = typeof publishedAt === "string" ? new Date(publishedAt) : publishedAt;
	let now = new Date();
	let diff = date.getTime() - now.getTime();

	// If more than 24 hours away, show full date/time
	if (diff >= ONE_DAY_MS) {
		return {
			formatted: date.toLocaleString(options.locale, {
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
				timeZone: options.timeZone ?? "UTC",
			}),
			isRelative: false,
		};
	}

	// Use Intl.RelativeTimeFormat for relative time
	let rtf = new Intl.RelativeTimeFormat(options.locale, { numeric: "auto" });

	let hours = Math.ceil(diff / ONE_HOUR_MS);
	if (hours >= 1) {
		return { formatted: rtf.format(hours, "hour"), isRelative: true };
	}

	let minutes = Math.ceil(diff / (60 * 1000));
	if (minutes >= 1) {
		return { formatted: rtf.format(minutes, "minute"), isRelative: true };
	}

	// Less than a minute - show "in less than a minute" or similar
	return { formatted: rtf.format(1, "minute"), isRelative: true };
}
