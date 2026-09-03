/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/** Where an item's box lines up against the scroll container's snapport. */
export type ScrollSnapAlignValue = "none" | "start" | "center" | "end";

/**
 * Applies `scroll-snap-align`, defaulting to `"start"`, on the snap *items* —
 * the children of the scroll container — while `u.scrollSnapType()` goes on the
 * *container*; swapping the two silently disables snapping either way.
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
