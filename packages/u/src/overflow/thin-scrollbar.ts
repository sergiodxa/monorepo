/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Requests a thin scrollbar that reserves its gutter up front, so its
 * appearance and disappearance never shifts layout. Pair with
 * `u.scroll()`/`u.overflow()` on the same scroll container.
 *
 * @example u.thinScrollbar()
 * @example css({ scrollbarWidth: "thin", scrollbarGutter: "stable" })
 */
export function thinScrollbar<Node extends Element = Element>() {
	return utility<Node>(() => ({ scrollbarWidth: "thin", scrollbarGutter: "stable" }));
}
