/**
 * Calendar days as `YYYY-MM-DD` keys, counted in UTC so a stay's nights are the same count on
 * every server and in every visitor's zone. Check-in and check-out are days, never instants,
 * which is how a stays app quotes them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A day key's shape; anything else reads as no day at all. */
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Milliseconds in one day, the step every day key moves by. */
const DAY_MS = 86_400_000;

/**
 * Reads a day key, rejecting malformed and impossible dates such as `2026-02-30`.
 *
 * @param key What a URL or form carried.
 * @returns The key back when it names a real day, otherwise `undefined`.
 */
export function readDay(key: string | null | undefined): string | undefined {
	if (key === null || key === undefined || !DAY_KEY.test(key)) return undefined;
	let date = new Date(`${key}T00:00:00Z`);
	return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== key ? undefined : key;
}

/**
 * The day `count` days after `key`, or before it for a negative count.
 *
 * @example addDays("2026-12-30", 3) // "2027-01-02"
 */
export function addDays(key: string, count: number): string {
	return new Date(Date.parse(`${key}T00:00:00Z`) + count * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Nights between check-in and check-out: `0` for the same day, negative when they are reversed.
 *
 * @example nightsBetween("2026-12-01", "2026-12-05") // 4
 */
export function nightsBetween(start: string, end: string): number {
	return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS);
}

/** The weekday of a day key, `0` for Sunday, as `Date.getUTCDay` counts. */
export function weekday(key: string): number {
	return new Date(`${key}T00:00:00Z`).getUTCDay();
}

/**
 * Today's key in UTC, the demo's one clock: every availability calendar starts from it.
 *
 * @param now The instant to read; the current one by default.
 */
export function today(now: Date = new Date()): string {
	return now.toISOString().slice(0, 10);
}

/**
 * The month a day falls in, as the `YYYY-MM` key a calendar's first month takes.
 *
 * @example monthOf("2026-12-24") // "2026-12"
 */
export function monthOf(key: string): string {
	return key.slice(0, 7);
}

/**
 * A day for a reader: `Dec 4` within the year of `today`, `Dec 4, 2027` otherwise, so a
 * date range reads short when it can.
 */
export function formatDay(
	key: string,
	options: { year?: boolean; weekday?: boolean } = {},
): string {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: "UTC",
		month: "short",
		day: "numeric",
		year: options.year === true ? "numeric" : undefined,
		weekday: options.weekday === true ? "short" : undefined,
	}).format(new Date(`${key}T00:00:00Z`));
}

/**
 * A stay's dates for a reader, collapsing a shared month: `Dec 4 – 9`, `Dec 29 – Jan 3`.
 *
 * @param start Check-in.
 * @param end Check-out.
 */
export function formatRange(start: string, end: string): string {
	let first = formatDay(start);
	if (start.slice(0, 7) === end.slice(0, 7)) return `${first} – ${Number(end.slice(8))}`;
	return `${first} – ${formatDay(end)}`;
}
