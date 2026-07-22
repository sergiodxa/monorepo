/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets `display: inline-flex`.
 *
 * @example u.inlineFlex()
 * @example css({ display: "inline-flex" })
 */
export function inlineFlex<Node extends Element = Element>() {
	return utility<Node>(() => ({ display: "inline-flex" }));
}
