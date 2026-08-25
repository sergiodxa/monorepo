/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Requests a thin scrollbar that reserves its gutter up front, so layout
 * stays put whether or not the scrollbar is showing. Pair with
 * `u.scroll()`/`u.overflow()` on the same scroll container.
 *
 * @example u.thinScrollbar()
 * @example css({ scrollbarWidth: "thin", scrollbarGutter: "stable" })
 */
export function thinScrollbar<Node extends Element = Element>() {
	return utility<Node>(() => ({ scrollbarWidth: "thin", scrollbarGutter: "stable" }));
}
