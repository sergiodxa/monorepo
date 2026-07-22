/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets `position: absolute`.
 *
 * @example u.absolute()
 * @example css({ position: "absolute" })
 */
export function absolute<Node extends Element = Element>() {
	return utility<Node>(() => ({ position: "absolute" }));
}
