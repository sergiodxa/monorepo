/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Sets `display: inline-block`.
 *
 * @example u.inlineBlock()
 * @example css({ display: "inline-block" })
 */
export function inlineBlock<Node extends Element = Element>() {
	return utility<Node>(() => ({ display: "inline-block" }));
}
