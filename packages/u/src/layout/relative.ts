/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets `position: relative`.
 *
 * @example u.relative()
 * @example css({ position: "relative" })
 */
export function relative<Node extends Element = Element>() {
	return utility<Node>(() => ({ position: "relative" }));
}
