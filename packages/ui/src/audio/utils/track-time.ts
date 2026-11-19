/**
 * How a music app writes a length or a position: `3:07` for a track, `1:02:45` past an hour,
 * and a spoken form for screen readers, so a slider's value and a table's column read alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Writes seconds as `m:ss`, or `h:mm:ss` from an hour. Negative, missing and non-finite
 * values read `0:00`, so a player whose media has not loaded yet shows a time, not `NaN`.
 *
 * @param seconds The length or position.
 * @returns The clock form.
 * @example formatTrackTime(187) // "3:07"
 * @example formatTrackTime(3765) // "1:02:45"
 */
export function formatTrackTime(seconds: number): string {
	let whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
	let hours = Math.floor(whole / 3600);
	let minutes = Math.floor((whole % 3600) / 60);
	let rest = String(whole % 60).padStart(2, "0");
	return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

/**
 * Writes a total length in words for a collection's header, rounding to minutes.
 *
 * @param seconds The summed length.
 * @param units The words for hours and minutes, such as `{ hour: "hr", minute: "min" }`.
 * @returns Such as "1 hr 12 min" or "38 min".
 */
export function formatTotalTime(seconds: number, units: { hour: string; minute: string }): string {
	let minutes = Math.round((Number.isFinite(seconds) ? Math.max(0, seconds) : 0) / 60);
	let hours = Math.floor(minutes / 60);
	let rest = minutes % 60;
	return hours > 0 ? `${hours} ${units.hour} ${rest} ${units.minute}` : `${rest} ${units.minute}`;
}
