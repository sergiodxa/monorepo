/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Applies `overflow: clip`, the modern alternative to `overflow: hidden`.
 * Overflow stays permanently unreachable: user input, programmatic scrolling,
 * and focusing a clipped descendant all leave the element unscrolled.
 *
 * @example u.clip()
 * @example css({ overflow: "clip" })
 */
export function clip<Node extends Element = Element>() {
	return utility<Node>(() => ({ overflow: "clip" }));
}
