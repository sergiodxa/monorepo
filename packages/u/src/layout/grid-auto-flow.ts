/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * How the grid's auto-placement algorithm walks the tracks: filling rows
 * first (`"row"`, the CSS default), columns first (`"column"`), or either of
 * those with the `dense` packing mode enabled.
 */
export type GridAutoFlowValue = "row" | "column" | "dense" | "row dense" | "column dense";

/**
 * Applies `grid-auto-flow`, the axis auto-placed items fill along; defaults
 * to `"row"`. `dense` backfills earlier holes with later items, diverging
 * visual order from the DOM order focus follows — keep it presentational.
 *
 * @example u.gridAutoFlow()
 * @example css({ gridAutoFlow: "row" })
 * @example u.gridAutoFlow("column")
 * @example css({ gridAutoFlow: "column" })
 * @example u.gridAutoFlow("row dense")
 * @example css({ gridAutoFlow: "row dense" })
 */
export function gridAutoFlow<Node extends Element = Element>(value: GridAutoFlowValue = "row") {
	return utility<Node>(() => ({ gridAutoFlow: value }));
}
