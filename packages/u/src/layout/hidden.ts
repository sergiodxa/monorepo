/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Sets `display: none`, removing the host element from layout entirely.
 *
 * @example u.hidden()
 * @example css({ display: "none" })
 */
export function hidden<Node extends Element = Element>() {
	return utility<Node>(() => ({ display: "none" }));
}
