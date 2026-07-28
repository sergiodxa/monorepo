/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * A grid item's placement along one axis. A bare number is a **grid line
 * number**, exactly as CSS reads it — `2` means "start at line 2", not "span
 * 2 tracks". Spanning is written explicitly as `` `span ${number}` ``, which
 * the template-literal member exists to autocomplete. Any other string covers
 * the full shorthand grammar: an explicit start/end pair (`"1 / 3"`), a mixed
 * pair (`"span 2 / -1"`), or named grid lines (`"main-start / main-end"`).
 */
export type GridLineValue = number | `span ${number}` | (string & {});

/**
 * Applies `grid-column`, placing or spanning a grid item along the inline
 * axis. `grid-column` is a shorthand for `grid-column-start` /
 * `grid-column-end`, so a single value sets the start line and lets the end
 * default to spanning one track, while a `"start / end"` string sets both.
 *
 * A number is a line number, not a span count — `u.gridColumn(2)` starts the
 * item at the second column line and occupies one track, whereas
 * `u.gridColumn("span 2")` leaves the start to auto-placement and occupies
 * two tracks. This is the distinction that most often trips people up, and
 * this utility deliberately does not reinterpret a number as a span.
 *
 * @example u.gridColumn(2)
 * @example css({ gridColumn: 2 })
 * @example u.gridColumn("span 2")
 * @example css({ gridColumn: "span 2" })
 * @example u.gridColumn("1 / 3")
 * @example css({ gridColumn: "1 / 3" })
 * @example u.gridColumn("main-start / main-end")
 * @example css({ gridColumn: "main-start / main-end" })
 */
export function gridColumn<Node extends Element = Element>(value: GridLineValue) {
	return utility<Node>(() => ({ gridColumn: value }));
}
