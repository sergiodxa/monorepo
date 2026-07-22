/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets `position: sticky`.
 *
 * @example u.sticky()
 * @example css({ position: "sticky" })
 */
export function sticky<Node extends Element = Element>() {
	return utility<Node>(() => ({ position: "sticky" }));
}
