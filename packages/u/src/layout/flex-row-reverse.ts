/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets `display: flex; flex-direction: row-reverse`.
 *
 * @example u.flexRowReverse()
 * @example css({ display: "flex", flexDirection: "row-reverse" })
 */
export function flexRowReverse<Node extends Element = Element>() {
	return utility<Node>(() => ({ display: "flex", flexDirection: "row-reverse" }));
}
