/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies the `transition-property` property on its own — for overriding
 * just which properties animate on a transition already declared elsewhere,
 * without re-declaring `transition-duration`/`transition-timing-function`.
 *
 * @example u.transitionProperty("transform")
 * @example css({ transitionProperty: "transform" })
 */
export function transitionProperty<Node extends Element = Element>(value: string) {
	return utility<Node>(() => ({ transitionProperty: value }));
}
