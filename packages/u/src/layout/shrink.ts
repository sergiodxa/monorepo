/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies `flex-shrink`. Defaults to `0`, the common case of a fixed-size
 * flex item — an icon or graphic slot — that keeps its size alongside the
 * flexible content next to it.
 *
 * @example u.shrink()
 * @example css({ flexShrink: "0" })
 * @example u.shrink(1)
 * @example css({ flexShrink: "1" })
 */
export function shrink<Node extends Element = Element>(value: number | (string & {}) = 0) {
	return utility<Node>(() => ({ flexShrink: String(value) }));
}
