/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/** Whether an element may be picked as the browser's scroll anchor. */
export type OverflowAnchorValue = "auto" | "none";

/**
 * Applies `overflow-anchor`, opting an element out of scroll anchoring.
 *
 * Scroll anchoring is a browser behaviour most people have never had to name.
 * By default the browser picks an on-screen element as an anchor and quietly
 * adjusts the scroll position to keep that element visually still whenever
 * content above it changes size. It is what stops the page yanking out from
 * under a reader when an image finishes loading, a font swaps in, or a banner
 * injects itself above the current reading position. `"auto"` is that default
 * behaviour; `"none"` says this element must never be chosen as the anchor.
 *
 * Opting out is the unusual choice, and the `"none"` default here is aimed at
 * the one case that genuinely needs a utility: a sentinel or spacer element at
 * the tail of an infinite-scroll list, where the browser anchoring to the very
 * element that grows and moves as pages load fights the loading logic instead
 * of helping it. For ordinary content `"auto"` is what you want, and the right
 * move is to make no call at all, since `"auto"` is already the initial value;
 * pass it only when being loud about the intent is worth a declaration.
 *
 * @example u.overflowAnchor()
 * @example css({ overflowAnchor: "none" })
 * @example u.overflowAnchor("auto")
 * @example css({ overflowAnchor: "auto" })
 */
export function overflowAnchor<Node extends Element = Element>(
	value: OverflowAnchorValue = "none",
) {
	return utility<Node>(() => ({ overflowAnchor: value }));
}
