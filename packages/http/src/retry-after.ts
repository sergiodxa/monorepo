/**
 * The RFC 9110 `Retry-After` field read as a wait in milliseconds, from either of its
 * forms: delay-seconds or an HTTP-date, the date in any of the three spellings a
 * recipient must accept, so every client backs off by the same reading of the header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** RFC 9110 `delay-seconds`: one or more digits, nothing else. */
const DELAY_SECONDS = /^\d+$/;

/** The preferred spelling: `Sun, 06 Nov 1994 08:49:37 GMT`. */
const IMF_FIXDATE =
	/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) ([A-Z][a-z]{2}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/;

/** The obsolete RFC 850 spelling, with a two-digit year: `Sunday, 06-Nov-94 08:49:37 GMT`. */
const RFC_850_DATE =
	/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d{2})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT$/;

/** The obsolete asctime spelling, always UTC: `Sun Nov  6 08:49:37 1994`. */
const ASCTIME_DATE =
	/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) ([A-Z][a-z]{2}) ([ \d]\d) (\d{2}):(\d{2}):(\d{2}) (\d{4})$/;

/** Month names in the order `Date.UTC` numbers them from zero. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The date parts every spelling carries, before they are checked as a real date. */
interface DateParts {
	year: number;
	month: string;
	day: string;
	hour: string;
	minute: string;
	second: string;
}

/**
 * Reads how long a `Retry-After` asks the client to wait. Delay-seconds count from the
 * answer; a date counts from `now`, and one already past reads as `0`. A value in neither
 * form, a negative or fractional number included, reads as `null`, so the caller falls
 * back to its own backoff.
 *
 * @param value - The header's value, or `null` when the response carried none.
 * @param now - The time the answer arrived, which a date is measured from.
 * @default now new Date()
 * @returns Milliseconds to wait, or `null` when the header names no usable delay.
 * @example
 * parseRetryAfter(response.headers.get("Retry-After")); // 120000 for "120"
 * @example
 * parseRetryAfter("Wed, 21 Oct 2015 07:28:30 GMT", new Date("2015-10-21T07:28:00Z")); // 30000
 */
export function parseRetryAfter(value: string | null, now: Date = new Date()): number | null {
	if (value === null) return null;
	let text = value.trim();
	if (DELAY_SECONDS.test(text)) return Number(text) * 1000;

	let date = parseHttpDate(text, now);
	if (date === null) return null;
	return Math.max(0, date - now.getTime());
}

/**
 * Parses an RFC 9110 HTTP-date in any of its three spellings as epoch milliseconds. A
 * two-digit RFC 850 year more than 50 years past `now` belongs to the previous century.
 *
 * @param text - The trimmed header value.
 * @param now - The clock a two-digit year is placed against.
 * @returns The instant, or `null` for any other text or an impossible date.
 */
function parseHttpDate(text: string, now: Date): number | null {
	let imf = IMF_FIXDATE.exec(text);
	if (imf) {
		let [, day = "", month = "", year = "", hour = "", minute = "", second = ""] = imf;
		return toTime({ year: Number(year), month, day, hour, minute, second });
	}

	let rfc850 = RFC_850_DATE.exec(text);
	if (rfc850) {
		let [, day = "", month = "", year = "", hour = "", minute = "", second = ""] = rfc850;
		let current = now.getUTCFullYear();
		let full = current - (current % 100) + Number(year);
		if (full > current + 50) full -= 100;
		return toTime({ year: full, month, day, hour, minute, second });
	}

	let asctime = ASCTIME_DATE.exec(text);
	if (asctime) {
		let [, month = "", day = "", hour = "", minute = "", second = "", year = ""] = asctime;
		return toTime({ year: Number(year), month, day: day.trim(), hour, minute, second });
	}

	return null;
}

/**
 * Turns date parts into epoch milliseconds in UTC, refusing a date `Date.UTC` would roll
 * over (31 February, hour 24), so a malformed header never becomes a wrong wait.
 *
 * @param parts - The parts one spelling captured.
 * @returns The instant, or `null` when the parts name no real date.
 */
function toTime(parts: DateParts): number | null {
	let month = MONTHS.indexOf(parts.month);
	if (month === -1) return null;
	let day = Number(parts.day);
	let hour = Number(parts.hour);
	let minute = Number(parts.minute);
	let second = Number(parts.second);

	let time = Date.UTC(parts.year, month, day, hour, minute, second);
	let date = new Date(time);
	let exact =
		date.getUTCFullYear() === parts.year &&
		date.getUTCMonth() === month &&
		date.getUTCDate() === day &&
		date.getUTCHours() === hour &&
		date.getUTCMinutes() === minute &&
		date.getUTCSeconds() === second;
	return exact ? time : null;
}
