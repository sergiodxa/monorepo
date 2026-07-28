/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/** What happens once a scroll container reaches the end of its own scrollable area. */
export type OverscrollBehaviorValue = "auto" | "contain" | "none";

/**
 * Applies `overscroll-behavior`, defaulting to `"contain"`. Its real job is
 * stopping scroll chaining: without it, scrolling past the end of a scrollable
 * drawer, dialog, dropdown, or message list hands the remaining momentum to
 * the page behind it, so the background silently scrolls away under a surface
 * the reader is still working in. `"contain"` keeps the scroll inside this
 * element while preserving the platform's overscroll affordance —
 * rubber-banding on iOS, pull-to-refresh on Android. `"none"` also stops the
 * chaining but additionally suppresses that affordance, which is worth it only
 * when the bounce itself is the problem (a canvas or a custom pull gesture).
 *
 * @example u.overscrollBehavior()
 * @example css({ overscrollBehavior: "contain" })
 * @example u.overscrollBehavior("none")
 * @example css({ overscrollBehavior: "none" })
 */
export function overscrollBehavior<Node extends Element = Element>(
	value: OverscrollBehaviorValue = "contain",
) {
	return utility<Node>(() => ({ overscrollBehavior: value }));
}
