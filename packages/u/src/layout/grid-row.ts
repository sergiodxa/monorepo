/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

import type { GridLineValue } from "./grid-column";

/**
 * Applies `grid-row`, placing or spanning a grid item along the block axis.
 * `grid-row` is a shorthand for `grid-row-start` / `grid-row-end`, so a
 * single value sets the start line and lets the end default to spanning one
 * track, while a `"start / end"` string sets both.
 *
 * A number is a line number, not a span count — `u.gridRow(2)` starts the
 * item at the second row line and occupies one track, whereas
 * `u.gridRow("span 2")` leaves the start to auto-placement and occupies two
 * tracks. This is the distinction that most often trips people up, and this
 * utility deliberately does not reinterpret a number as a span.
 *
 * @example u.gridRow(2)
 * @example css({ gridRow: 2 })
 * @example u.gridRow("span 3")
 * @example css({ gridRow: "span 3" })
 * @example u.gridRow("1 / -1")
 * @example css({ gridRow: "1 / -1" })
 * @example u.gridRow("header-start / header-end")
 * @example css({ gridRow: "header-start / header-end" })
 */
export function gridRow<Node extends Element = Element>(value: GridLineValue) {
	return utility<Node>(() => ({ gridRow: value }));
}
