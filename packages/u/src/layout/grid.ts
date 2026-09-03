/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Sets `display: grid`.
 *
 * @example u.grid()
 * @example css({ display: "grid" })
 */
export function grid<Node extends Element = Element>() {
	return utility<Node>(() => ({ display: "grid" }));
}
