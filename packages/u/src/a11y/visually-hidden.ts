/**
 * The screen-reader-only-but-focusable clipping recipe for elements that must
 * stay in the accessibility tree and tab order while staying invisible on
 * screen — a compound control's native `<input>` behind a sibling that paints
 * the visible indicator, or a `<label>` a paired visible control captions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Clips the host to a `1px` box taken out of layout flow, keeping its native
 * focusability and tab order intact so screen readers and keyboard users
 * still reach it.
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
