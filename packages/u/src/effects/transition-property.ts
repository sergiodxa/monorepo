/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Applies `transition-property` on its own, so a variant can change which
 * properties animate while the duration and timing function declared
 * elsewhere stay in place.
 *
 * @example u.transitionProperty("transform")
 * @example css({ transitionProperty: "transform" })
 */
export function transitionProperty<Node extends Element = Element>(value: string) {
	return utility<Node>(() => ({ transitionProperty: value }));
}
