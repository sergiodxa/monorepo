/**
 * The value formats JSContact shares across objects: the Id alphabet, the UTCDateTime form
 * with its single spelling per instant, and the canonical case of a language tag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** 1 to 255 characters of the base64url alphabet without padding. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;

/** RFC 3339 date-time in UTC, uppercase, with an optional fraction that must not end in zero. */
const UTC_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d*[1-9]))?Z$/;

/**
 * Whether a string is a valid Id, the type of every key of a map of objects.
 *
 * @param value - The candidate key
 * @returns `true` for 1 to 255 characters of `A-Za-z0-9`, `-` and `_`
 * @example isId("e-1"); // true
 */
export function isId(value: string): boolean {
	return ID_PATTERN.test(value);
}

/**
 * Whether a string is a UTCDateTime. `2010-10-10T10:10:10.000Z` fails, since a zero fraction
 * must be left out, and impossible dates such as February 30 fail too.
 *
 * @param value - The candidate
 * @returns `true` for a UTCDateTime in its one valid spelling
 */
export function isUTCDateTime(value: string): boolean {
	let match = UTC_PATTERN.exec(value);
	if (!match) return false;
	let [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number) as number[];
	let date = new Date(Date.UTC(year as number, (month as number) - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === (month as number) - 1 &&
		date.getUTCDate() === day &&
		(hour as number) < 24 &&
		(minute as number) < 60 &&
		(second as number) < 61
	);
}

/**
 * Writes an RFC 5646 tag in its canonical case (`en`, `de-AT`, `zh-Hant`), which is how a
 * converted Card keys its localizations. A tag `Intl` cannot read is returned as written.
 *
 * @param tag - The tag as a vCard wrote it, e.g. `EN`
 * @returns The canonical spelling
 */
export function canonicalLanguage(tag: string): string {
	try {
		return Intl.getCanonicalLocales(tag)[0] ?? tag;
	} catch {
		return tag;
	}
}
