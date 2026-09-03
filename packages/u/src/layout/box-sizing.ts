/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

export type BoxSizingValue = "border-box" | "content-box";

/**
 * Applies `box-sizing`, controlling whether `width`/`height` (and the logical
 * `inline-size`/`block-size` pair) span padding and border (`"border-box"`) or
 * the content area alone (`"content-box"`, the CSS default).
 *
 * @example u.boxSizing("border-box")
 * @example css({ boxSizing: "border-box" })
 * @example u.boxSizing("content-box")
 * @example css({ boxSizing: "content-box" })
 */
export function boxSizing<Node extends Element = Element>(value: BoxSizingValue) {
	return utility<Node>(() => ({ boxSizing: value }));
}
