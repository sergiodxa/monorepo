/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets `flex-direction: column`.
 *
 * @example u.flexCol()
 * @example css({ flexDirection: "column" })
 */
export function flexCol<Node extends Element = Element>() {
	return utility<Node>(() => ({ flexDirection: "column" }));
}
