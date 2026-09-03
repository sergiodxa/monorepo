/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Applies opacity from a 0-100 integer. Sets the `opacity` property, which
 * flattens the element and all of its descendants into one group and fades
 * that group as a whole.
 *
 * @see `u.filterOpacity()` for the composable `filter: opacity(...)` function,
 * which takes the native 0-1 range.
 * @example u.opacity(50)
 * @example css({ opacity: 0.5 })
 */
export function opacity<Node extends Element = Element>(value: number) {
	return utility<Node>(() => ({ opacity: value / 100 }));
}
