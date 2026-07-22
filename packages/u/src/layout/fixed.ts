/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets `position: fixed`.
 *
 * @example u.fixed()
 * @example css({ position: "fixed" })
 */
export function fixed<Node extends Element = Element>() {
	return utility<Node>(() => ({ position: "fixed" }));
}
