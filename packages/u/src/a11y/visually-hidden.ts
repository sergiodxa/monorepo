/**
 * The screen-reader-only-but-focusable clipping recipe applied to any
 * element that must stay in the accessibility tree and tab order while
 * rendering no visible pixels of its own — a compound control's native
 * `<input>` while a sibling element paints the visible indicator it
 * actually shows, or a `<label>` whose caption a paired visible control
 * already carries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Clips the host down to a `1px` by `1px` box positioned absolutely out of
 * layout flow, its padding and border removed, a `-1px` margin pulling its
 * box back to a single point, `clip: rect(0, 0, 0, 0)` and
 * `overflow: hidden` clipping its rendered pixels away, and
 * `whiteSpace: nowrap` keeping its clip rect stable regardless of
 * surrounding text wrapping. The host keeps its native focusability and tab
 * order throughout this recipe, since only its position and rendered pixels
 * are clipped away.
 *
 * @example u.visuallyHidden()
 * @example css({
 *   position: "absolute",
 *   inlineSize: "1px",
 *   blockSize: "1px",
 *   padding: "0",
 *   margin: "-1px",
 *   overflow: "hidden",
 *   clip: "rect(0, 0, 0, 0)",
 *   whiteSpace: "nowrap",
 *   borderWidth: "0",
 * })
 */
export function visuallyHidden<Node extends Element = Element>() {
	return utility<Node>(() => ({
		position: "absolute",
		inlineSize: "1px",
		blockSize: "1px",
		padding: "0",
		margin: "-1px",
		overflow: "hidden",
		clip: "rect(0, 0, 0, 0)",
		whiteSpace: "nowrap",
		borderWidth: "0",
	}));
}
