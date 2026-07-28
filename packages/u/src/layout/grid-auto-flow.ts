/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * How the grid's auto-placement algorithm walks the tracks: filling rows
 * first (`"row"`, the CSS default), columns first (`"column"`), or either of
 * those with the `dense` packing mode enabled.
 */
export type GridAutoFlowValue = "row" | "column" | "dense" | "row dense" | "column dense";

/**
 * Applies `grid-auto-flow`, choosing the axis auto-placed items fill along
 * and whether the dense packing mode is on. Defaults to `"row"`, the CSS
 * default of filling each row before moving to the next.
 *
 * `dense` changes packing rather than direction: the default sparse algorithm
 * only ever moves forward, so an explicitly placed item that pushes past a
 * few tracks leaves holes behind it, while `dense` goes back and backfills
 * those earlier holes with any later item small enough to fit.
 *
 * The real caveat is that backfilling decouples visual order from DOM order —
 * an item rendered late can end up displayed early. For keyboard users, focus
 * still follows the DOM, so tab order stops matching what they see on screen.
 * Don't use `dense` where the grid items are interactive (links, buttons,
 * form controls, anything focusable); keep it to purely presentational
 * content such as an image or card mosaic.
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
