/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * A grid item's placement along one axis. A bare number is a **grid line
 * number**, exactly as CSS reads it; spanning is written as `` `span
 * ${number}` ``, and any other string is the full shorthand grammar.
 */
export type GridLineValue = number | `span ${number}` | (string & {});

/**
 * Applies `grid-column`, shorthand for `grid-column-start` /
 * `grid-column-end`: one value sets the start line and spans one track, a
 * `"start / end"` string sets both. A number always reads as a line number.
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
