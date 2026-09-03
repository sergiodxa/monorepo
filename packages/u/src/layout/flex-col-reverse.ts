/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Sets `display: flex; flex-direction: column-reverse`.
 *
 * @example u.flexColReverse()
 * @example css({ display: "flex", flexDirection: "column-reverse" })
 */
export function flexColReverse<Node extends Element = Element>() {
	return utility<Node>(() => ({ display: "flex", flexDirection: "column-reverse" }));
}
