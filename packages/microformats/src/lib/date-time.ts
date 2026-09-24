/**
 * The date and time rules of the value-class pattern: classifying each value element as
 * a date, a time or a timezone, assembling them into `YYYY-MM-DD HH:MM(:SS)(±HHMM|Z)`,
 * and lending a time-only `dt-*` value the date an earlier one in the same item named.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** `YYYY-MM-DD` or the ordinal `YYYY-DDD`, the two dates the pattern accepts. */
const DATE = String.raw`\d{4}-(?:\d{2}-\d{2}|\d{3})`;

/** An offset or Zulu, with the colon between hours and minutes optional. */
const ZONE = String.raw`Z|z|[+-]\d{1,2}(?::?\d{2})?`;

/** A twelve-hour clock suffix, spaced or not, dotted or not. */
const MERIDIEM = String.raw`[aApP]\.?[mM]\.?`;

/**
 * A time: `HH:MM(:SS)` with an optional meridiem, or `HH` with a required one, either
 * followed by an optional zone.
 */
const TIME = String.raw`(?:(?<hour>\d{1,2}):(?<minute>\d{2})(?::(?<second>\d{2}(?:\.\d+)?))?(?: ?(?<meridiem>${MERIDIEM}))?|(?<bareHour>\d{1,2}) ?(?<bareMeridiem>${MERIDIEM}))(?: ?(?<zone>${ZONE}))?`;

const DATE_PATTERN = new RegExp(`^${DATE}$`, "u");

const TIME_PATTERN = new RegExp(`^${TIME}$`, "u");

const ZONE_PATTERN = new RegExp(`^(?:${ZONE})$`, "u");

const DATE_TIME_PATTERN = new RegExp(`^(?<date>${DATE})[Tt ]${TIME}$`, "u");

/** A parsed `dt-*` value, and the date it names for later time-only values to borrow. */
export interface DateTimeValue {
	value: string;
	date: string | null;
}

/**
 * Assembles value-class parts into one date-time. The first date, the first time and the
 * first timezone win; a part holding a full date-time supplies its date and time at once.
 *
 * @param parts - The trimmed text of each value element, in document order
 * @param impliedDate - The date an earlier `dt-*` in the item named, for a part list with a time and no date
 * @returns The normalized value, or `null` when no part is a date, a time or a date-time
 */
export function assembleDateTime(
	parts: string[],
	impliedDate: string | null,
): DateTimeValue | null {
	let date: string | null = null;
	let time: string | null = null;
	let zone: string | null = null;

	for (let part of parts) {
		let full = DATE_TIME_PATTERN.exec(part);
		if (full?.groups) {
			if (date === null && time === null) {
				date = full.groups.date ?? null;
				time = normalizeTime(full.groups);
				zone ??= full.groups.zone ?? null;
			}
			continue;
		}
		let timeMatch = TIME_PATTERN.exec(part);
		if (timeMatch?.groups) {
			if (time === null) {
				time = normalizeTime(timeMatch.groups);
				zone ??= timeMatch.groups.zone ?? null;
			}
			continue;
		}
		if (DATE_PATTERN.test(part)) {
			date ??= part;
			continue;
		}
		if (ZONE_PATTERN.test(part)) zone ??= part;
	}

	if (date === null && time === null) return null;
	if (time === null) return { value: date ?? "", date };
	date ??= impliedDate;
	let value = date === null ? time : `${date} ${time}`;
	if (zone !== null) value += normalizeZone(zone);
	return { value, date };
}

/**
 * Reads a `dt-*` value taken from an attribute or text: a time alone borrows the implied
 * date and is normalized with it, and anything else is kept as the author wrote it.
 */
export function readDateTime(raw: string, impliedDate: string | null): DateTimeValue {
	let full = DATE_TIME_PATTERN.exec(raw);
	if (full?.groups) return { value: raw, date: full.groups.date ?? null };
	if (DATE_PATTERN.test(raw)) return { value: raw, date: raw };
	if (impliedDate !== null && TIME_PATTERN.test(raw)) {
		return assembleDateTime([impliedDate, raw], null) ?? { value: raw, date: impliedDate };
	}
	return { value: raw, date: null };
}

/** `HH:MM(:SS)` on a 24-hour clock, keeping the seconds only when they were written. */
function normalizeTime(groups: Record<string, string | undefined>): string {
	let meridiem = (groups.meridiem ?? groups.bareMeridiem ?? "").toLowerCase().replaceAll(".", "");
	let hour = Number(groups.hour ?? groups.bareHour ?? "0");
	let minute = groups.minute ?? "00";
	if (meridiem === "am" && hour === 12) hour = 0;
	if (meridiem === "pm" && hour < 12) hour += 12;
	let hourText = meridiem === "" ? (groups.hour ?? String(hour)) : String(hour).padStart(2, "0");
	let time = `${hourText}:${minute}`;
	if (groups.second !== undefined) time += `:${groups.second}`;
	return time;
}

/** A zone as `Z` or `±HHMM`, the colon removed and Zulu uppercased. */
function normalizeZone(zone: string): string {
	if (zone === "z" || zone === "Z") return "Z";
	return zone.replace(":", "");
}
