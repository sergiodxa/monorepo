/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * CSS Grid's `repeat()` count: an explicit number of tracks, or one of the
 * two auto-repeat keywords (`"auto-fill"`, `"auto-fit"`) that let the grid
 * itself decide how many tracks fit.
 */
export type RepeatCount = number | "auto-fill" | "auto-fit";

/**
 * The repeated track size: a bare number defaults to that many `fr` units
 * (the overwhelmingly common case — an even fractional split), or a raw
 * string for anything else (a length like `"140px"`, or a nested
 * `minmax(...)` clause).
 */
export type RepeatTrack = number | (string & {});

/**
 * Builds a `repeat(...)` track-list value string for `u.gridTemplate()`'s
 * `columns`/`rows` options, or any other `grid-template-columns`/`-rows`
 * use. A plain string resolver, not a mixin. `track` is the repeated track
 * size — a bare number resolves to that many `fr` units (`u.repeat(3, 1)`
 * for three equal-width tracks), and a string passes through unchanged for
 * anything else (a length, or a nested `minmax(...)` clause), since track
 * sizing otherwise varies too continuously for a named scale to usefully
 * cover.
 *
 * @example u.gridTemplate({ columns: u.repeat(3, 1) })
 * @example css({ gridTemplateColumns: "repeat(3, 1fr)" })
 * @example u.gridTemplate({ columns: u.repeat("auto-fit", "minmax(140px, 1fr)") })
 * @example css({ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" })
 */
export function repeat(count: RepeatCount, track: RepeatTrack): string {
	let trackValue = typeof track === "number" ? `${track}fr` : track;
	return `repeat(${count}, ${trackValue})`;
}
