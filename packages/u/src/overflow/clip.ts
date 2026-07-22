/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies `overflow: clip`, the modern alternative to `overflow: hidden`.
 * Unlike `hidden`, `clip` doesn't establish a scroll container, so the
 * element's overflow can never become scrollable through user input,
 * programmatic scrolling, or focusing a clipped descendant.
 *
 * @example u.clip()
 * @example css({ overflow: "clip" })
 */
export function clip<Node extends Element = Element>() {
	return utility<Node>(() => ({ overflow: "clip" }));
}
