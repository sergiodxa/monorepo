/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets `display: inline`.
 *
 * @example u.inline()
 * @example css({ display: "inline" })
 */
export function inline<Node extends Element = Element>() {
	return utility<Node>(() => ({ display: "inline" }));
}
