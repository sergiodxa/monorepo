/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/** Where an item's box lines up against the scroll container's snapport. */
export type ScrollSnapAlignValue = "none" | "start" | "center" | "end";

/**
 * Applies `scroll-snap-align`, defaulting to `"start"`. This one goes on the
 * snap *items* — the children of the scroll container — while
 * `u.scrollSnapType()` goes on the *container*. Splitting them the other way
 * round is the single most common reason snapping silently does nothing, since
 * neither property warns when its counterpart is missing.
 *
 * @example u.scrollSnapAlign()
 * @example css({ scrollSnapAlign: "start" })
 * @example u.scrollSnapAlign("center")
 * @example css({ scrollSnapAlign: "center" })
 */
export function scrollSnapAlign<Node extends Element = Element>(
	value: ScrollSnapAlignValue = "start",
) {
	return utility<Node>(() => ({ scrollSnapAlign: value }));
}
