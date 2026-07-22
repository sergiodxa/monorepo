/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets `display: flex`.
 *
 * @example u.flex()
 * @example css({ display: "flex" })
 */
export function flex<Node extends Element = Element>() {
	return utility<Node>(() => ({ display: "flex" }));
}
