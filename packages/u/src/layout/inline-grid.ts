/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets `display: inline-grid`.
 *
 * @example u.inlineGrid()
 * @example css({ display: "inline-grid" })
 */
export function inlineGrid<Node extends Element = Element>() {
	return utility<Node>(() => ({ display: "inline-grid" }));
}
