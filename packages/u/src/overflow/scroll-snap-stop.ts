/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/** Whether a fast scroll gesture may pass over this snap position or must stop on it. */
export type ScrollSnapStopValue = "normal" | "always";

/**
 * Applies `scroll-snap-stop` to a snap item, defaulting to `"always"`. With
 * `"always"` a single fast flick cannot skip past the item — the scroll is
 * forced to come to rest on it, which is what a paged carousel needs so one
 * swipe advances exactly one page. `"normal"` lets momentum carry the scroll
 * over any number of snap positions. Pair with `u.scrollSnapAlign()` on the
 * same item.
 *
 * @example u.scrollSnapStop()
 * @example css({ scrollSnapStop: "always" })
 * @example u.scrollSnapStop("normal")
 * @example css({ scrollSnapStop: "normal" })
 */
export function scrollSnapStop<Node extends Element = Element>(
	value: ScrollSnapStopValue = "always",
) {
	return utility<Node>(() => ({ scrollSnapStop: value }));
}
