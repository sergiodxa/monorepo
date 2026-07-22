/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets `flex-wrap`.
 *
 * @example u.flexWrap()
 * @example css({ flexWrap: "wrap" })
 * @example u.flexWrap("nowrap")
 * @example css({ flexWrap: "nowrap" })
 */
export function flexWrap<Node extends Element = Element>(
	value: "wrap" | "nowrap" | "wrap-reverse" = "wrap",
) {
	return utility<Node>(() => ({ flexWrap: value }));
}
