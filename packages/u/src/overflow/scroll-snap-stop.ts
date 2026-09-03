/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/** Whether a fast scroll gesture may pass over this snap position or must stop on it. */
export type ScrollSnapStopValue = "normal" | "always";

/**
 * Applies `scroll-snap-stop` to a snap item, defaulting to `"always"` so a fast
 * flick rests on the item and one swipe advances exactly one page. `"normal"`
 * lets momentum carry past it. Pair with `u.scrollSnapAlign()`.
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
