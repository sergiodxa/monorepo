/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets `display: block`.
 *
 * @example u.block()
 * @example css({ display: "block" })
 */
export function block<Node extends Element = Element>() {
	return utility<Node>(() => ({ display: "block" }));
}
