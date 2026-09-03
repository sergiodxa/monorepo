/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Sets `flex-direction: row`.
 *
 * @example u.flexRow()
 * @example css({ flexDirection: "row" })
 */
export function flexRow<Node extends Element = Element>() {
	return utility<Node>(() => ({ flexDirection: "row" }));
}
